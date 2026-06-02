// src/app/(dashboard)/produits/[id]/modifier/page.tsx
import { notFound } from 'next/navigation'
import prisma from '@/lib/db/prisma'
import ProduitForm from '@/components/forms/produit-form'

export default async function ModifierProduitPage({ params }: { params: { id: string } }) {
  const [produit, typesProduit, unites, tauxTva, fournisseurs] = await Promise.all([
    prisma.produit.findUnique({ where: { id: Number(params.id) } }),
    prisma.parametre.findMany({ where: { type: { code: 'type_produit' }, actif: true }, orderBy: { ordreAffichage: 'asc' }, select: { id: true, libelle: true } }),
    prisma.parametre.findMany({ where: { type: { code: 'unite' }, actif: true }, orderBy: { ordreAffichage: 'asc' }, select: { id: true, libelle: true } }),
    prisma.parametre.findMany({ where: { type: { code: 'taux_tva' }, actif: true }, orderBy: { ordreAffichage: 'asc' }, select: { id: true, libelle: true, valeurNum: true } })
      .then(r => r.map(t => ({ id: t.id, libelle: t.libelle, valeurNum: t.valeurNum ? Number(t.valeurNum) : null }))),
    prisma.fournisseur.findMany({ where: { actif: true }, orderBy: { raisonSociale: 'asc' }, select: { id: true, raisonSociale: true } })
      .then(r => r.map(f => ({ id: f.id, libelle: f.raisonSociale }))),
  ])

  if (!produit) notFound()

  return (
    <div className="p-6">
      <div className="page-header"><h1 className="page-title">Modifier : {produit.description}</h1></div>
      <ProduitForm
        produit={{
          ...produit,
          dernierPrixAchatHt: Number(produit.dernierPrixAchatHt),
          prixVenteHt: Number(produit.prixVenteHt),
          margeHt: Number(produit.margeHt),
        }}
        typesProduit={typesProduit}
        unites={unites}
        tauxTva={tauxTva}
        fournisseurs={fournisseurs}
      />
    </div>
  )
}