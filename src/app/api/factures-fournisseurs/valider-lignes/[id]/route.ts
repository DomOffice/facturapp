import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
  prixAchatHtFacture?: number | string;
  prixAchatTtcFacture?: number | string;
  mettreAJourPrixProduit?: boolean;
};

type TraitementDocument = {
  integreStock: boolean;
  comptabiliseTva: boolean;
  rapprochementObligatoire: boolean;
  metAJourPrixAchat: boolean;
};

function toNumber(value: unknown, fallback = 0): number {
  const normalized =
    typeof value === "string" ? value.replace(",", ".") : value;

  const number = Number(normalized);

  return Number.isFinite(number) ? number : fallback;
}

function arrondirMontant(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculerMontantTvaDepuisTtc(
  montantTtc: number,
  tauxTva: number,
): number {
  if (
    !Number.isFinite(montantTtc) ||
    montantTtc <= 0 ||
    !Number.isFinite(tauxTva) ||
    tauxTva <= 0
  ) {
    return 0;
  }

  const coefficientTva = 1 + tauxTva / 100;
  const montantHt = montantTtc / coefficientTva;

  return arrondirMontant(montantTtc - montantHt);
}

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

function lireExtraction(
  donneesExtraites: unknown,
): Record<string, unknown> | null {
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

  return extraction as Record<string, unknown>;
}

function lireTraitementDocument(donneesExtraites: unknown): TraitementDocument {
  const extraction = lireExtraction(donneesExtraites);

  const profilOcr =
    typeof extraction?.profilOcr === "string"
      ? extraction.profilOcr.toLowerCase()
      : "";

  const typeDocument =
    typeof extraction?.typeDocument === "string"
      ? extraction.typeDocument.toLowerCase()
      : "";

  const estMechouar =
    profilOcr === "mechouar" || profilOcr === "mechouar_facture";

  const estFactureMechouar =
    profilOcr === "mechouar_facture" ||
    (estMechouar && typeDocument === "facture");

  if (estFactureMechouar) {
    return {
      integreStock: false,
      comptabiliseTva: true,
      rapprochementObligatoire: false,
      metAJourPrixAchat: false,
    };
  }

  if (estMechouar) {
    return {
      integreStock: true,
      comptabiliseTva: false,
      rapprochementObligatoire: true,
      metAJourPrixAchat: true,
    };
  }

  return {
    integreStock: true,
    comptabiliseTva: true,
    rapprochementObligatoire: true,
    metAJourPrixAchat: true,
  };
}
function normaliserNumeroFacture(numeroFacture: string): string {
  return numeroFacture
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
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

    const autoriserReintegration = body?.autoriserReintegration === true;

    const autoriserValidationSansRapprochement =
      body?.autoriserValidationSansRapprochement === true;

    const lignes = Array.isArray(body?.lignes)
      ? (body.lignes as LignePayload[])
      : [];

    const documentContexte = await prisma.documentImporte.findUnique({
      where: {
        id: documentId,
      },
      select: {
        id: true,
        statut: true,
        donneesExtraites: true,

        integrationStock: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!documentContexte) {
      return NextResponse.json(
        { error: "Document importé introuvable" },
        { status: 404 },
      );
    }

    const traitement = lireTraitementDocument(
      documentContexte.donneesExtraites,
    );

    if (lignes.length === 0) {
      return NextResponse.json(
        { error: "Aucune ligne à valider" },
        { status: 400 },
      );
    }

    const lignesValides = lignes
      .filter((ligne): ligne is LignePayload => Boolean(ligne))
      .map((ligne) => {
        const tauxTva = toNumber(ligne.tauxTva);
        const montantTotal = toNumber(ligne.totalTtc);

        return {
          referenceDetectee: ligne.reference?.trim() || null,
          designation: ligne.designation?.trim() || "",
          quantite: toNumber(ligne.quantite),
          prixUnitaire: toNumber(ligne.prixUnitaireTtc),
          tauxTva,
          montantTva: calculerMontantTvaDepuisTtc(montantTotal, tauxTva),
          montantTotal,

          produitId:
            Number.isInteger(Number(ligne.produitId)) &&
            Number(ligne.produitId) > 0
              ? Number(ligne.produitId)
              : null,

          prixAchatHtFacture:
            ligne.prixAchatHtFacture === undefined ||
            ligne.prixAchatHtFacture === null
              ? null
              : toNumber(ligne.prixAchatHtFacture),

          prixAchatTtcFacture:
            ligne.prixAchatTtcFacture === undefined ||
            ligne.prixAchatTtcFacture === null
              ? null
              : toNumber(ligne.prixAchatTtcFacture),

          mettreAJourPrixProduit: ligne.mettreAJourPrixProduit === true,
        };
      })
      .filter((ligne) => ligne.designation.length > 0);

    if (lignesValides.length === 0) {
      return NextResponse.json(
        { error: "Aucune ligne exploitable à enregistrer" },
        { status: 400 },
      );
    }

    /*
     * Toutes les lignes doivent normalement être rapprochées avant
     * l'intégration au stock.
     *
     * Le forçage permet de conserver les lignes non rapprochées,
     * mais elles ne doivent produire aucun mouvement de stock.
     */
    const lignesSansProduit = lignesValides.filter((ligne) => !ligne.produitId);

    if (
      traitement.rapprochementObligatoire &&
      lignesSansProduit.length > 0 &&
      !autoriserValidationSansRapprochement
    ) {
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

    const lignesAvecProduit = lignesValides.filter(
      (ligne): ligne is typeof ligne & { produitId: number } =>
        typeof ligne.produitId === "number" &&
        Number.isInteger(ligne.produitId) &&
        ligne.produitId > 0,
    );

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
        lignesValides
          .map((ligne) => ligne.produitId)
          .filter(
            (produitId): produitId is number =>
              typeof produitId === "number" &&
              Number.isInteger(produitId) &&
              produitId > 0,
          ),
      ),
    );

    const produitsExistants = await prisma.produit.findMany({
      where: {
        id: { in: produitIds },
        actif: true,
      },
      select: {
        id: true,

        tauxTva: {
          select: {
            valeurNum: true,
          },
        },
      },
    });

    const idsExistants = new Set(
      produitsExistants.map((produit) => produit.id),
    );

    const tauxTvaParProduit = new Map<number, number>();

    for (const produit of produitsExistants) {
      const tauxTvaProduit = Number(produit.tauxTva?.valeurNum);

      /*
       * Lorsqu'aucune TVA n'est configurée sur le produit,
       * on utilise 20 % par défaut.
       */
      tauxTvaParProduit.set(
        produit.id,
        Number.isFinite(tauxTvaProduit) && tauxTvaProduit >= 0
          ? tauxTvaProduit
          : 20,
      );
    }

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

    const misesAJourPrixParProduit = new Map<
      number,
      {
        prixAchatHt: number | null;
        prixAchatTtc: number | null;
      }
    >();

    for (const ligne of lignesValides) {
      if (
        !traitement.metAJourPrixAchat ||
        !ligne.produitId ||
        ligne.mettreAJourPrixProduit !== true
      ) {
        continue;
      }

      const prixAchatTtc =
        ligne.prixAchatTtcFacture !== null &&
        Number.isFinite(ligne.prixAchatTtcFacture)
          ? ligne.prixAchatTtcFacture
          : null;

      /*
       * La TVA utilisée vient de la fiche produit en BDD.
       * Si aucune TVA n'est configurée, tauxTvaParProduit
       * contient déjà la valeur par défaut de 20 %.
       */
      const tauxTvaProduit = tauxTvaParProduit.get(ligne.produitId) ?? 20;

      const coefficientTva = 1 + tauxTvaProduit / 100;

      /*
       * Pour Mechouar, le prix OCR est TTC.
       * Le HT est recalculé avec la TVA de la fiche produit.
       *
       * Exemple :
       * TTC = 120 MAD
       * TVA produit = 20 %
       * HT = 120 / 1,20 = 100 MAD
       */
      const prixAchatHt =
        prixAchatTtc !== null && coefficientTva > 0
          ? arrondirMontant(prixAchatTtc / coefficientTva)
          : ligne.prixAchatHtFacture !== null &&
              Number.isFinite(ligne.prixAchatHtFacture)
            ? ligne.prixAchatHtFacture
            : null;

      if (prixAchatHt === null && prixAchatTtc === null) {
        continue;
      }

      /*
       * Si le même produit apparaît plusieurs fois,
       * la dernière ligne de la facture est retenue.
       */
      misesAJourPrixParProduit.set(ligne.produitId, {
        prixAchatHt,
        prixAchatTtc,
      });
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
          statut: true,
          donneesExtraites: true,

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

      const traitementTransaction = lireTraitementDocument(
        document.donneesExtraites,
      );

      if (traitementTransaction.integreStock && document.integrationStock) {
        throw new Error("DOCUMENT_DEJA_INTEGRE");
      }

      if (!traitementTransaction.integreStock && document.statut === "valide") {
        throw new Error("DOCUMENT_DEJA_VALIDE");
      }

      const numeroFacture = lireNumeroFacture(document.donneesExtraites);

      if (numeroFacture && !autoriserReintegration) {
        const numeroFactureNormalise = normaliserNumeroFacture(numeroFacture);

        const documentsDejaIntegres = await tx.documentImporte.findMany({
          where: {
            id: {
              not: documentId,
            },

            fournisseurId: document.fournisseurId,

            integrationStock: {
              isNot: null,
            },
          },

          select: {
            id: true,
            donneesExtraites: true,
          },
        });

        const factureDejaIntegree = documentsDejaIntegres.some(
          (documentExistant) => {
            const numeroExistant = lireNumeroFacture(
              documentExistant.donneesExtraites,
            );

            return (
              numeroExistant !== null &&
              normaliserNumeroFacture(numeroExistant) === numeroFactureNormalise
            );
          },
        );

        if (factureDejaIntegree) {
          throw new Error("FACTURE_DEJA_INTEGREE");
        }
      }

      if (!traitementTransaction.integreStock) {
        await tx.ligneImportee.deleteMany({
          where: {
            documentImporteId: documentId,
          },
        });

        for (const ligne of lignesValides) {
          await tx.ligneImportee.create({
            data: {
              documentImporteId: documentId,
              referenceDetectee: ligne.referenceDetectee,
              designation: ligne.designation,
              quantite: new Prisma.Decimal(ligne.quantite),
              prixUnitaire: new Prisma.Decimal(ligne.prixUnitaire),
              tauxTva: new Prisma.Decimal(ligne.tauxTva),
              montantTva: new Prisma.Decimal(ligne.montantTva),
              montantTotal: new Prisma.Decimal(ligne.montantTotal),

              // Le rapprochement reste facultatif.
              produitId: ligne.produitId,

              // Cette ligne est validée mais n’a pas été intégrée au stock.
              statut: "validee_sans_stock",
            },
          });
        }

        await tx.documentImporte.update({
          where: {
            id: documentId,
          },
          data: {
            statut: "valide",
          },
        });

        return {
          integrationStockId: null,
          lignesEnregistrees: lignesValides.length,
          mouvementsCrees: 0,
          associationsMemorisees: 0,
          quantiteTotaleIntegree: "0",
          integreStock: false,
          comptabiliseTva: traitementTransaction.comptabiliseTva,
        };
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

      /*
       * Empêche de mettre plusieurs fois à jour le prix
       * lorsqu'un même produit apparaît sur plusieurs lignes.
       */
      const prixProduitsDejaMisAJour = new Set<number>();

      for (const ligne of lignesAvecProduit) {
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
            prixUnitaire: new Prisma.Decimal(ligne.prixUnitaire),
            tauxTva: new Prisma.Decimal(ligne.tauxTva),
            montantTva: new Prisma.Decimal(ligne.montantTva),
            montantTotal: new Prisma.Decimal(ligne.montantTotal),
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
                referenceDetectee: ligne.referenceDetectee,
                designationDetectee: ligne.designation,
              },

              create: {
                fournisseurId: document.fournisseurId,
                produitId,
                referenceDetectee: ligne.referenceDetectee,
                referenceNormalisee,
                designationDetectee: ligne.designation,
              },
            });

            associationsMemorisees += 1;
          }
        }

        /*
         * Augmentation atomique du stock courant.
         */
        const miseAJourPrix = prixProduitsDejaMisAJour.has(produitId)
          ? undefined
          : misesAJourPrixParProduit.get(produitId);

        const produitMisAJour = await tx.produit.update({
          where: {
            id: produitId,
          },

          data: {
            stockActuel: {
              increment: quantite,
            },

            ...(miseAJourPrix
              ? {
                  ...(miseAJourPrix.prixAchatHt !== null
                    ? {
                        dernierPrixAchatHt: new Prisma.Decimal(
                          miseAJourPrix.prixAchatHt,
                        ),
                      }
                    : {}),

                  ...(miseAJourPrix.prixAchatTtc !== null
                    ? {
                        dernierPrixAchatTtc: new Prisma.Decimal(
                          miseAJourPrix.prixAchatTtc,
                        ),
                      }
                    : {}),
                }
              : {}),
          },

          select: {
            stockActuel: true,
          },
        });

        /*
         * Le prix vient d'être appliqué à ce produit.
         * Les éventuelles lignes suivantes ne modifieront que le stock.
         */
        if (miseAJourPrix) {
          prixProduitsDejaMisAJour.add(produitId);
        }

        const stockApres = produitMisAJour.stockActuel;
        const stockAvant = stockApres.minus(quantite);

        /*
         * Création de la trace détaillée du mouvement.
         */
        await tx.mouvementStock.create({
          data: {
            integrationStockId: integration.id,

            produitId,
            ligneImporteeId: ligneImportee.id,

            type: "entree_fournisseur",
            quantite,
            stockAvant,
            stockApres,
          },
        });

        quantiteTotaleIntegree = quantiteTotaleIntegree.plus(quantite);

        mouvementsCrees += 1;
      }

      /*
       * Lorsque la validation sans rapprochement a été forcée,
       * les lignes concernées sont conservées à titre documentaire,
       * sans mouvement ni modification du stock.
       */
      for (const ligne of lignesSansProduit) {
        await tx.ligneImportee.create({
          data: {
            documentImporteId: documentId,
            referenceDetectee: ligne.referenceDetectee,
            designation: ligne.designation,
            quantite: new Prisma.Decimal(ligne.quantite),
            prixUnitaire: new Prisma.Decimal(ligne.prixUnitaire),
            tauxTva: new Prisma.Decimal(ligne.tauxTva),
            montantTva: new Prisma.Decimal(ligne.montantTva),
            montantTotal: new Prisma.Decimal(ligne.montantTotal),
            produitId: null,
            statut: "validee_sans_stock",
          },
        });
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
        lignesIntegreesStock: lignesAvecProduit.length,
        lignesSansRapprochement: lignesSansProduit.length,
        mouvementsCrees,
        associationsMemorisees,
        quantiteTotaleIntegree: quantiteTotaleIntegree.toString(),
        integreStock: true,
      };
    });

    revalidatePath("/produits");
    revalidatePath("/factures-fournisseurs");

    return NextResponse.json({
      success: true,
      documentId,
      statut: resultat.integreStock === false ? "valide" : "stock_integre",
      ...resultat,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FACTURE_DEJA_INTEGREE") {
      return NextResponse.json(
        {
          error:
            "Une facture portant ce numéro a déjà été intégrée pour ce fournisseur. " +
            "Cochez l’option de développement uniquement si vous souhaitez volontairement la réintégrer.",
          code: "FACTURE_DEJA_INTEGREE",
        },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message === "DOCUMENT_INTROUVABLE") {
      return NextResponse.json(
        { error: "Document importé introuvable" },
        { status: 404 },
      );
    }

    if (error instanceof Error && error.message === "DOCUMENT_DEJA_INTEGRE") {
      return NextResponse.json(
        {
          error: "Ce document a déjà été validé et intégré au stock.",
        },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message === "DOCUMENT_DEJA_VALIDE") {
      return NextResponse.json(
        {
          error: "Ce document a déjà été validé.",
        },
        { status: 409 },
      );
    }
    /*
     * P2002 correspond notamment à une violation de contrainte
     * unique. Cela protège aussi contre deux clics simultanés.
     */
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: "Ce document a déjà été intégré au stock.",
        },
        { status: 409 },
      );
    }

    console.error("[VALIDER_DOCUMENT_FOURNISSEUR]", error);

    return NextResponse.json(
      {
        error: "Erreur serveur lors de la validation du document fournisseur.",
      },
      { status: 500 },
    );
  }
}
