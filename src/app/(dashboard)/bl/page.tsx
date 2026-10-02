// src/app/(dashboard)/bl/page.tsx
import prisma from "@/lib/db/prisma";
import BonsLivraisonClient from "./page-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bons de livraison | FacturApp",
};

export default async function BonsLivraisonPage() {
  const [bonsLivraison, clients] = await Promise.all([
    prisma.bonLivraison.findMany({
      include: {
        client: {
          select: { id: true, raisonSociale: true, ville: true },
        },
        lignes: {
          include: {
            produit: {
              select: { id: true, reference: true, description: true },
            },
          },
          orderBy: { ordreLigne: "asc" },
        },
        facture: {
          select: { id: true, numeroFacture: true },
        },
      },
      orderBy: { dateLivraison: "desc" },
    }),
    prisma.client.findMany({
      where: { actif: true },
      select: { id: true, raisonSociale: true },
      orderBy: { raisonSociale: "asc" },
    }),
  ]);

  // Sérialisation des types Prisma pour le composant client
  const bonsLivraisonFormates = bonsLivraison.map((bl) => ({
    ...bl,
    estIncomplet: Boolean(bl.estIncomplet),
    articlesManquants: bl.articlesManquants ?? null,
    dateLivraison: bl.dateLivraison.toISOString(),
    createdAt: bl.createdAt.toISOString(),
    updatedAt: bl.updatedAt.toISOString(),
    lignes: bl.lignes.map((l) => ({
      ...l,
      quantite: Number(l.quantite),
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    })),
  }));

  return (
    <BonsLivraisonClient
      bonsLivraisonInitiaux={bonsLivraisonFormates}
      clients={clients}
    />
  );
}
