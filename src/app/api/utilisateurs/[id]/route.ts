// src/app/api/utilisateurs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const u = await prisma.utilisateur.findUnique({
    where: { id: Number(params.id) },
    include: { role: true },
  })
  if (!u) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(u)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { nom, email, motDePasse, roleId, actif } = await req.json()
  const id = Number(params.id)

  if (!nom?.trim()) return NextResponse.json({ error: 'Le nom est obligatoire' }, { status: 400 })
  if (!email?.trim()) return NextResponse.json({ error: "L'email est obligatoire" }, { status: 400 })

  // Vérifier email unique (excluant l'utilisateur actuel)
  const existant = await prisma.utilisateur.findFirst({
    where: { email, id: { not: id } },
  })
  if (existant) return NextResponse.json({ error: 'Cet email est déjà utilisé' }, { status: 400 })

  const data: Record<string, unknown> = {
    nom,
    email,
    roleId: Number(roleId),
    actif: actif ?? true,
  }

  if (motDePasse) {
    data.motDePasseHash = await bcrypt.hash(motDePasse, 12)
  }

  const utilisateur = await prisma.utilisateur.update({ where: { id }, data })
  return NextResponse.json(utilisateur)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)

  // Ne pas supprimer le dernier admin
  const u = await prisma.utilisateur.findUnique({
    where: { id },
    include: { role: true },
  })
  if (u?.role.code === 'admin') {
    const nbAdmins = await prisma.utilisateur.count({
      where: { role: { code: 'admin' }, actif: true },
    })
    if (nbAdmins <= 1) {
      return NextResponse.json({ error: 'Impossible de supprimer le dernier administrateur' }, { status: 400 })
    }
  }

  // Désactiver plutôt que supprimer
  await prisma.utilisateur.update({ where: { id }, data: { actif: false } })
  return NextResponse.json({ ok: true })
}
