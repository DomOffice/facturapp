import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const PAIEMENTS_UPLOAD_DIR =
  process.env.PAIEMENTS_UPLOAD_DIR ||
  path.join(process.cwd(), "uploads", "paiements");

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

const MIME_AUTORISES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
];

const EXT_AUTORISEES: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
};

function nettoyerNomFichier(valeur: string) {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function verifierIdPaiement(valeur: string) {
  const id = Number(valeur);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

async function verifierSession() {
  const session = await auth();

  if (!session?.user) {
    return {
      error: NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 },
      ),
      session: null,
    };
  }

  return {
    error: null,
    session,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authentification = await verifierSession();

    if (authentification.error) {
      return authentification.error;
    }

    const paiementId = verifierIdPaiement(params.id);

    if (!paiementId) {
      return NextResponse.json(
        { error: "Paiement invalide" },
        { status: 400 },
      );
    }

    const paiement = await prisma.paiement.findUnique({
      where: { id: paiementId },
      select: { id: true },
    });

    if (!paiement) {
      return NextResponse.json(
        { error: "Paiement introuvable" },
        { status: 404 },
      );
    }

    const documents = await prisma.paiementDocument.findMany({
      where: { paiementId },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        nomFichierOriginal: true,
        typeMime: true,
        tailleFichier: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("[PAIEMENT_DOCUMENTS_GET]", error);

    return NextResponse.json(
      { error: "Erreur lors du chargement des pièces jointes" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  let cheminCompletCree: string | null = null;

  try {
    const authentification = await verifierSession();

    if (authentification.error) {
      return authentification.error;
    }

    const session = authentification.session;
    const userRole = String(
      (session!.user as { role?: string }).role || "",
    ).toLowerCase();

    if (!["admin", "saisie"].includes(userRole)) {
      return NextResponse.json(
        { error: "Accès refusé" },
        { status: 403 },
      );
    }

    const paiementId = verifierIdPaiement(params.id);

    if (!paiementId) {
      return NextResponse.json(
        { error: "Paiement invalide" },
        { status: 400 },
      );
    }

    const formData = await req.formData();
    const fichier = formData.get("fichier") as File | null;

    if (!fichier) {
      return NextResponse.json(
        { error: "Aucun fichier reçu" },
        { status: 400 },
      );
    }

    if (!MIME_AUTORISES.includes(fichier.type)) {
      return NextResponse.json(
        {
          error:
            "Format non autorisé. Formats acceptés : PDF, JPEG, PNG",
        },
        { status: 400 },
      );
    }

    if (fichier.size <= 0) {
      return NextResponse.json(
        { error: "Le fichier est vide" },
        { status: 400 },
      );
    }

    if (fichier.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: "Fichier trop volumineux. Taille maximale : 10 Mo",
        },
        { status: 400 },
      );
    }

    const paiement = await prisma.paiement.findUnique({
      where: { id: paiementId },
      select: {
        id: true,
        facture: {
          select: {
            annee: true,
            numeroFacture: true,
            dateFacture: true,
          },
        },
      },
    });

    if (!paiement) {
      return NextResponse.json(
        { error: "Paiement introuvable" },
        { status: 404 },
      );
    }

    const annee = String(paiement.facture.annee);
    const mois = String(
      paiement.facture.dateFacture.getMonth() + 1,
    ).padStart(2, "0");

    const numeroFacture =
      nettoyerNomFichier(paiement.facture.numeroFacture) ||
      `facture_${paiementId}`;

    const dossierRelatif = path.join(
      annee,
      mois,
      numeroFacture,
    );

    const dossierDestination = path.join(
      PAIEMENTS_UPLOAD_DIR,
      dossierRelatif,
    );

    await mkdir(dossierDestination, { recursive: true });

    const extension = EXT_AUTORISEES[fichier.type];
    const nomStocke = `${randomUUID()}${extension}`;

    const cheminRelatif = path.join(
      dossierRelatif,
      nomStocke,
    );

    const cheminComplet = path.join(
      PAIEMENTS_UPLOAD_DIR,
      cheminRelatif,
    );

    cheminCompletCree = cheminComplet;

    const buffer = Buffer.from(await fichier.arrayBuffer());

    await writeFile(cheminComplet, buffer);

    const document = await prisma.paiementDocument.create({
      data: {
        paiementId,
        nomFichierOriginal: fichier.name,
        nomFichierStocke: nomStocke,
        cheminFichier: cheminRelatif,
        typeMime: fichier.type,
        tailleFichier: fichier.size,
      },
      select: {
        id: true,
        nomFichierOriginal: true,
        typeMime: true,
        tailleFichier: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error) {
    console.error("[PAIEMENT_DOCUMENT_UPLOAD]", error);

    /*
     * Pour l'instant on laisse le fichier éventuel sur disque
     * si l'écriture BDD échoue.
     * La suppression automatique sera ajoutée avec la route DELETE
     * juste après afin de centraliser la logique fichier.
     */
    console.error(
      "[PAIEMENT_DOCUMENT_UPLOAD_PATH]",
      cheminCompletCree,
    );

    return NextResponse.json(
      { error: "Erreur serveur lors de l'ajout de la pièce jointe" },
      { status: 500 },
    );
  }
}