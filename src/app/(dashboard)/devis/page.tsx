// src/app/(dashboard)/devis/page.tsx
export const dynamic = 'force-dynamic'
import prisma from '@/lib/db/prisma'
import DevisPageClient from './page-client'

export default async function DevisPage() {
  const devis = await prisma.devis.findMany({
    include: { client: { select: { raisonSociale: true } } },
    orderBy: { id: 'asc' },
  })
  return (
    <DevisPageClient
      devis={devis.map(d => ({
        id: d.id,
        numeroDevis: d.numeroDevis,
        clientNom: d.client.raisonSociale,
        dateDevis: d.dateDevis.toISOString(),
        dateValidite: d.dateValidite?.toISOString() ?? null,
        totalHt: Number(d.totalHt),
        totalTtc: Number(d.totalTtc),
        statut: d.statut,
      }))}
    />
  )
}
