// src/app/(dashboard)/fournisseurs/nouveau/page.tsx
import prisma from '@/lib/db/prisma'
import FournisseurForm from '@/components/forms/fournisseur-form'
export const dynamic = 'force-dynamic'

export default async function NouveauFournisseurPage() {
  const typesFournisseur = await prisma.parametre.findMany({
    where: { type: { code: 'type_fournisseur' }, actif: true },
    orderBy: { ordreAffichage: 'asc' },
    select: { id: true, libelle: true },
  })
  return (
    <div className="p-6">
      <div className="page-header"><h1 className="page-title">Nouveau fournisseur</h1></div>
      <FournisseurForm typesFournisseur={typesFournisseur} />
    </div>
  )
}
