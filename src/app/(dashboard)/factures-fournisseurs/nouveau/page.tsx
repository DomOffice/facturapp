// src/app/(dashboard)/factures-fournisseurs/nouveau/page.tsx

import { auth } from '@/lib/auth/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import UploadFacture from '@/components/ocr/upload-facture'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function NouvelleFactureFournisseurPage() {
  const session = await auth()

  if (!session?.user) redirect('/connexion')
 // Extraire le rôle de manière sécurisée en traitant session.user comme un objet pouvant avoir un attribut role
  
  const userRole = String((session.user as { role?: string }).role || '').toLowerCase()
  if (!['admin', 'saisie'].includes(userRole)) redirect('/') 

  // Récupération des fournisseurs actifs pour le select
  const fournisseurs = await prisma.fournisseur.findMany({
    select: {
      id: true,
      raisonSociale : true,
    },
    orderBy: { raisonSociale: 'asc' },
  })

    // Map the fournisseurs data to match the expected Fournisseur type in UploadFacture component
  const mappedFournisseurs = fournisseurs.map(({ id, raisonSociale }) => ({
    id,
    nom: raisonSociale,
  }))

  return (
    <div className="p-6">
      {/* En-tête */}
      <div className="mb-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link href="/" className="hover:text-gray-700">Tableau de bord</Link>
          <span>/</span>
          <Link href="/factures-fournisseurs" className="hover:text-gray-700">Factures fournisseurs</Link>
          <span>/</span>
          <span className="text-gray-900">Nouvelle importation</span>
        </nav>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Importer une facture fournisseur</h1>
            <p className="text-sm text-gray-500 mt-1">
              Déposez votre facture PDF ou image. Les données seront extraites et vous pourrez les valider avant intégration en stock.
            </p>
          </div>
        </div>
      </div>

      {/* Étapes du processus */}
      <div className="mb-8">
        <ol className="flex items-center gap-0">
          {[
            { num: 1, label: 'Upload', actif: true },
            { num: 2, label: 'Extraction OCR', actif: false },
            { num: 3, label: 'Vérification', actif: false },
            { num: 4, label: 'Validation stock', actif: false },
          ].map((etape, i, arr) => (
            <li key={etape.num} className="flex items-center">
              <div className="flex items-center gap-2">
                <span className={`
                  w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
                  ${etape.actif
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-400 border border-gray-200'
                  }
                `}>
                  {etape.num}
                </span>
                <span className={`text-sm ${etape.actif ? 'font-medium text-gray-900' : 'text-gray-400'}`}>
                  {etape.label}
                </span>
              </div>
              {i < arr.length - 1 && (
                <div className="w-8 h-px bg-gray-200 mx-3" />
              )}
            </li>
          ))}
        </ol>
      </div>

      {/* Carte principale */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <UploadFacture fournisseurs={mappedFournisseurs} />
      </div>
    </div>
  )
}
