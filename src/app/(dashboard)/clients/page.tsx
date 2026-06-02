// src/app/(dashboard)/clients/page.tsx
export const dynamic = 'force-dynamic'
import prisma from '@/lib/db/prisma'
import ClientsPageClient from './page-client'

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    include: { typeClient: { select: { libelle: true } } },
    orderBy: { id: 'asc' },
  })

  return (
    <ClientsPageClient
      clients={clients.map(c => ({
        id: c.id,
        typeClient: c.typeClient?.libelle ?? null,
        raisonSociale: c.raisonSociale,
        telephone: c.telephone,
        ville: c.ville,
        ice: c.ice,
        email: c.email,
        actif: c.actif,
      }))}
    />
  )
}
