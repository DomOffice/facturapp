// src/app/api/factures/[id]/dupliquer/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { prochainNumeroFacture } from '@/lib/business/numerotation'

// Duplique les LIGNES d'une facture dans une nouvelle facture brouillon
// sans reprendre le client ni la date (comme dans le VB6)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  const body = await req.json().catch(() => ({}))
  const { clientId, dateFacture } = body

  if (!clientId) return NextResponse.json({ error: 'clientId obligatoire' }, { status: 400 })

  const source = await prisma.facture.findUnique({
    where: { id },
    include: { lignes: { orderBy: { ordreLigne: 'asc' } } },
  })

  if (!source) return NextResponse.json({ error: 'Facture source introuvable' }, { status: 404 })

  const { annee, numeroSequence, numeroFacture } = await prochainNumeroFacture()

  const nouvelle = await prisma.facture.create({
    data: {
      annee,
      numeroSequence,
      numeroFacture,
      clientId,
      dateFacture: dateFacture ? new Date(dateFacture) : new Date(),
      statut: 'brouillon',
      totalLignes: source.totalLignes,
      totalArticles: source.totalArticles,
      totalHt: source.totalHt,
      totalTva: source.totalTva,
      totalTtc: source.totalTtc,
      totalAchatHt: source.totalAchatHt,
      margeHt: source.margeHt,
      lignes: {
        create: source.lignes.map(l => ({
          ordreLigne: l.ordreLigne,
          produitId: l.produitId,
          designation: l.designation,
          quantite: l.quantite,
          prixAchatHt: l.prixAchatHt,
          prixUnitaireHt: l.prixUnitaireHt,
          remisePourcentage: l.remisePourcentage,
          montantRemiseHt: l.montantRemiseHt,
          tauxTva: l.tauxTva,
          montantHt: l.montantHt,
          montantTva: l.montantTva,
          montantTtc: l.montantTtc,
        })),
      },
    },
  })

  return NextResponse.json(nouvelle, { status: 201 })
}
