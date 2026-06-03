// src/app/api/clients/route.ts
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

  const clients = await prisma.client.findMany({
    where: q ? {
      OR: [
        { raisonSociale: { contains: q, mode: 'insensitive' } },
        { telephone: { contains: q } },
        { ville: { contains: q, mode: 'insensitive' } },
        { ice: { contains: q } },
      ],
    } : undefined,
    include: { typeClient: { select: { libelle: true } } },
    orderBy: { id: 'asc' },
    take: 10,
  })

  // Format pour dropdown
  return NextResponse.json(clients.map(c => ({
    id: c.id,
    label: c.raisonSociale,
    sublabel: [c.ville, c.telephone].filter(Boolean).join(' · '),
    badge: c.typeClient?.libelle ?? undefined,
  })))
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
  const client = await prisma.client.create({ data })
  return NextResponse.json(client, { status: 201 })
}