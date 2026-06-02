// src/app/api/factures/[id]/valider/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)

  const facture = await prisma.facture.findUnique({
    where: { id },
    include: { lignes: true },
  })

  if (!facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
  if (facture.statut === 'validee') return NextResponse.json({ error: 'Déjà validée' }, { status: 400 })
  if (facture.lignes.length === 0) return NextResponse.json({ error: 'Impossible de valider une facture sans lignes' }, { status: 400 })

  const result = await prisma.$transaction(async (tx) => {
    const f = await tx.facture.update({
      where: { id },
      data: { statut: 'validee', impressionStatut: 'OK' },
    })

    // Créer la ligne paiement si elle n'existe pas encore
    const paiementExistant = await tx.paiement.findUnique({ where: { factureId: id } })
    if (!paiementExistant) {
      await tx.paiement.create({
        data: {
          factureId: id,
          montantHt: facture.totalHt,
          montantTtc: facture.totalTtc,
        },
      })
    }

    return f
  })

  return NextResponse.json(result)
}
