// src/app/api/parametres/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const typeCode = searchParams.get('type')

  const parametres = await prisma.parametre.findMany({
    where: {
      actif: true,
      ...(typeCode ? { type: { code: typeCode } } : {}),
    },
    include: { type: { select: { code: true, nom: true } } },
    orderBy: [{ typeId: 'asc' }, { ordreAffichage: 'asc' }],
  })
  return NextResponse.json(parametres)
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  if (!data.libelle?.trim() || !data.typeId) {
    return NextResponse.json({ error: 'Libellé et type obligatoires' }, { status: 400 })
  }
  const p = await prisma.parametre.create({ data })
  return NextResponse.json(p, { status: 201 })
}
