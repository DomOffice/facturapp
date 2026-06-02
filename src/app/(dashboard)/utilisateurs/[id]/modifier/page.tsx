// src/app/(dashboard)/utilisateurs/[id]/modifier/page.tsx
export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import prisma from '@/lib/db/prisma'
import UtilisateurForm from '@/components/forms/utilisateur-form'

export default async function ModifierUtilisateurPage({ params }: { params: { id: string } }) {
  const [utilisateur, roles] = await Promise.all([
    prisma.utilisateur.findUnique({ where: { id: Number(params.id) } }),
    prisma.role.findMany({ orderBy: { id: 'asc' } }),
  ])
  if (!utilisateur) notFound()
  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Modifier : {utilisateur.nom}</h1>
      </div>
      <UtilisateurForm
        utilisateur={{
          id: utilisateur.id,
          nom: utilisateur.nom,
          email: utilisateur.email,
          roleId: utilisateur.roleId,
          actif: utilisateur.actif,
        }}
        roles={roles}
      />
    </div>
  )
}
