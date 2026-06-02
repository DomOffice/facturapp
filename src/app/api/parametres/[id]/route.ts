// src/app/api/parametres/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const data = await req.json()
  const p = await prisma.parametre.update({ where: { id: Number(params.id) }, data })
  return NextResponse.json(p)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  await prisma.parametre.update({ where: { id: Number(params.id) }, data: { actif: false } })
  return NextResponse.json({ ok: true })
}
