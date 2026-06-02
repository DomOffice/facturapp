// src/app/api/factures/[id]/devalider/route.ts
// Repasse une facture validée en brouillon
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  const facture = await prisma.facture.findUnique({
    where: { id },
    include: { paiement: true },
  })
  if (!facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
  if (facture.statut !== 'validee') {
    return NextResponse.json({ error: 'Seules les factures validées peuvent être dévalidées' }, { status: 400 })
  }
  if (facture.paiement?.datePaiement) {
    return NextResponse.json({ error: 'Impossible de dévalider une facture déjà encaissée' }, { status: 400 })
  }

  await prisma.facture.update({
    where: { id },
    data: { statut: 'brouillon' },
  })
  return NextResponse.json({ ok: true })
}
