import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { normalizeReference } from "@/lib/ocr/reference-normalizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LignePayload = {
  reference?: string;
  designation?: string;
  quantite?: number | string;
  prixUnitaireTtc?: number | string;
  tauxTva?: number | string;
  totalTtc?: number | string;
  produitId?: number | null;
};

function toNumber(value: unknown, fallback = 0): number {
  const normalized = typeof value === "string" ? value.replace(",", ".") : value;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}

export async function POST(
  req: NextRequest,
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

    const body = await req.json();
    const lignes = Array.isArray(body?.lignes)
      ? (body.lignes as LignePayload[])
      : [];

    if (lignes.length === 0) {
      return NextResponse.json(
        { error: "Aucune ligne à valider" },
        { status: 400 },
      );
    }

    const document = await prisma.documentImporte.findUnique({
      where: { id: documentId },
      select: { id: true, fournisseurId: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document importé introuvable" },
        { status: 404 },
      );
    }

    const lignesValides = lignes
      .filter((ligne): ligne is LignePayload => Boolean(ligne))
      .map((ligne) => ({
        referenceDetectee: ligne.reference?.trim() || null,
        designation: ligne.designation?.trim() || "",
        quantite: toNumber(ligne.quantite),
        prixUnitaire: toNumber(ligne.prixUnitaireTtc),
        tauxTva: toNumber(ligne.tauxTva),
        montantTotal: toNumber(ligne.totalTtc),
        produitId:
          Number.isInteger(Number(ligne.produitId)) && Number(ligne.produitId) > 0
            ? Number(ligne.produitId)
            : null,
      }))
      .filter((ligne) => ligne.designation.length > 0);

    if (lignesValides.length === 0) {
      return NextResponse.json(
        { error: "Aucune ligne exploitable à enregistrer" },
        { status: 400 },
      );
    }

    let associationsMemorisees = 0;

    await prisma.$transaction(async (tx) => {
      await tx.ligneImportee.deleteMany({
        where: { documentImporteId: documentId },
      });

      await tx.ligneImportee.createMany({
        data: lignesValides.map((ligne) => ({
          documentImporteId: documentId,
          ...ligne,
          statut: ligne.produitId ? "associee" : "a_rapprocher",
        })),
      });

      for (const ligne of lignesValides) {
        if (!ligne.produitId || !ligne.referenceDetectee) continue;

        const referenceNormalisee = normalizeReference(ligne.referenceDetectee);
        if (!referenceNormalisee) continue;

        await tx.associationArticleFournisseur.upsert({
          where: {
            fournisseurId_referenceNormalisee: {
              fournisseurId: document.fournisseurId,
              referenceNormalisee,
            },
          },
          update: {
            produitId: ligne.produitId,
            referenceDetectee: ligne.referenceDetectee,
            designationDetectee: ligne.designation,
          },
          create: {
            fournisseurId: document.fournisseurId,
            produitId: ligne.produitId,
            referenceDetectee: ligne.referenceDetectee,
            referenceNormalisee,
            designationDetectee: ligne.designation,
          },
        });

        associationsMemorisees += 1;
      }

      await tx.documentImporte.update({
        where: { id: documentId },
        data: { statut: "lignes_validees" },
      });
    });

    return NextResponse.json({
      success: true,
      documentId,
      lignesEnregistrees: lignesValides.length,
      associationsMemorisees,
    });
  } catch (error) {
    console.error("[VALIDER_LIGNES_FACTURE_FOURNISSEUR]", error);

    return NextResponse.json(
      { error: "Erreur serveur lors de la validation des lignes" },
      { status: 500 },
    );
  }
}