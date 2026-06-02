// src/app/(dashboard)/parametres/entreprise/page.tsx
export const dynamic = 'force-dynamic'
import prisma from '@/lib/db/prisma'
import EntrepriseForm from './entreprise-form'

export default async function EntreprisePage() {
  const entreprise = await prisma.entreprise.findFirst()
  return (
    <div className="p-4 md:p-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Paramètres société</h1>
          <p className="text-sm text-slate-400 mt-0.5">Informations affichées sur les factures PDF</p>
        </div>
      </div>
      <EntrepriseForm entreprise={entreprise ? {
        id: entreprise.id,
        raisonSociale: entreprise.raisonSociale,
        adresse: entreprise.adresse,
        codePostal: entreprise.codePostal,
        ville: entreprise.ville,
        telephone: entreprise.telephone,
        email: entreprise.email,
        ice: entreprise.ice,
        identifiantFiscal: entreprise.identifiantFiscal,
        rc: entreprise.rc,
        patente: entreprise.patente,
        logoUrl: entreprise.logoUrl,
        devise: entreprise.devise,
      } : null} />
    </div>
  )
}
