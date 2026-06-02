// src/app/api/charges/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const debut = searchParams.get('debut')
  const fin = searchParams.get('fin')
  const typeId = searchParams.get('typeId')

  const charges = await prisma.charge.findMany({
    where: {
      ...(debut && fin ? { dateCharge: { gte: new Date(debut), lte: new Date(fin) } } : {}),
      ...(typeId ? { typeChargeId: Number(typeId) } : {}),
    },
    include: { typeCharge: { select: { libelle: true } } },
    orderBy: { dateCharge: 'desc' },
  })

  return NextResponse.json(charges)
}

export async function POST(req: NextRequest) {
  const data = await req.json()

  if (!data.emetteur?.trim()) {
    return NextResponse.json({ error: "L'émetteur est obligatoire" }, { status: 400 })
  }
  if (!data.typeChargeId) {
    return NextResponse.json({ error: 'Le type de charge est obligatoire' }, { status: 400 })
  }

  const charge = await prisma.charge.create({
    data: {
      dateCharge: new Date(data.dateCharge),
      numeroFacture: data.numeroFacture ?? null,
      emetteur: data.emetteur,
      typeChargeId: Number(data.typeChargeId),
      montantHt: data.montantHt,
      tauxTva: data.tauxTva ?? 0,
      montantTva: data.montantTva ?? 0,
      montantTtc: data.montantTtc ?? data.montantHt,
      fournisseurId: data.fournisseurId ?? null,
      remarque: data.remarque ?? null,
    },
  })

  return NextResponse.json(charge, { status: 201 })
}
