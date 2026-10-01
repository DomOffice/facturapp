// src/app/(dashboard)/bl/nouveau/page.tsx
import prisma from "@/lib/db/prisma";
import FormNouveauBlMobile from "./page-client";

export const metadata = {
  title: "Nouveau Bon de Livraison | FacturApp",
};

export default async function NouveauBlPage() {
  const [clients, produits] = await Promise.all([
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

  return (
    <FormNouveauBlMobile
      clientsInitiaux={clients}
      produitsInitiaux={produits}
    />
  );
}
