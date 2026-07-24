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
  path.join(process.cwd(), "ocr-service", "ocr_document.py");

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
        timeout: 120000,
        maxBuffer: 20 * 1024 * 1024,
        windowsHide: true,
      },
    );

    const resultatOcr = extraireJsonDepuisSortie(stdout);

    const diagnosticCoordonnees = Array.isArray(resultatOcr.pages)
  ? resultatOcr.pages.flatMap(
      (
        page: {
          lignes?: Array<{
            texte?: string
            text?: string
            position?: Array<[number, number]>
            score?: number
            confiance?: number
          }>
        },
        pageIndex: number,
      ) =>
        Array.isArray(page.lignes)
          ? page.lignes.map((ligne) => {
              const texte = String(
                ligne.texte || ligne.text || "",
              ).trim()

              const position = Array.isArray(ligne.position)
                ? ligne.position
                : []

              const xs = position.map((point) => point[0])
              const ys = position.map((point) => point[1])

              return {
                page: pageIndex + 1,
                texte,
                xMin:
                  xs.length > 0
                    ? Math.min.apply(null, xs)
                    : null,
                xMax:
                  xs.length > 0
                    ? Math.max.apply(null, xs)
                    : null,
                y:
                  ys.length > 0
                    ? ys.reduce(
                        (somme, valeur) => somme + valeur,
                        0,
                      ) / ys.length
                    : null,
                position,
              }
            })
          : [],
    )
  : []

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

    return NextResponse.json({
      success: true,
      documentId: documentMaj.id,
      statut: documentMaj.statut,
      texte: resultatOcr.texte || "",
      extraction,
      diagnosticCoordonnees,
    });
  } catch (error) {
    console.error("[OCR_FACTURE_FOURNISSEUR]", error);

    return NextResponse.json(
      { error: "Erreur serveur lors de l'OCR" },
      { status: 500 },
    );
  }
}
