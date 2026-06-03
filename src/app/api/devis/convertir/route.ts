// src/app/api/devis/[id]/convertir/route.ts
// Convertit un devis accepté en facture
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { prochainNumeroFacture } from '@/lib/business/numerotation'
import { canWrite } from '@/lib/utils/permissions'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Vérifier les permissions pour l'écriture
  const authorized = await canWrite(req)
  if (!authorized) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }
  
  const devis = await prisma.devis.findUnique({
    where: { id: Number(params.id) },
    include: { lignes: true },
  })
  if (!devis) return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 })

  const { annee, numeroSequence, numeroFacture } = await prochainNumeroFacture()

  const facture = await prisma.$transaction(async (tx) => {
    const f = await tx.facture.create({
      data: {
        annee,
        numeroSequence,
        numeroFacture,
        clientId: devis.clientId,
        dateFacture: new Date(),
        statut: 'brouillon',
        totalHt: devis.totalHt,
        totalTva: devis.totalTva,
        totalTtc: devis.totalTtc,
        totalArticles: devis.totalTtc,
        totalLignes: devis.lignes.length,
        margeHt: 0,
        lignes: {
          create: devis.lignes.map(l => ({
            ordreLigne: l.ordreLigne,
            produitId: l.produitId,
            designation: l.designation,
            quantite: l.quantite,
            prixUnitaireHt: l.prixUnitaireHt,
            remisePourcentage: l.remisePourcentage,
            montantRemiseHt: l.montantRemiseHt,
            tauxTva: l.tauxTva,
            montantHt: l.montantHt,
            montantTva: l.montantTva,
            montantTtc: l.montantTtc,
          })),
        },
        paiement: { create: { montantHt: Number(devis.totalHt), montantTtc: Number(devis.totalTtc) } },
      },
    })
    // Marquer le devis comme converti
    await tx.devis.update({ where: { id: devis.id }, data: { statut: 'accepte' } })
    return f
  })

  return NextResponse.json(facture, { status: 201 })
}