// src/app/api/clients/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const client = await prisma.client.findUnique({
    where: { id: Number(params.id) },
    include: { typeClient: true },
  })
  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  return NextResponse.json(client)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const data = await req.json()
  const client = await prisma.client.update({ where: { id: Number(params.id) }, data })
  return NextResponse.json(client)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  // Vérifier qu'il n'a pas de factures
  const count = await prisma.facture.count({ where: { clientId: Number(params.id) } })
  if (count > 0) {
    return NextResponse.json({ error: 'Impossible de supprimer un client ayant des factures' }, { status: 400 })
  }
  await prisma.client.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}
