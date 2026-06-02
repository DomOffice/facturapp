// src/app/(dashboard)/clients/[id]/modifier/page.tsx
import { notFound } from 'next/navigation'
import prisma from '@/lib/db/prisma'
import ClientForm from '@/components/forms/client-form'

export default async function ModifierClientPage({ params }: { params: { id: string } }) {
  const [client, typesClient] = await Promise.all([
    prisma.client.findUnique({ where: { id: Number(params.id) } }),
    prisma.parametre.findMany({
      where: { type: { code: 'type_client' }, actif: true },
      orderBy: { ordreAffichage: 'asc' },
      select: { id: true, libelle: true },
    }),
  ])

  if (!client) notFound()

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Modifier : {client.raisonSociale}</h1>
      </div>
      <ClientForm client={client} typesClient={typesClient} />
    </div>
  )
}
