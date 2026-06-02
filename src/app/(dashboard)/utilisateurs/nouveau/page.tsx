// src/app/(dashboard)/utilisateurs/nouveau/page.tsx
export const dynamic = 'force-dynamic'
import prisma from '@/lib/db/prisma'
import UtilisateurForm from '@/components/forms/utilisateur-form'

export default async function NouvelUtilisateurPage() {
  const roles = await prisma.role.findMany({ orderBy: { id: 'asc' } })
  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Nouvel utilisateur</h1>
      </div>
      <UtilisateurForm roles={roles} isNew />
    </div>
  )
}
