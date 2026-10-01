// src/app/api/bl/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const statut = searchParams.get("statut");

    const bonsLivraison = await prisma.bonLivraison.findMany({
      where: {
        ...(clientId ? { clientId: Number(clientId) } : {}),
        ...(statut ? { statut } : {}),
      },
      include: {
        client: {
          select: {
            id: true,
            raisonSociale: true,
            ville: true,
            telephone: true,
          },
        },
        lignes: {
          include: {
            produit: {
              select: { id: true, reference: true, description: true },
            },
          },
          orderBy: { ordreLigne: "asc" },
        },
      },
      orderBy: { dateLivraison: "desc" },
    });

    return NextResponse.json(bonsLivraison);
  } catch (error) {
    console.error("Erreur GET /api/bl :", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des bons de livraison" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, dateLivraison, remarque, lignes } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: "Le client est obligatoire." },
        { status: 400 },
      );
    }

    if (!lignes || !Array.isArray(lignes) || lignes.length === 0) {
      return NextResponse.json(
        { error: "Le bon de livraison doit comporter au moins un article." },
        { status: 400 },
      );
    }

    const annee = new Date(dateLivraison || Date.now()).getFullYear();

    // Transaction pour garantir une séquence unique sans doublon
    const nouveauBL = await prisma.$transaction(async (tx) => {
      // Recherche du dernier numéro de séquence pour l'année en cours
      const dernierBL = await tx.bonLivraison.findFirst({
        where: { annee },
        orderBy: { numeroSequence: "desc" },
        select: { numeroSequence: true },
      });

      const numeroSequence = (dernierBL?.numeroSequence ?? 0) + 1;
      const numeroBl = `BL-${annee}-${String(numeroSequence).padStart(4, "0")}`;

      return tx.bonLivraison.create({
        data: {
          annee,
          numeroSequence,
          numeroBl,
          clientId: Number(clientId),
          dateLivraison: dateLivraison ? new Date(dateLivraison) : new Date(),
          remarque: remarque || null,
          statut: "livre",
          lignes: {
            create: lignes.map(
              (
                ligne: {
                  produitId?: number;
                  designation: string;
                  quantite: number;
                },
                index: number,
              ) => ({
                ordreLigne: index + 1,
                produitId: ligne.produitId ? Number(ligne.produitId) : null,
                designation: ligne.designation.trim(),
                quantite: Number(ligne.quantite) || 1,
              }),
            ),
          },
        },
        include: {
          client: true,
          lignes: true,
        },
      });
    });

    return NextResponse.json(nouveauBL, { status: 201 });
  } catch (error) {
    console.error("Erreur POST /api/bl :", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du bon de livraison." },
      { status: 500 },
    );
  }
}
