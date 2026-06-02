// src/app/(dashboard)/devis/[id]/modifier/page.tsx
export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import prisma from '@/lib/db/prisma'
import DevisNouveauClient from '../../nouveau/page-client'

export default async function ModifierDevisPage({ params }: { params: { id: string } }) {
  const [devis, clients] = await Promise.all([
    prisma.devis.findUnique({
      where: { id: Number(params.id) },
      include: {
        lignes: {
          orderBy: { ordreLigne: 'asc' },
          include: { produit: { select: { id: true, reference: true, description: true, prixVenteHt: true, dernierPrixAchatHt: true, tauxTva: { select: { valeurNum: true } } } } },
        },
      },
    }),
    prisma.client.findMany({ where: { actif: true }, orderBy: { raisonSociale: 'asc' }, select: { id: true, raisonSociale: true } }),
  ])
  if (!devis) notFound()

  return (
    <DevisNouveauClient
      clients={clients}
      prochainNumero={devis.numeroDevis}
      devisExistant={{
        id: devis.id,
        clientId: devis.clientId,
        dateDevis: devis.dateDevis.toISOString().split('T')[0],
        dateValidite: devis.dateValidite?.toISOString().split('T')[0] ?? '',
        remarque: devis.remarque ?? '',
        lignes: devis.lignes.map(l => ({
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
