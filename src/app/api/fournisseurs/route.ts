// src/app/api/fournisseurs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const actif = searchParams.get('actif') !== 'false'

  const fournisseurs = await prisma.fournisseur.findMany({
    where: {
      actif: actif ? true : undefined,
      ...(q ? {
        OR: [
          { raisonSociale: { contains: q, mode: 'insensitive' } },
          { telephone: { contains: q } },
        ],
      } : {}),
    },
    orderBy: { raisonSociale: 'asc' },
  })
  return NextResponse.json(fournisseurs)
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  if (!data.raisonSociale?.trim()) {
    return NextResponse.json({ error: 'La raison sociale est obligatoire' }, { status: 400 })
  }
  const f = await prisma.fournisseur.create({ data })
  return NextResponse.json(f, { status: 201 })
}
