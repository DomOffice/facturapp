// src/app/(dashboard)/clients/nouveau/page.tsx
import prisma from '@/lib/db/prisma'
import ClientForm from '@/components/forms/client-form'
export const dynamic = 'force-dynamic'

async function getTypesClient() {
  return prisma.parametre.findMany({
    where: { type: { code: 'type_client' }, actif: true },
    orderBy: { ordreAffichage: 'asc' },
    select: { id: true, libelle: true },
  })
}

export default async function NouveauClientPage() {
  const typesClient = await getTypesClient()

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Nouveau client</h1>
      </div>
      <ClientForm typesClient={typesClient} />
    </div>
  )
}
