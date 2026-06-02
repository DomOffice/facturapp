// src/app/(dashboard)/devis/nouveau/page.tsx
export const dynamic = 'force-dynamic'
import prisma from '@/lib/db/prisma'
import { prochainNumeroDevis } from '@/lib/business/numerotation'
import DevisNouveauClient from './page-client'

export default async function NouveauDevisPage() {
  const [clients, { numeroDevis }] = await Promise.all([
    prisma.client.findMany({ where: { actif: true }, orderBy: { raisonSociale: 'asc' }, select: { id: true, raisonSociale: true } }),
    prochainNumeroDevis(),
  ])
  return <DevisNouveauClient clients={clients} prochainNumero={numeroDevis} />
}
