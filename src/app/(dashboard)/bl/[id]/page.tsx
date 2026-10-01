// src/app/(dashboard)/bl/[id]/page.tsx
import prisma from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import FormEditionBl from "./page-client";

export const metadata = {
  title: "Modifier Bon de Livraison | FacturApp",
};

export default async function EditionBlPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const blId = Number(id);

  const [bl, clients, produits] = await Promise.all([
    prisma.bonLivraison.findUnique({
      where: { id: blId },
      include: {
        lignes: { orderBy: { ordreLigne: "asc" } },
        facture: true,
      },
    }),
    prisma.client.findMany({
      where: { actif: true },
      select: { id: true, raisonSociale: true, ville: true },
      orderBy: { raisonSociale: "asc" },
    }),
    prisma.produit.findMany({
      where: { actif: true },
      select: { id: true, reference: true, description: true },
      orderBy: { description: "asc" },
    }),
  ]);

  if (!bl) notFound();

  const blFormate = {
    ...bl,
    dateLivraison: bl.dateLivraison.toISOString().split("T")[0],
    lignes: bl.lignes.map((l) => ({
      ...l,
      quantite: Number(l.quantite),
    })),
  };

  return (
    <FormEditionBl
      blInitial={blFormate}
      clientsInitiaux={clients}
      produitsInitiaux={produits}
    />
  );
}