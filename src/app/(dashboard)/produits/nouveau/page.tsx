// src/app/(dashboard)/produits/nouveau/page.tsx
import prisma from '@/lib/db/prisma'
import ProduitForm from '@/components/forms/produit-form'
export const dynamic = 'force-dynamic'

export default async function NouveauProduitPage() {
  const [typesProduit, unites, tauxTva, fournisseurs] = await Promise.all([
    prisma.parametre.findMany({ where: { type: { code: 'type_produit' }, actif: true }, orderBy: { ordreAffichage: 'asc' }, select: { id: true, libelle: true } }),
    prisma.parametre.findMany({ where: { type: { code: 'unite' }, actif: true }, orderBy: { ordreAffichage: 'asc' }, select: { id: true, libelle: true } }),
    prisma.parametre.findMany({ where: { type: { code: 'taux_tva' }, actif: true }, orderBy: { ordreAffichage: 'asc' }, select: { id: true, libelle: true, valeurNum: true } })
      .then(r => r.map(t => ({ id: t.id, libelle: t.libelle, valeurNum: t.valeurNum ? Number(t.valeurNum) : null }))),
    prisma.fournisseur.findMany({ where: { actif: true }, orderBy: { raisonSociale: 'asc' }, select: { id: true, raisonSociale: true } })
      .then(r => r.map(f => ({ id: f.id, libelle: f.raisonSociale }))),
  ])

  return (
    <div className="p-6">
      <div className="page-header"><h1 className="page-title">Nouveau produit</h1></div>
      <ProduitForm
        typesProduit={typesProduit}
        unites={unites}
        tauxTva={tauxTva}
        fournisseurs={fournisseurs}
      />
    </div>
  )
}