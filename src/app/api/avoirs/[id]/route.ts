// src/app/api/avoirs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { calculerTotauxFacture } from '@/lib/utils/currency'
import { canRead, canWrite } from '@/lib/utils/permissions'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // Vérifier les permissions pour la lecture
  const authorized = await canRead(req)
  if (!authorized) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }
  
  const avoir = await prisma.avoir.findUnique({
    where: { id: Number(params.id) },
    include: { client: true, lignes: { orderBy: { id: 'asc' } } },
  })
  if (!avoir) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(avoir)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  // Vérifier les permissions pour l'écriture
  const authorized = await canWrite(req)
  if (!authorized) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }
  
  const { clientId, dateAvoir, lignes = [] } = await req.json()
  const id = Number(params.id)

  type LigneInput = {
    ordreLigne?: number; produitId?: number | null; designation: string
    quantite: number; prixUnitaireHt: number; remisePourcentage?: number
    tauxTva: number; montantHt: number; montantTva: number; montantTtc: number
    prixAchatHt?: number
  }

  const totaux = calculerTotauxFacture(
    lignes.map((l: LigneInput) => ({
      quantite: l.quantite, prixAchatHt: l.prixAchatHt ?? 0,
      montantHt: l.montantHt, montantTva: l.montantTva, montantTtc: l.montantTtc,
    }))
  )

  const avoir = await prisma.avoir.update({
    where: { id },
    data: {
      clientId,
      dateAvoir: new Date(dateAvoir),
      totalHt: totaux.totalHt,
      totalTva: totaux.totalTva,
      totalTtc: totaux.totalTtc,
      lignes: {
        deleteMany: {},
        create: lignes.map((l: LigneInput, i: number) => ({
          produitId: l.produitId ?? null,
          designation: l.designation,
          quantite: l.quantite,
          prixUnitaireHt: l.prixUnitaireHt,
          remisePourcentage: l.remisePourcentage ?? 0,
          tauxTva: l.tauxTva,
          montantHt: l.montantHt,
          montantTva: l.montantTva,
          montantTtc: l.montantTtc,
        })),
      },
    },
  })
  return NextResponse.json(avoir)
}