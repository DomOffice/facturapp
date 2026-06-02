// src/app/(dashboard)/avoirs/[id]/modifier/page.tsx
export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import prisma from '@/lib/db/prisma'
import AvoirModifierClient from './page-client'

export default async function ModifierAvoirPage({ params }: { params: { id: string } }) {
  const [avoir, clients] = await Promise.all([
    prisma.avoir.findUnique({
      where: { id: Number(params.id) },
      include: {
        lignes: {
          orderBy: { id: 'asc' },
          include: {
            produit: {
              select: {
                id: true, reference: true, description: true,
                prixVenteHt: true, dernierPrixAchatHt: true,
                tauxTva: { select: { valeurNum: true } },
              },
            },
          },
        },
      },
    }),
    prisma.client.findMany({
      where: { actif: true },
      orderBy: { raisonSociale: 'asc' },
      select: { id: true, raisonSociale: true },
    }),
  ])

  if (!avoir) notFound()

  return (
    <AvoirModifierClient
      clients={clients}
      avoir={{
        id: avoir.id,
        numeroAvoir: avoir.numeroAvoir,
        clientId: avoir.clientId,
        dateAvoir: avoir.dateAvoir.toISOString().split('T')[0],
        lignes: avoir.lignes.map((l, i) => ({
          tempId: String(l.id),
          produitId: l.produitId,
          designation: l.designation,
          quantite: Number(l.quantite),
          prixAchatHt: Number(l.produit?.dernierPrixAchatHt ?? 0),
          prixUnitaireHt: Number(l.prixUnitaireHt),
          remisePourcentage: Number(l.remisePourcentage),
          tauxTva: Number(l.tauxTva),
          montantHt: Number(l.montantHt),
          montantTva: Number(l.montantTva),
          montantTtc: Number(l.montantTtc),
        })),
      }}
    />
  )
}
