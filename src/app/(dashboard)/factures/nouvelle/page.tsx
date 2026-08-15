// src/app/(dashboard)/factures/nouvelle/page.tsx
import prisma from "@/lib/db/prisma";
import { prochainNumeroFacture } from "@/lib/business/numerotation";
import NouvelleFactureClient from "./page-client";

export const dynamic = "force-dynamic";

export default async function NouvelleFacturePage() {
  const [
    clients,
    { numeroFacture },
    typesProduit,
    unites,
    tauxTva,
    fournisseurs,
  ] = await Promise.all([
    prisma.client.findMany({
      where: { actif: true },
      orderBy: { raisonSociale: "asc" },
      select: { id: true, raisonSociale: true },
    }),

    prochainNumeroFacture(),

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
      prochainNumero={numeroFacture}
      typesProduit={typesProduit}
      unites={unites}
      tauxTva={tauxTva}
      fournisseurs={fournisseurs}
    />
  );
}