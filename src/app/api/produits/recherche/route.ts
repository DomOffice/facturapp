import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const q = searchParams.get("q")?.trim() || "";
    const fournisseurIdParam = searchParams.get("fournisseurId");
    const fournisseurId = fournisseurIdParam
      ? Number(fournisseurIdParam)
      : null;

    if (q.length < 2) {
      return NextResponse.json({ produits: [] });
    }

    const mots = q
      .split(/\s+/)
      .map((mot) => mot.trim())
      .filter((mot) => mot.length >= 2);

    const produits = await prisma.produit.findMany({
      where: {
        AND: [
          fournisseurId && Number.isInteger(fournisseurId)
            ? { fournisseurId }
            : {},
          {
            OR: mots.flatMap((mot) => [
              { reference: { contains: mot, mode: "insensitive" as const } },
              { description: { contains: mot, mode: "insensitive" as const } },
            ]),
          },
        ],
      },
      select: {
        id: true,
        reference: true,
        description: true,
        dernierPrixAchatHt: true,
        dernierPrixAchatTtc: true,
        prixVenteHt: true,
        prixVenteTtc: true,
        fournisseurId: true,
      },
      orderBy: [{ reference: "asc" }, { description: "asc" }],
      take: 10,
    });

    return NextResponse.json({ produits });
  } catch (error) {
    console.error("[RECHERCHE_PRODUITS]", error);

    return NextResponse.json(
      { error: "Erreur serveur lors de la recherche produits" },
      { status: 500 },
    );
  }
}
