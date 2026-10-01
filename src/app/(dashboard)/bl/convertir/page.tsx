// src/app/(dashboard)/bl/convertir/page.tsx
import prisma from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import PageClientConvertir from "./page-client";

export const metadata = {
  title: "Convertir BL en Facture | FacturApp",
};

export default async function ConvertirBlPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const resolvedParams = await searchParams;
  const idsStr = resolvedParams?.ids;

  if (!idsStr) {
    redirect("/bl");
  }

  const ids = idsStr
    .split(",")
    .map(Number)
    .filter((n) => !isNaN(n));

  if (ids.length === 0) {
    redirect("/bl");
  }

  const bonsLivraison = await prisma.bonLivraison.findMany({
    where: { id: { in: ids }, statut: "livre" },
    include: {
      client: true,
      lignes: {
        include: {
          produit: {
            select: {
              id: true,
              reference: true,
              description: true,
              prixVenteHt: true,
            },
          },
        },
      },
    },
  });

  if (bonsLivraison.length === 0) {
    redirect("/bl");
  }

  const serializedBl = bonsLivraison.map((bl) => ({
    id: bl.id,
    numeroBl: bl.numeroBl,
    clientId: bl.clientId,
    client: {
      id: bl.client.id,
      raisonSociale: bl.client.raisonSociale,
    },
    lignes: bl.lignes.map((l) => ({
      id: l.id,
      produitId: l.produitId,
      designation: l.designation,
      quantite: Number(l.quantite),
      produit: l.produit
        ? {
            id: l.produit.id,
            reference: l.produit.reference,
            description: l.produit.description,
            prixVenteHt: Number(l.produit.prixVenteHt),
          }
        : null,
    })),
  }));

  return <PageClientConvertir bonsLivraison={serializedBl} />;
}