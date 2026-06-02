// À ajouter dans src/app/api/factures/[id]/route.ts
// Remplace la méthode GET/PUT existante

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { calculerTotauxFacture } from '@/lib/utils/currency'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const facture = await prisma.facture.findUnique({
    where: { id: Number(params.id) },
    include: {
      client: true,
      lignes: { orderBy: { ordreLigne: 'asc' } },
      paiement: { include: { modeReglement: { select: { libelle: true } } } },
    },
  })
  if (!facture) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(facture)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  const { clientId, dateFacture, statut, lignes = [] } = await req.json()

  const facture = await prisma.facture.findUnique({ where: { id } })
  if (!facture) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (facture.statut === 'validee') {
    return NextResponse.json({ error: 'Impossible de modifier une facture validée' }, { status: 400 })
  }

  type LigneInput = {
    ordreLigne: number; produitId?: number | null; designation: string
    quantite: number; prixUnitaireHt: number; remisePourcentage: number
    montantRemiseHt?: number; tauxTva: number; montantHt: number
    montantTva: number; montantTtc: number; prixAchatHt?: number
  }

  const totaux = calculerTotauxFacture(
    lignes.map((l: LigneInput) => ({
      quantite: l.quantite,
      prixAchatHt: l.prixAchatHt ?? 0,
      montantHt: l.montantHt,
      montantTva: l.montantTva,
      montantTtc: l.montantTtc,
    }))
  )

  const updated = await prisma.facture.update({
    where: { id },
    data: {
      clientId,
      dateFacture: new Date(dateFacture),
      statut,
      totalHt: totaux.totalHt,
      totalTva: totaux.totalTva,
      totalTtc: totaux.totalTtc,
      totalArticles: totaux.totalArticles,
      totalLignes: totaux.totalLignes,
      margeHt: totaux.margeHt,
      lignes: {
        deleteMany: {},
        create: lignes.map((l: LigneInput, i: number) => ({
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
          prixAchatHt: l.prixAchatHt ?? 0,
        })),
      },
    },
  })
  return NextResponse.json(updated)
}
