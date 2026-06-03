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
    return NextResponse.json({ error: 'La description est obligatoire' }, { status: 400 })
  }
  const produit = await prisma.produit.create({ data })
  return NextResponse.json(produit, { status: 201 })
}