// src/app/api/factures/[id]/avoir/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { prochainNumeroAvoir } from '@/lib/business/numerotation'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const factureId = Number(params.id)
  const body = await req.json().catch(() => ({}))
  const dateAvoir = body.dateAvoir ? new Date(body.dateAvoir) : new Date()

  const facture = await prisma.facture.findUnique({
    where: { id: factureId },
    include: { lignes: true },
  })

  if (!facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
  if (facture.statut !== 'validee') {
    return NextResponse.json({ error: 'Seules les factures validées peuvent avoir un avoir' }, { status: 400 })
  }
  if (facture.aUnAvoir) {
    return NextResponse.json({ error: 'Cette facture a déjà un avoir' }, { status: 400 })
  }

  const { annee, numeroSequence, numeroAvoir } = await prochainNumeroAvoir()

  const avoir = await prisma.$transaction(async (tx) => {
    const a = await tx.avoir.create({
      data: {
        annee,
        numeroSequence,
        numeroAvoir,
        factureId,
        clientId: facture.clientId,
        dateAvoir,
        totalHt: facture.totalHt,
        totalTva: facture.totalTva,
        totalTtc: facture.totalTtc,
        statut: 'valide',
        lignes: {
          create: facture.lignes.map(l => ({
            produitId: l.produitId,
            designation: l.designation,
            quantite: l.quantite,
            prixUnitaireHt: l.prixUnitaireHt,
            remisePourcentage: l.remisePourcentage,
            montantHt: l.montantHt,
            tauxTva: l.tauxTva,
            montantTva: l.montantTva,
            montantTtc: l.montantTtc,
          })),
        },
      },
    })
    await tx.facture.update({
      where: { id: factureId },
      data: { aUnAvoir: true },
    })
    return a
  })

  return NextResponse.json(avoir, { status: 201 })
}
