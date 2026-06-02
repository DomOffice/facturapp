// src/app/api/utilisateurs/[id]/mot-de-passe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'
import { getToken } from 'next-auth/jwt'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  // Récupérer le token JWT à partir du cookie
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET 
  })
  
  // Vérifier l'authentification
  if (!token || (token.role !== 'admin' && token.sub !== params.id.toString())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }
  
  const { motDePasse } = await request.json()

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