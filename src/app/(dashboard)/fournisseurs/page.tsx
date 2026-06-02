// src/app/(dashboard)/fournisseurs/page.tsx
export const dynamic = 'force-dynamic'
import prisma from '@/lib/db/prisma'
import FournisseursPageClient from './page-client'

export default async function FournisseursPage() {
  const fournisseurs = await prisma.fournisseur.findMany({
    include: { typeFournisseur: { select: { libelle: true } } },
    orderBy: { id: 'asc' },
  })

  return (
    <FournisseursPageClient
      fournisseurs={fournisseurs.map(f => ({
        id: f.id,
        typeFournisseur: f.typeFournisseur?.libelle ?? null,
        raisonSociale: f.raisonSociale,
        telephone: f.telephone,
        ville: f.ville,
        ice: f.ice,
        actif: f.actif,
      }))}
    />
  )
}
