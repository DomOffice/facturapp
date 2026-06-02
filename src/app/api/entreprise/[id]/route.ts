// src/app/api/entreprise/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const data = await req.json()
  if (!data.raisonSociale?.trim()) {
    return NextResponse.json({ error: 'La raison sociale est obligatoire' }, { status: 400 })
  }
  const entreprise = await prisma.entreprise.update({
    where: { id: Number(params.id) },
    data,
  })
  return NextResponse.json(entreprise)
}
