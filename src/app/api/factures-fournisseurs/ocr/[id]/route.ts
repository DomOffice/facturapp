import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { extraireFactureFournisseurDepuisOcr } from "@/lib/ocr/extract-facture-fournisseur";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ||
  path.join(process.cwd(), "uploads", "factures-fournisseurs");

const PYTHON_OCR_PATH = process.env.PYTHON_OCR_PATH || "python";

const OCR_SCRIPT_PATH =
  process.env.OCR_SCRIPT_PATH ||
  path.join(process.cwd(), "ocr", "ocr_document.py");

function lireNumeroFacture(donneesExtraites: unknown): string | null {
  if (
    !donneesExtraites ||
    typeof donneesExtraites !== "object" ||
    Array.isArray(donneesExtraites)
  ) {
    return null;
  }

  const extraction = (donneesExtraites as Record<string, unknown>).extraction;

  if (
    !extraction ||
    typeof extraction !== "object" ||
    Array.isArray(extraction)
  ) {
    return null;
  }

  const numeroFacture = (extraction as Record<string, unknown>).numeroFacture;

  return typeof numeroFacture === "string" && numeroFacture.trim().length > 0
    ? numeroFacture.trim()
    : null;
}

function normaliserNumeroFacture(numeroFacture: string): string {
  return numeroFacture
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function extraireJsonDepuisSortie(stdout: string) {
  const debut = stdout.lastIndexOf('{"success"');

  if (debut === -1) {
    throw new Error(
      "Résultat OCR invalide : JSON introuvable dans la sortie Python.",
    );
  }

  const jsonText = stdout.slice(debut).trim();
  return JSON.parse(jsonText);
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const userRole = String(
      (session.user as { role?: string }).role || "",
    ).toLowerCase();

    if (!["admin", "saisie"].includes(userRole)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const documentId = Number(params.id);

    if (!Number.isInteger(documentId) || documentId <= 0) {
      return NextResponse.json({ error: "Document invalide" }, { status: 400 });
    }

    const document = await prisma.documentImporte.findUnique({
      where: { id: documentId },
      include: {
        fournisseur: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document introuvable" },
        { status: 404 },
      );
    }

    const cheminComplet = path.isAbsolute(document.cheminFichier)
      ? document.cheminFichier
      : path.join(UPLOAD_DIR, document.cheminFichier);

    await prisma.documentImporte.update({
      where: { id: documentId },
      data: {
        statut: "en_traitement",
      },
    });

    const { stdout } = await execFileAsync(
      PYTHON_OCR_PATH,
      [OCR_SCRIPT_PATH, cheminComplet],
      {
        /*
         * Un PDF multipage peut demander plusieurs minutes avec PaddleOCR,
         * particulièrement lors du premier chargement des modèles.
         */
        timeout: 5 * 60 * 1000,
        maxBuffer: 50 * 1024 * 1024,
        windowsHide: true,
      },
    );

    const resultatOcr = extraireJsonDepuisSortie(stdout);

    const diagnosticCoordonnees = Array.isArray(resultatOcr.pages)
      ? resultatOcr.pages.flatMap(
          (
            page: {
              lignes?: Array<{
                texte?: string;
                text?: string;
                position?: Array<[number, number]>;
                score?: number;
                confiance?: number;
              }>;
            },
            pageIndex: number,
          ) =>
            Array.isArray(page.lignes)
              ? page.lignes.map((ligne) => {
                  const texte = String(ligne.texte || ligne.text || "").trim();

                  const position = Array.isArray(ligne.position)
                    ? ligne.position
                    : [];

                  const xs = position.map((point) => point[0]);
                  const ys = position.map((point) => point[1]);

                  return {
                    page: pageIndex + 1,
                    texte,
                    xMin: xs.length > 0 ? Math.min.apply(null, xs) : null,
                    xMax: xs.length > 0 ? Math.max.apply(null, xs) : null,
                    y:
                      ys.length > 0
                        ? ys.reduce((somme, valeur) => somme + valeur, 0) /
                          ys.length
                        : null,
                    position,
                  };
                })
              : [],
        )
      : [];

    if (!resultatOcr.success) {
      await prisma.documentImporte.update({
        where: { id: documentId },
        data: {
          statut: "rejete",
          donneesExtraites: resultatOcr,
        },
      });

      return NextResponse.json(
        { error: resultatOcr.error || "Erreur OCR" },
        { status: 500 },
      );
    }

    const texteOcr = resultatOcr.texte || "";

    const extraction = extraireFactureFournisseurDepuisOcr(
      texteOcr,
      resultatOcr,
      document.fournisseur?.raisonSociale,
    );

    const documentMaj = await prisma.documentImporte.update({
      where: { id: documentId },
      data: {
        texteOcr,
        donneesExtraites: {
          ocr: resultatOcr,
          extraction,
        },
        statut: "ocr_termine",
      },
    });

    let doublonFacture: {
      documentId: number;
      numeroFacture: string;
      dateTraitement: string;
      avaitIntegreStock: boolean;
    } | null = null;

    const numeroFacture =
      typeof extraction.numeroFacture === "string"
        ? extraction.numeroFacture.trim()
        : "";

    const numeroFactureNormalise = numeroFacture
      ? normaliserNumeroFacture(numeroFacture)
      : "";

    if (numeroFactureNormalise) {
      const documentsDejaValides = await prisma.documentImporte.findMany({
        where: {
          id: {
            not: documentId,
          },

          fournisseurId: document.fournisseurId,

          /*
           * On recherche tous les documents déjà validés :
           *
           * - "stock_integre" pour les BL Mechouar et les factures
           *   fournisseurs qui alimentent le stock ;
           * - "valide" pour les factures Mechouar sans stock.
           */
          statut: {
            in: ["valide", "stock_integre"],
          },
        },

        select: {
          id: true,
          dateImport: true,
          dateMiseAJour: true,
          donneesExtraites: true,

          integrationStock: {
            select: {
              dateIntegration: true,
            },
          },
        },

        orderBy: {
          dateImport: "desc",
        },
      });

      const documentDoublon = documentsDejaValides.find((documentExistant) => {
        const numeroExistant = lireNumeroFacture(
          documentExistant.donneesExtraites,
        );

        return (
          numeroExistant !== null &&
          normaliserNumeroFacture(numeroExistant) === numeroFactureNormalise
        );
      });

      if (documentDoublon) {
        const dateTraitement =
          documentDoublon.integrationStock?.dateIntegration ??
          documentDoublon.dateMiseAJour ??
          documentDoublon.dateImport;

        doublonFacture = {
          documentId: documentDoublon.id,
          numeroFacture,
          dateTraitement: dateTraitement.toISOString(),
          avaitIntegreStock: documentDoublon.integrationStock !== null,
        };
      }
    }

    return NextResponse.json({
      success: true,
      documentId: documentMaj.id,
      statut: documentMaj.statut,
      texte: resultatOcr.texte || "",
      extraction,
      doublonFacture,
      diagnosticCoordonnees,
    });
  } catch (error: unknown) {
    const erreurExecution = error as {
      message?: string;
      code?: string | number;
      killed?: boolean;
      signal?: string;
      stdout?: string;
      stderr?: string;
    };

    console.error("[OCR_FACTURE_FOURNISSEUR]", {
      message: erreurExecution.message,
      code: erreurExecution.code,
      killed: erreurExecution.killed,
      signal: erreurExecution.signal,
      stderr: erreurExecution.stderr,
      stdoutFin: erreurExecution.stdout?.slice(-2000),
    });

    const delaiDepasse =
      erreurExecution.killed === true ||
      erreurExecution.signal === "SIGTERM" ||
      erreurExecution.code === "ETIMEDOUT";

    return NextResponse.json(
      {
        error: delaiDepasse
          ? "Le traitement OCR a dépassé le délai autorisé. Le document contient peut-être plusieurs pages."
          : "Erreur serveur lors de l'OCR.",

        /*
         * Utile pendant le développement local.
         * Ne pas afficher de chemins système en production.
         */
        detail:
          process.env.NODE_ENV === "development"
            ? erreurExecution.stderr ||
              erreurExecution.message ||
              "Erreur OCR inconnue"
            : undefined,
      },
      { status: 500 },
    );
  }
}
