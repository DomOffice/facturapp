import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (q.length < 2) {
      return NextResponse.json([]);
    }

    const mots = q
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/\s+/)
      .filter(Boolean);

    if (mots.length === 0) {
      return NextResponse.json([]);
    }

    const lignes = await prisma.factureLigne.findMany({
      where: {
        AND: mots.map((mot) => ({
          OR: [
            {
              designation: {
                contains: mot,
                mode: "insensitive",
              },
            },
            {
              produit: {
                is: {
                  reference: {
                    contains: mot,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              produit: {
                is: {
                  description: {
                    contains: mot,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        })),
      },

      include: {
        facture: {
          include: {
            client: {
              select: {
                raisonSociale: true,
              },
            },
          },
        },

        produit: {
          select: {
            reference: true,
            description: true,
          },
        },
      },

      orderBy: [
        {
          facture: {
            dateFacture: "desc",
          },
        },
        {
          id: "desc",
        },
      ],

      take: 200,
    });

    return NextResponse.json(
      lignes.map((ligne) => ({
        id: ligne.id,

        factureId: ligne.facture.id,
        numeroFacture: ligne.facture.numeroFacture,
        dateFacture: ligne.facture.dateFacture.toISOString(),

        clientNom: ligne.facture.client.raisonSociale,
        statut: ligne.facture.statut,

        produitId: ligne.produitId,
        reference: ligne.produit?.reference ?? "",
        designation: ligne.designation,

        quantite: Number(ligne.quantite),
        prixUnitaireHt: Number(ligne.prixUnitaireHt),
        remisePourcentage: Number(ligne.remisePourcentage),
        montantHt: Number(ligne.montantHt),
        montantTtc: Number(ligne.montantTtc),
      })),
    );
  } catch (error) {
    console.error("Erreur recherche article facturé :", error);

    return NextResponse.json(
      { error: "Erreur lors de la recherche" },
      { status: 500 },
    );
  }
}