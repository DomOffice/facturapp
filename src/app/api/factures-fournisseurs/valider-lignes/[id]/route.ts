import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
  const normalized =
    typeof value === "string" ? value.replace(",", ".") : value;

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

    const documentId = Number(params.id);

    if (!Number.isInteger(documentId) || documentId <= 0) {
      return NextResponse.json(
        { error: "Document invalide" },
        { status: 400 },
      );
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
          Number.isInteger(Number(ligne.produitId)) &&
          Number(ligne.produitId) > 0
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

    /*
     * Toutes les lignes doivent être rapprochées avant
     * l'intégration au stock.
     */
    const lignesSansProduit = lignesValides.filter(
      (ligne) => !ligne.produitId,
    );

    if (lignesSansProduit.length > 0) {
      return NextResponse.json(
        {
          error:
            `${lignesSansProduit.length} ligne(s) ne sont pas rapprochée(s). ` +
            "Associez chaque ligne à un produit existant ou créez un nouveau produit avant la validation.",

          lignesSansProduit: lignesSansProduit.map((ligne) => ({
            reference: ligne.referenceDetectee,
            designation: ligne.designation,
          })),
        },
        { status: 400 },
      );
    }

    /*
     * Une entrée de stock doit obligatoirement avoir une
     * quantité strictement positive.
     */
    const lignesQuantiteInvalide = lignesValides.filter(
      (ligne) => ligne.quantite <= 0,
    );

    if (lignesQuantiteInvalide.length > 0) {
      return NextResponse.json(
        {
          error:
            `${lignesQuantiteInvalide.length} ligne(s) ont une quantité ` +
            "nulle ou négative. Corrigez les quantités avant la validation.",
        },
        { status: 400 },
      );
    }

    /*
     * Vérification préalable de l'existence des produits.
     */
    const produitIds = Array.from(
  new Set(
    lignesValides.map((ligne) => ligne.produitId as number),
  ),
);

    const produitsExistants = await prisma.produit.findMany({
      where: {
        id: { in: produitIds },
        actif: true,
      },
      select: {
        id: true,
      },
    });

    const idsExistants = new Set(
      produitsExistants.map((produit) => produit.id),
    );

    const idsInvalides = produitIds.filter(
      (produitId) => !idsExistants.has(produitId),
    );

    if (idsInvalides.length > 0) {
      return NextResponse.json(
        {
          error:
            "Certains produits sont introuvables ou inactifs : " +
            idsInvalides.join(", "),
        },
        { status: 400 },
      );
    }

    const utilisateurIdRaw = (
      session.user as {
        id?: string | number;
      }
    ).id;

    const utilisateurId = Number(utilisateurIdRaw);

    const utilisateurIdValide =
      Number.isInteger(utilisateurId) && utilisateurId > 0
        ? utilisateurId
        : null;

    /*
     * Toute l'opération est atomique :
     *
     * soit tout est enregistré,
     * soit rien ne l'est.
     */
    const resultat = await prisma.$transaction(async (tx) => {
      const document = await tx.documentImporte.findUnique({
        where: {
          id: documentId,
        },
        select: {
          id: true,
          fournisseurId: true,

          integrationStock: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!document) {
        throw new Error("DOCUMENT_INTROUVABLE");
      }

      if (document.integrationStock) {
        throw new Error("DOCUMENT_DEJA_INTEGRE");
      }

      /*
       * La contrainte unique sur documentImporteId constitue
       * la protection principale contre une double intégration.
       */
      const integration = await tx.integrationStock.create({
        data: {
          documentImporteId: documentId,
          utilisateurId: utilisateurIdValide,
        },
      });

      /*
       * On remplace les anciennes lignes OCR par les lignes
       * corrigées actuellement affichées.
       */
      await tx.ligneImportee.deleteMany({
        where: {
          documentImporteId: documentId,
        },
      });

      let associationsMemorisees = 0;
      let mouvementsCrees = 0;

      let quantiteTotaleIntegree = new Prisma.Decimal(0);

      for (const ligne of lignesValides) {
        const produitId = ligne.produitId as number;
        const quantite = new Prisma.Decimal(ligne.quantite);

        /*
         * Enregistrement de la ligne validée.
         */
        const ligneImportee = await tx.ligneImportee.create({
          data: {
            documentImporteId: documentId,
            referenceDetectee: ligne.referenceDetectee,
            designation: ligne.designation,
            quantite,
            prixUnitaire: new Prisma.Decimal(
              ligne.prixUnitaire,
            ),
            tauxTva: new Prisma.Decimal(ligne.tauxTva),
            montantTotal: new Prisma.Decimal(
              ligne.montantTotal,
            ),
            produitId,
            statut: "integree_stock",
          },
        });

        /*
         * Mémorisation de l'association fournisseur-produit.
         */
        if (ligne.referenceDetectee) {
          const referenceNormalisee = normalizeReference(
            ligne.referenceDetectee,
          );

          if (referenceNormalisee) {
            await tx.associationArticleFournisseur.upsert({
              where: {
                fournisseurId_referenceNormalisee: {
                  fournisseurId: document.fournisseurId,
                  referenceNormalisee,
                },
              },

              update: {
                produitId,
                referenceDetectee:
                  ligne.referenceDetectee,
                designationDetectee:
                  ligne.designation,
              },

              create: {
                fournisseurId:
                  document.fournisseurId,
                produitId,
                referenceDetectee:
                  ligne.referenceDetectee,
                referenceNormalisee,
                designationDetectee:
                  ligne.designation,
              },
            });

            associationsMemorisees += 1;
          }
        }

        /*
         * Augmentation atomique du stock courant.
         */
        const produitMisAJour =
          await tx.produit.update({
            where: {
              id: produitId,
            },

            data: {
              stockActuel: {
                increment: quantite,
              },
            },

            select: {
              stockActuel: true,
            },
          });

        const stockApres =
          produitMisAJour.stockActuel;

        const stockAvant =
          stockApres.minus(quantite);

        /*
         * Création de la trace détaillée du mouvement.
         */
        await tx.mouvementStock.create({
          data: {
            integrationStockId:
              integration.id,

            produitId,
            ligneImporteeId:
              ligneImportee.id,

            type: "entree_fournisseur",
            quantite,
            stockAvant,
            stockApres,
          },
        });

        quantiteTotaleIntegree =
          quantiteTotaleIntegree.plus(quantite);

        mouvementsCrees += 1;
      }

      /*
       * Le document est désormais définitivement intégré.
       */
      await tx.documentImporte.update({
        where: {
          id: documentId,
        },
        data: {
          statut: "stock_integre",
        },
      });

      return {
        integrationStockId: integration.id,
        lignesEnregistrees: lignesValides.length,
        mouvementsCrees,
        associationsMemorisees,

        quantiteTotaleIntegree:
          quantiteTotaleIntegree.toString(),
      };
    });

    return NextResponse.json({
      success: true,
      documentId,
      statut: "stock_integre",
      ...resultat,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "DOCUMENT_INTROUVABLE"
    ) {
      return NextResponse.json(
        { error: "Document importé introuvable" },
        { status: 404 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "DOCUMENT_DEJA_INTEGRE"
    ) {
      return NextResponse.json(
        {
          error:
            "Ce document a déjà été validé et intégré au stock.",
        },
        { status: 409 },
      );
    }

    /*
     * P2002 correspond notamment à une violation de contrainte
     * unique. Cela protège aussi contre deux clics simultanés.
     */
    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error:
            "Ce document a déjà été intégré au stock.",
        },
        { status: 409 },
      );
    }

    console.error(
      "[VALIDER_LIGNES_ET_STOCK_FOURNISSEUR]",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Erreur serveur lors de la validation et de l’intégration au stock.",
      },
      { status: 500 },
    );
  }
}