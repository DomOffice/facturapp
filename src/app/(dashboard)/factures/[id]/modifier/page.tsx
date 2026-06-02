// src/app/(dashboard)/factures/[id]/modifier/page.tsx
export const dynamic = 'force-dynamic'
import { notFound, redirect } from 'next/navigation'
import prisma from '@/lib/db/prisma'
import NouvelleFactureClient from '../../nouvelle/page-client'

export default async function ModifierFacturePage({ params }: { params: { id: string } }) {
  const facture = await prisma.facture.findUnique({
    where: { id: Number(params.id) },
    include: {
      lignes: {
        orderBy: { ordreLigne: 'asc' },
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
      client: { select: { raisonSociale: true } },
    },
  })

  if (!facture) notFound()

  // Bloquer si validée ET payée
  if (facture.statut === 'validee') {
    redirect(`/factures/${params.id}`)
  }

  const clients = await prisma.client.findMany({
    where: { actif: true },
    orderBy: { raisonSociale: 'asc' },
    select: { id: true, raisonSociale: true },
  })

  return (
    <NouvelleFactureClient
      clients={clients}
      prochainNumero={facture.numeroFacture}
      factureExistante={{
        id: facture.id,
        clientId: facture.clientId,
        dateFacture: facture.dateFacture.toISOString().split('T')[0],
        lignes: facture.lignes.map(l => ({
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
