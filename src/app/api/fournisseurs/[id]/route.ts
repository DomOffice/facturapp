// src/app/api/fournisseurs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const f = await prisma.fournisseur.findUnique({ where: { id: Number(params.id) } })
  if (!f) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(f)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const data = await req.json()
  const f = await prisma.fournisseur.update({ where: { id: Number(params.id) }, data })
  return NextResponse.json(f)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const count = await prisma.produit.count({ where: { fournisseurId: Number(params.id) } })
  if (count > 0) {
    return NextResponse.json({ error: 'Impossible de supprimer un fournisseur lié à des produits' }, { status: 400 })
  }
  await prisma.fournisseur.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
