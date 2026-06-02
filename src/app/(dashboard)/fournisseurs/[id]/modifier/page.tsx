// src/app/(dashboard)/fournisseurs/[id]/modifier/page.tsx
import { notFound } from 'next/navigation'
import prisma from '@/lib/db/prisma'
import FournisseurForm from '@/components/forms/fournisseur-form'

export default async function ModifierFournisseurPage({ params }: { params: { id: string } }) {
  const [fournisseur, typesFournisseur] = await Promise.all([
    prisma.fournisseur.findUnique({ where: { id: Number(params.id) } }),
    prisma.parametre.findMany({
      where: { type: { code: 'type_fournisseur' }, actif: true },
      orderBy: { ordreAffichage: 'asc' },
      select: { id: true, libelle: true },
    }),
  ])
  if (!fournisseur) notFound()
  return (
    <div className="p-6">
      <div className="page-header"><h1 className="page-title">Modifier : {fournisseur.raisonSociale}</h1></div>
      <FournisseurForm fournisseur={fournisseur} typesFournisseur={typesFournisseur} />
    </div>
  )
}
