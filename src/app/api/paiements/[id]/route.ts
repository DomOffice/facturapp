// src/app/api/paiements/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { datePaiement, modeReglementId, numeroPiece, remarque } = await req.json()

  const paiement = await prisma.paiement.update({
    where: { id: Number(params.id) },
    data: {
      datePaiement: datePaiement ? new Date(datePaiement) : null,
      modeReglementId: modeReglementId || null,
      numeroPiece: numeroPiece || null,
      remarque: remarque || null,
    },
  })

  return NextResponse.json(paiement)
}
