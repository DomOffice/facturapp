// src/app/api/produits/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { canRead, canWrite } from '@/lib/utils/permissions'

export async function GET(req: NextRequest) {
  // Vérifier les permissions pour la lecture
  const authorized = await canRead(req)
  if (!authorized) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }
  
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const actifSeulement = searchParams.get('actif') !== 'false'

  const produits = await prisma.produit.findMany({
    where: {
      actif: actifSeulement ? true : undefined,
      ...(q ? { OR: [
        { description: { contains: q, mode: 'insensitive' } },
        { reference: { contains: q, mode: 'insensitive' } },
      ]} : {}),
    },
    include: { tauxTva: { select: { valeurNum: true } } },
    orderBy: { description: 'asc' },
  })

  return NextResponse.json(produits)
}

export async function POST(req: NextRequest) {
  // Vérifier les permissions pour l'écriture
  const authorized = await canWrite(req)
  if (!authorized) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const data = await req.json()

  if (!data.description?.trim()) {
    return NextResponse.json(
      { error: 'La description est obligatoire' },
      { status: 400 },
    )
  }

  try {
    const produit = await prisma.$transaction(async (tx) => {
      // 1. Création du produit
      const nouveauProduit = await tx.produit.create({
        data,
      })

      // 2. Création de la première ligne d'historique des prix
      await tx.prixProduit.create({
        data: {
          produitId: nouveauProduit.id,
          dateAchat: new Date(),
          prixAchatHt: data.dernierPrixAchatHt ?? 0,
          prixAchatTtc: data.dernierPrixAchatTtc ?? 0,
          prixVenteHt: data.prixVenteHt ?? 0,
          prixVenteTtc: data.prixVenteTtc ?? 0,
          margeHt: data.margeHt ?? 0,
          tauxTvaId: data.tauxTvaId ?? null,
          fournisseurId: data.fournisseurId ?? null,
        },
      })

      return nouveauProduit
    })

    return NextResponse.json(produit, { status: 201 })
  } catch (error) {
    console.error('Erreur création produit :', error)

    return NextResponse.json(
      { error: 'Erreur lors de la création du produit' },
      { status: 500 },
    )
  }
}