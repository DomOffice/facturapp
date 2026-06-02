// src/app/(dashboard)/factures/nouvelle/page.tsx
import prisma from '@/lib/db/prisma'
import { prochainNumeroFacture } from '@/lib/business/numerotation'
import NouvelleFactureClient from './page-client'
export const dynamic = 'force-dynamic'

export default async function NouvelleFacturePage() {
  const [clients, { numeroFacture }] = await Promise.all([
    prisma.client.findMany({ where: { actif: true }, orderBy: { raisonSociale: 'asc' }, select: { id: true, raisonSociale: true } }),
    prochainNumeroFacture(),
  ])

  return <NouvelleFactureClient clients={clients} prochainNumero={numeroFacture} />
}
