// src/app/api/entreprise/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

export async function GET() {
  const entreprise = await prisma.entreprise.findFirst()
  return NextResponse.json(entreprise)
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  if (!data.raisonSociale?.trim()) {
    return NextResponse.json({ error: 'La raison sociale est obligatoire' }, { status: 400 })
  }
  const entreprise = await prisma.entreprise.create({ data })
  return NextResponse.json(entreprise, { status: 201 })
}
