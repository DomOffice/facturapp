// src/app/api/bl/convertir/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { blIds, clientId, dateFacture, lignes } = body;

    if (!blIds || !Array.isArray(blIds) || blIds.length === 0) {
      return NextResponse.json(
        { error: "Veuillez sélectionner au moins un bon de livraison." },
        { status: 400 }
      );
    }

    if (!clientId || !lignes || !Array.isArray(lignes) || lignes.length === 0) {
      return NextResponse.json(
        { error: "Données de facturation incomplètes." },
        { status: 400 }
      );
    }

    const dateFact = dateFacture ? new Date(dateFacture) : new Date();
    const annee = dateFact.getFullYear();

    const resultat = await prisma.$transaction(async (tx) => {
      // 1. Récupération du prochain numéro de facture pour l'année
      const derniereFacture = await tx.facture.findFirst({
        where: { annee },
        orderBy: { numeroSequence: "desc" },
        select: { numeroSequence: true },
      });

      const numeroSequence = (derniereFacture?.numeroSequence ?? 0) + 1;
      const numeroFacture = `FA${annee}/${String(numeroSequence).padStart(5, "0")}`;

      // 2. Calcul des totaux financiers de la facture
      let totalHt = 0;
      let totalTva = 0;
      let totalTtc = 0;
      let totalArticles = 0;

      const lignesFactureData = lignes.map((l: any, index: number) => {
        const qte = Number(l.quantite) || 1;
        const puHt = Number(l.prixUnitaireHt) || 0;
        const tauxTva = Number(l.tauxTva) || 20;
        const montantHt = Number((qte * puHt).toFixed(2));
        const montantTva = Number(((montantHt * tauxTva) / 100).toFixed(2));
        const montantTtc = Number((montantHt + montantTva).toFixed(2));

        totalArticles += qte;
        totalHt += montantHt;
        totalTva += montantTva;
        totalTtc += montantTtc;

        return {
          ordreLigne: index + 1,
          produitId: l.produitId ? Number(l.produitId) : null,
          designation: l.designation.trim(),
          quantite: qte,
          prixUnitaireHt: puHt,
          tauxTva: tauxTva,
          montantHt: montantHt,
          montantTva: montantTva,
          montantTtc: montantTtc,
        };
      });

      // 3. Création de la Facture
      const nouvelleFacture = await tx.facture.create({
        data: {
          annee,
          numeroSequence,
          numeroFacture,
          clientId: Number(clientId),
          dateFacture: dateFact,
          statut: "brouillon",
          totalLignes: lignesFactureData.length,
          totalArticles,
          totalHt,
          totalTva,
          totalTtc,
          lignes: {
            create: lignesFactureData,
          },
        },
      });

      // 4. Mise à jour des BL associés
      await tx.bonLivraison.updateMany({
        where: { id: { in: blIds.map(Number) } },
        data: {
          statut: "facture",
          factureId: nouvelleFacture.id,
        },
      });

      return nouvelleFacture;
    });

    return NextResponse.json(resultat, { status: 201 });
  } catch (error) {
    console.error("Erreur POST /api/bl/convertir :", error);
    return NextResponse.json(
      { error: "Erreur lors de la conversion des bons de livraison en facture." },
      { status: 500 }
    );
  }
}