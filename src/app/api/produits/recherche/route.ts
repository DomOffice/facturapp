import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOTS_IGNORES = new Set([
  "AVEC",
  "DANS",
  "DES",
  "DU",
  "LES",
  "POUR",
  "PAR",
  "SUR",
  "UNE",
  "UN",
  "DE",
  "LA",
  "LE",
  "ET",
]);

function normaliser(value?: string | null): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extraireTermes(value: string): string[] {
  const termes = new Set<string>();
  const texteNormalise = normaliser(value);

  for (const mot of texteNormalise.split(" ")) {
    if (mot.length >= 3 && !MOTS_IGNORES.has(mot)) {
      termes.add(mot);
    }

    /*
     * CANCL446, CL446 ou PG445 produisent aussi
     * les termes numériques 446 et 445.
     */
    const nombres = mot.match(/\d{3,}/g);

    if (nombres) {
      for (const nombre of nombres) {
        termes.add(nombre);
      }
    }
  }

  return Array.from(termes);
}

function calculerScore(
  requete: string,
  produit: {
    reference: string | null;
    description: string | null;
    fournisseurId: number | null;
  },
  fournisseurId: number | null,
): number {
  const termesRequete = extraireTermes(requete);

  const texteProduit = normaliser(
    `${produit.reference || ""} ${produit.description || ""}`,
  );

  const referenceProduit = normaliser(produit.reference);
  const requeteNormalisee = normaliser(requete);

  let score = 0;

  if (
    referenceProduit.length >= 3 &&
    requeteNormalisee.includes(referenceProduit)
  ) {
    score += 25;
  }

  const termesTrouves = termesRequete.filter((terme) =>
    texteProduit.includes(terme),
  );

  if (termesRequete.length > 0) {
    score += Math.round(
      (termesTrouves.length / termesRequete.length) * 60,
    );
  }

  const nombresRequete = termesRequete.filter((terme) => /^\d+$/.test(terme));

  if (
    nombresRequete.some((nombre) => texteProduit.includes(nombre))
  ) {
    score += 25;
  }

  /*
   * Le fournisseur améliore le score, mais ne bloque jamais
   * les autres produits.
   */
  if (
    fournisseurId &&
    produit.fournisseurId &&
    produit.fournisseurId === fournisseurId
  ) {
    score += 10;
  }

  return Math.min(100, score);
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 },
      );
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

    const termes = extraireTermes(q);

    if (termes.length === 0) {
      return NextResponse.json({ produits: [] });
    }

    const candidats = await prisma.produit.findMany({
      where: {
        OR: termes.flatMap((terme) => [
          {
            reference: {
              contains: terme,
              mode: "insensitive" as const,
            },
          },
          {
            description: {
              contains: terme,
              mode: "insensitive" as const,
            },
          },
        ]),
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
      take: 50,
    });

    const produits = candidats
      .map((produit) => ({
        ...produit,
        score: calculerScore(q, produit, fournisseurId),
      }))
      .filter((produit) => produit.score >= 20)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return String(a.description || "").localeCompare(
          String(b.description || ""),
          "fr",
        );
      })
      .slice(0, 10);

    return NextResponse.json({ produits });
  } catch (error) {
    console.error("[RECHERCHE_PRODUITS]", error);

    return NextResponse.json(
      { error: "Erreur serveur lors de la recherche produits" },
      { status: 500 },
    );
  }
}