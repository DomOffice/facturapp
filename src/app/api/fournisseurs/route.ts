// src/app/api/fournisseurs/route.ts
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
  // Vérifier les permissions pour l'écriture
  const authorized = await canWrite(req)
  if (!authorized) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }
  
  const data = await req.json()
  if (!data.raisonSociale?.trim()) {
    return NextResponse.json({ error: 'La raison sociale est obligatoire' }, { status: 400 })
  }
  const f = await prisma.fournisseur.create({ data })
  return NextResponse.json(f, { status: 201 })
}