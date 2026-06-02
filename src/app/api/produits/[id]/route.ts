// src/app/api/produits/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const p = await prisma.produit.findUnique({
    where: { id: Number(params.id) },
    include: { tauxTva: true, fournisseur: true, prixHistorique: { orderBy: { dateAchat: 'desc' }, take: 10 } },
  })
  if (!p) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(p)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const data = await req.json()
  const id = Number(params.id)

  const produit = await prisma.$transaction(async (tx) => {
    const p = await tx.produit.update({ where: { id }, data })

    // Enregistrer dans l'historique des prix si le prix a changé
    if (data.dernierPrixAchatHt !== undefined) {
      await tx.prixProduit.create({
        data: {
          produitId: id,
          dateAchat: new Date(),
          prixAchatHt: data.dernierPrixAchatHt,
          prixAchatTtc: data.dernierPrixAchatTtc ?? 0,
          prixVenteHt: data.prixVenteHt ?? 0,
          prixVenteTtc: data.prixVenteTtc ?? 0,
          margeHt: data.margeHt ?? 0,
          tauxTvaId: data.tauxTvaId ?? null,
          fournisseurId: data.fournisseurId ?? null,
        },
      })
    }

    return p
  })

  return NextResponse.json(produit)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.produit.update({
    where: { id: Number(params.id) },
    data: { actif: false },
  })
  return NextResponse.json({ ok: true })
}
