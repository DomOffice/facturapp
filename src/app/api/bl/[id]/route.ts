// src/app/api/bl/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const blId = Number(id);

    const bonLivraison = await prisma.bonLivraison.findUnique({
      where: { id: blId },
      include: {
        client: true,
        lignes: {
          include: { produit: true },
          orderBy: { ordreLigne: "asc" },
        },
        facture: true,
      },
    });

    if (!bonLivraison) {
      return NextResponse.json({ error: "Bon de livraison introuvable." }, { status: 404 });
    }

    return NextResponse.json(bonLivraison);
  } catch (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const blId = Number(id);
    const body = await request.json();
    const { clientId, dateLivraison, remarque, lignes } = body;

    const blExistant = await prisma.bonLivraison.findUnique({
      where: { id: blId },
    });

    if (!blExistant) {
      return NextResponse.json({ error: "Bon de livraison introuvable." }, { status: 404 });
    }

    if (blExistant.statut === "facture" || blExistant.factureId) {
      return NextResponse.json(
        { error: "Ce bon de livraison est déjà facturé. Toute modification doit se faire au niveau de la facture." },
        { status: 400 }
      );
    }

    const blMisAJour = await prisma.$transaction(async (tx) => {
      // Suppression des anciennes lignes
      await tx.bonLivraisonLigne.deleteMany({
        where: { bonLivraisonId: blId },
      });

      // Mise à jour de l'en-tête et recréation des lignes
      return tx.bonLivraison.update({
        where: { id: blId },
        data: {
          clientId: Number(clientId),
          dateLivraison: new Date(dateLivraison),
          remarque: remarque || null,
          lignes: {
            create: lignes.map((l: any, index: number) => ({
              ordreLigne: index + 1,
              produitId: l.produitId ? Number(l.produitId) : null,
              designation: l.designation.trim(),
              quantite: Number(l.quantite) || 1,
            })),
          },
        },
        include: { lignes: true },
      });
    });

    return NextResponse.json(blMisAJour);
  } catch (error) {
    console.error("Erreur PUT /api/bl/[id] :", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour du BL." }, { status: 500 });
  }
}