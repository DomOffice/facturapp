import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";

export async function GET() {
  try {
    const [typesProduit, unites, tauxTva, fournisseurs] = await Promise.all([
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

    return NextResponse.json({
      typesProduit,
      unites,
      tauxTva,
      fournisseurs,
    });
  } catch (error) {
    console.error("[OPTIONS_PRODUIT]", error);

    return NextResponse.json(
      {
        error: "Impossible de charger les options du formulaire produit.",
      },
      { status: 500 },
    );
  }
}