// src/app/(dashboard)/produits/page.tsx
export const dynamic = 'force-dynamic'
import prisma from '@/lib/db/prisma'
import ProduitsPageClient from './page-client'

export default async function ProduitsPage() {
  const produits = await prisma.produit.findMany({
    include: { tauxTva: { select: { valeurNum: true } } },
    orderBy: { id: 'asc' },
  })

  return (
    <ProduitsPageClient
      produits={produits.map(p => ({
        id: p.id,
        reference: p.reference,
        description: p.description,
        dernierPrixAchatHt: Number(p.dernierPrixAchatHt),
        prixVenteHt: Number(p.prixVenteHt),
        margeHt: Number(p.margeHt),
        tauxTva: p.tauxTva?.valeurNum ? Number(p.tauxTva.valeurNum) : null,
        dernierPrixAchatTtc: Number(p.dernierPrixAchatTtc),
        prixVenteTtc: Number(p.prixVenteTtc),
        actif: p.actif,
      }))}
    />
  )
}
