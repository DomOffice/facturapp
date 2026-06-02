// src/app/api/factures/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { prochainNumeroFacture } from '@/lib/business/numerotation'
import { calculerTotauxFacture } from '@/lib/utils/currency'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')
  const statut = searchParams.get('statut')

  const factures = await prisma.facture.findMany({
    where: {
      ...(clientId ? { clientId: Number(clientId) } : {}),
      ...(statut ? { statut } : {}),
    },
    include: {
      client: { select: { raisonSociale: true } },
      paiement: { select: { datePaiement: true, montantTtc: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(factures)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { clientId, dateFacture, statut = 'brouillon', lignes = [] } = body

  if (!clientId) return NextResponse.json({ error: 'Client obligatoire' }, { status: 400 })
  if (!lignes.length) return NextResponse.json({ error: 'Au moins une ligne obligatoire' }, { status: 400 })

  const { annee, numeroSequence, numeroFacture } = await prochainNumeroFacture()

  const totaux = calculerTotauxFacture(
    lignes.map((l: { quantite: number; prixAchatHt: number; montantHt: number; montantTva: number; montantTtc: number }) => ({
      quantite: l.quantite,
      prixAchatHt: l.prixAchatHt ?? 0,
      montantHt: l.montantHt,
      montantTva: l.montantTva,
      montantTtc: l.montantTtc,
    }))
  )

  const facture = await prisma.$transaction(async (tx) => {
    // Créer la facture
    const f = await tx.facture.create({
      data: {
        annee,
        numeroSequence,
        numeroFacture,
        clientId,
        dateFacture: new Date(dateFacture),
        statut,
        totalLignes: totaux.totalLignes,
        totalArticles: totaux.totalArticles,
        totalHt: totaux.totalHt,
        totalTva: totaux.totalTva,
        totalTtc: totaux.totalTtc,
        totalAchatHt: totaux.totalAchatHt,
        margeHt: totaux.margeHt,
        impressionStatut: statut === 'validee' ? 'OK' : null,
        lignes: {
          create: lignes.map((l: {
            ordreLigne: number
            produitId?: number | null
            designation: string
            quantite: number
            prixAchatHt: number
            prixUnitaireHt: number
            remisePourcentage: number
            montantRemiseHt?: number
            tauxTva: number
            montantHt: number
            montantTva: number
            montantTtc: number
          }, i: number) => ({
            ordreLigne: l.ordreLigne ?? i + 1,
            produitId: l.produitId ?? null,
            designation: l.designation,
            quantite: l.quantite,
            prixAchatHt: l.prixAchatHt ?? 0,
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

    // Créer automatiquement la ligne paiement (même si non payée)
    if (statut === 'validee') {
      await tx.paiement.create({
        data: {
          factureId: f.id,
          montantHt: totaux.totalHt,
          montantTtc: totaux.totalTtc,
          // datePaiement null = non payée
        },
      })
    }

    return f
  })

  return NextResponse.json(facture, { status: 201 })
}
