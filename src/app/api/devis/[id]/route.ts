// src/app/api/devis/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { canRead, canWrite } from '@/lib/utils/permissions'
import { calculerTotauxFacture } from '@/lib/utils/currency'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // Vérifier les permissions pour la lecture
  const authorized = await canRead(req)
  if (!authorized) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }
  
  const devis = await prisma.devis.findUnique({
    where: { id: Number(params.id) },
    include: { client: true, lignes: { orderBy: { ordreLigne: 'asc' } } },
  })
  if (!devis) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(devis)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  // Vérifier les permissions pour l'écriture
  const authorized = await canWrite(req)
  if (!authorized) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }
  
  const { clientId, dateDevis, dateValidite, remarque, lignes = [] } = await req.json()
  const id = Number(params.id)

  const totaux = calculerTotauxFacture(
    lignes.map((l: { quantite: number; prixAchatHt: number; montantHt: number; montantTva: number; montantTtc: number }) => ({
      quantite: l.quantite, prixAchatHt: l.prixAchatHt ?? 0,
      montantHt: l.montantHt, montantTva: l.montantTva, montantTtc: l.montantTtc,
    }))
  )

  const devis = await prisma.devis.update({
    where: { id },
    data: {
      clientId,
      dateDevis: new Date(dateDevis),
      dateValidite: dateValidite ? new Date(dateValidite) : null,
      remarque: remarque || null,
      totalHt: totaux.totalHt,
      totalTva: totaux.totalTva,
      totalTtc: totaux.totalTtc,
      lignes: {
        deleteMany: {},
        create: lignes.map((l: {
          ordreLigne: number; produitId?: number | null; designation: string
          quantite: number; prixUnitaireHt: number; remisePourcentage: number
          montantRemiseHt?: number; tauxTva: number; montantHt: number; montantTva: number; montantTtc: number
        }, i: number) => ({
          ordreLigne: l.ordreLigne ?? i + 1,
          produitId: l.produitId ?? null,
          designation: l.designation,
          quantite: l.quantite,
          prixUnitaireHt: l.prixUnitaireHt,
          remisePourcentage: l.remisePourcentage ?? 0,
          montantRemiseHt: l.montantRemiseHt ?? 0,
          tauxTva: l.tauxTva,
          montantHt: l.montantHt,
          montantTva: l.montantTva,
          montantTtc: l.montantTtc,
        })),
      },
    },
  })
  return NextResponse.json(devis)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  // Vérifier les permissions pour l'écriture
  const authorized = await canWrite(req)
  if (!authorized) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }
  
  const { statut } = await req.json()
  const devis = await prisma.devis.update({
    where: { id: Number(params.id) },
    data: { statut },
  })
  return NextResponse.json(devis)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  // Vérifier les permissions pour l'écriture (suppression)
  const authorized = await canWrite(req)
  if (!authorized) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }
  
  await prisma.devis.delete({ where: { id: Number(params.id) } })
  return NextResponse.json({ ok: true })
}