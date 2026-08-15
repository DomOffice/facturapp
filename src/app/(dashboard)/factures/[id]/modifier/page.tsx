// src/app/(dashboard)/factures/[id]/modifier/page.tsx
export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/db/prisma";
import NouvelleFactureClient from "../../nouvelle/page-client";

export default async function ModifierFacturePage({
  params,
}: {
  params: { id: string };
}) {
  const facture = await prisma.facture.findUnique({
    where: { id: Number(params.id) },
    include: {
      lignes: {
        orderBy: { ordreLigne: "asc" },
        include: {
          produit: {
            select: {
              id: true,
              reference: true,
              description: true,
              prixVenteHt: true,
              dernierPrixAchatHt: true,
              tauxTva: { select: { valeurNum: true } },
            },
          },
        },
      },
      client: { select: { raisonSociale: true } },
    },
  });

  if (!facture) notFound();

  // Bloquer si validée
  if (facture.statut === "validee") {
    redirect(`/factures/${params.id}`);
  }

  const [clients, typesProduit, unites, tauxTva, fournisseurs] =
    await Promise.all([
      prisma.client.findMany({
        where: { actif: true },
        orderBy: { raisonSociale: "asc" },
        select: {
          id: true,
          raisonSociale: true,
        },
      }),

      prisma.parametre.findMany({
        where: {
          type: { code: "type_produit" },
          actif: true,
        },
        orderBy: { ordreAffichage: "asc" },
        select: {
          id: true,
          libelle: true,
        },
      }),

      prisma.parametre.findMany({
        where: {
          type: { code: "unite" },
          actif: true,
        },
        orderBy: { ordreAffichage: "asc" },
        select: {
          id: true,
          libelle: true,
        },
      }),

      prisma.parametre
        .findMany({
          where: {
            type: { code: "taux_tva" },
            actif: true,
          },
          orderBy: { ordreAffichage: "asc" },
          select: {
            id: true,
            libelle: true,
            valeurNum: true,
          },
        })
        .then((resultats) =>
          resultats.map((taux) => ({
            id: taux.id,
            libelle: taux.libelle,
            valeurNum:
              taux.valeurNum !== null ? Number(taux.valeurNum) : null,
          })),
        ),

      prisma.fournisseur
        .findMany({
          where: { actif: true },
          orderBy: { raisonSociale: "asc" },
          select: {
            id: true,
            raisonSociale: true,
          },
        })
        .then((resultats) =>
          resultats.map((fournisseur) => ({
            id: fournisseur.id,
            libelle: fournisseur.raisonSociale,
          })),
        ),
    ]);

  return (
    <NouvelleFactureClient
      clients={clients}
      prochainNumero={facture.numeroFacture}
      factureExistante={{
        id: facture.id,
        clientId: facture.clientId,
        dateFacture: facture.dateFacture.toISOString().split("T")[0],
        lignes: facture.lignes.map((l) => ({
          tempId: String(l.id),
          produitId: l.produitId,
          designation: l.designation,
          quantite: Number(l.quantite),
          prixAchatHt: Number(l.produit?.dernierPrixAchatHt ?? 0),
          prixUnitaireHt: Number(l.prixUnitaireHt),
          remisePourcentage: Number(l.remisePourcentage),
          tauxTva: Number(l.tauxTva),
          montantHt: Number(l.montantHt),
          montantTva: Number(l.montantTva),
          montantTtc: Number(l.montantTtc),
        })),
      }}
      typesProduit={typesProduit}
      unites={unites}
      tauxTva={tauxTva}
      fournisseurs={fournisseurs}
    />
  );
}