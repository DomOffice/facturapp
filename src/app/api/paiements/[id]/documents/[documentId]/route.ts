import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { readFile, unlink } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const PAIEMENTS_UPLOAD_DIR =
  process.env.PAIEMENTS_UPLOAD_DIR ||
  path.join(process.cwd(), "uploads", "paiements");

function idValide(valeur: string) {
  const id = Number(valeur);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function cheminSecurise(cheminRelatif: string) {
  const dossierRacine = path.resolve(PAIEMENTS_UPLOAD_DIR);
  const cheminComplet = path.resolve(
    PAIEMENTS_UPLOAD_DIR,
    cheminRelatif,
  );

  const racineNormalisee =
    dossierRacine.toLowerCase() + path.sep;

  const fichierNormalise = cheminComplet.toLowerCase();

  if (!fichierNormalise.startsWith(racineNormalisee)) {
    throw new Error("Chemin de fichier invalide");
  }

  return cheminComplet;
}

async function recupererDocument(
  paiementId: number,
  documentId: number,
) {
  return prisma.paiementDocument.findFirst({
    where: {
      id: documentId,
      paiementId,
    },
  });
}

export async function GET(
  _req: NextRequest,
  {
    params,
  }: {
    params: {
      id: string;
      documentId: string;
    };
  },
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 },
      );
    }

    const paiementId = idValide(params.id);
    const documentId = idValide(params.documentId);

    if (!paiementId || !documentId) {
      return NextResponse.json(
        { error: "Identifiant invalide" },
        { status: 400 },
      );
    }

    const document = await recupererDocument(
      paiementId,
      documentId,
    );

    if (!document) {
      return NextResponse.json(
        { error: "Document introuvable" },
        { status: 404 },
      );
    }

    const cheminComplet = cheminSecurise(
      document.cheminFichier,
    );

    let contenu: Buffer;

    try {
      contenu = await readFile(cheminComplet);
    } catch {
      return NextResponse.json(
        {
          error:
            "Le document existe en base mais le fichier est introuvable sur le serveur",
        },
        { status: 404 },
      );
    }

    return new NextResponse(contenu as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          document.typeMime || "application/octet-stream",
        "Content-Length": String(contenu.length),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(
          document.nomFichierOriginal,
        )}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[PAIEMENT_DOCUMENT_GET]", error);

    return NextResponse.json(
      { error: "Erreur lors de l'ouverture du document" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  {
    params,
  }: {
    params: {
      id: string;
      documentId: string;
    };
  },
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 },
      );
    }

    const userRole = String(
      (session.user as { role?: string }).role || "",
    ).toLowerCase();

    if (!["admin", "saisie"].includes(userRole)) {
      return NextResponse.json(
        { error: "Accès refusé" },
        { status: 403 },
      );
    }

    const paiementId = idValide(params.id);
    const documentId = idValide(params.documentId);

    if (!paiementId || !documentId) {
      return NextResponse.json(
        { error: "Identifiant invalide" },
        { status: 400 },
      );
    }

    const document = await recupererDocument(
      paiementId,
      documentId,
    );

    if (!document) {
      return NextResponse.json(
        { error: "Document introuvable" },
        { status: 404 },
      );
    }

    const cheminComplet = cheminSecurise(
      document.cheminFichier,
    );

    try {
      await unlink(cheminComplet);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code !== "ENOENT") {
        throw error;
      }
    }

    await prisma.paiementDocument.delete({
      where: {
        id: document.id,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[PAIEMENT_DOCUMENT_DELETE]", error);

    return NextResponse.json(
      { error: "Erreur lors de la suppression du document" },
      { status: 500 },
    );
  }
}