// src/app/api/utilisateurs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'
import { getToken } from 'next-auth/jwt'

export async function GET(request: NextRequest) {
  // Récupérer le token JWT à partir du cookie
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET 
  })
  
  // Vérifier l'authentification
  if (!token || token.role !== 'admin') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }
  
  const utilisateurs = await prisma.utilisateur.findMany({
    include: { role: true },
    orderBy: { id: 'asc' },
  })
  return NextResponse.json(utilisateurs)
}

export async function POST(request: NextRequest) {
  // Récupérer le token JWT à partir du cookie
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET 
  })
  
  // Vérifier l'authentification
  if (!token || token.role !== 'admin') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }
  
  const { nom, email, motDePasse, roleId, actif } = await request.json()

  if (!nom?.trim()) return NextResponse.json({ error: 'Le nom est obligatoire' }, { status: 400 })
  if (!email?.trim()) return NextResponse.json({ error: "L'email est obligatoire" }, { status: 400 })
  if (!motDePasse) return NextResponse.json({ error: 'Le mot de passe est obligatoire' }, { status: 400 })
  if (!roleId) return NextResponse.json({ error: 'Le rôle est obligatoire' }, { status: 400 })

  // Vérifier email unique
  const existant = await prisma.utilisateur.findUnique({ where: { email } })
  if (existant) return NextResponse.json({ error: 'Cet email est déjà utilisé' }, { status: 400 })

  const motDePasseHash = await bcrypt.hash(motDePasse, 12)

  const utilisateur = await prisma.utilisateur.create({
    data: { nom, email, motDePasseHash, roleId: Number(roleId), actif: actif ?? true },
  })

  return NextResponse.json(utilisateur, { status: 201 })
}