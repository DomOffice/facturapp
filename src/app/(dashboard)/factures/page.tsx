// src/app/(dashboard)/factures/page.tsx
export const dynamic = 'force-dynamic'
import prisma from '@/lib/db/prisma'
import FacturesPageClient from './page-client'

export default async function FacturesPage() {
  const factures = await prisma.facture.findMany({
    include: {
      client: { select: { raisonSociale: true } },
      paiement: {
        select: {
          datePaiement: true,
          modeReglement: { select: { libelle: true } },
          numeroPiece: true,
        }
      },
    },
    orderBy: { id: 'asc' },
  })

  return (
    <FacturesPageClient
      factures={factures.map(f => ({
        id: f.id,
        numeroFacture: f.numeroFacture,
        clientNom: f.client.raisonSociale,
        dateFacture: f.dateFacture.toISOString(),
        totalHt: Number(f.totalHt),
        totalTtc: Number(f.totalTtc),
        margeHt: Number(f.margeHt),
        statut: f.statut,
        estPayee: !!f.paiement?.datePaiement,
        datePaiement: f.paiement?.datePaiement?.toISOString() ?? null,
        modeReglement: f.paiement?.modeReglement?.libelle ?? null,
        numeroPiece: f.paiement?.numeroPiece ?? null,
      }))}
    />
  )
}
