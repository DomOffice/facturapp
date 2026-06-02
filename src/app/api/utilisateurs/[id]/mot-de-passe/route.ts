// src/app/api/utilisateurs/[id]/mot-de-passe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { motDePasse } = await req.json()

  if (!motDePasse || motDePasse.length < 6) {
    return NextResponse.json(
      { error: 'Le mot de passe doit contenir au moins 6 caractères' },
      { status: 400 }
    )
  }

  const motDePasseHash = await bcrypt.hash(motDePasse, 12)

  await prisma.utilisateur.update({
    where: { id: Number(params.id) },
    data: { motDePasseHash },
  })

  return NextResponse.json({ ok: true })
}
