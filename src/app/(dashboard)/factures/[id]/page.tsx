// src/app/(dashboard)/factures/[id]/page.tsx
export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatMontant } from '@/lib/utils/currency'
import FactureActions from './facture-actions'
import AvoirButton from './avoir-button'
import DevaliderButton from './devalider-button'

export default async function FactureDetailPage({ params }: { params: { id: string } }) {
  const [facture, entreprise] = await Promise.all([
    prisma.facture.findUnique({
      where: { id: Number(params.id) },
      include: {
        client: { include: { typeClient: { select: { libelle: true } } } },
        lignes: { orderBy: { ordreLigne: 'asc' } },
        paiement: { include: { modeReglement: { select: { libelle: true } } } },
      },
    }),
    prisma.entreprise.findFirst(),
  ])

  if (!facture) notFound()

  const estValidee = facture.statut === 'validee'
  const estPayee = !!facture.paiement?.datePaiement

  // Données sérialisées pour le composant client
  const factureData = {
    id: facture.id,
    numeroFacture: facture.numeroFacture,
    dateFacture: facture.dateFacture.toISOString(),
    statut: facture.statut,
    client: {
      raisonSociale: facture.client.raisonSociale,
      adresse: facture.client.adresse,
      codePostal: facture.client.codePostal,
      ville: facture.client.ville,
      telephone: facture.client.telephone,
      ice: facture.client.ice,
      email: facture.client.email,
      echeanceJours: facture.client.echeanceJours,
    },
    lignes: facture.lignes.map(l => ({
      ordreLigne: l.ordreLigne,
      designation: l.designation,
      quantite: Number(l.quantite),
      prixUnitaireHt: Number(l.prixUnitaireHt),
      remisePourcentage: Number(l.remisePourcentage),
      montantRemiseHt: Number(l.montantRemiseHt),
      tauxTva: Number(l.tauxTva),
      montantHt: Number(l.montantHt),
      montantTva: Number(l.montantTva),
      montantTtc: Number(l.montantTtc),
    })),
    totalHt: Number(facture.totalHt),
    totalTva: Number(facture.totalTva),
    totalTtc: Number(facture.totalTtc),
    totalArticles: Number(facture.totalArticles),
    totalLignes: facture.totalLignes,
    margeHt: Number(facture.margeHt),
  }

  const entrepriseData = entreprise ? {
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
    compteBancaire: entreprise.compteBancaire,
  } : {
    raisonSociale: 'Ma Société',
    adresse: null, codePostal: null, ville: null,
    telephone: null, email: null, ice: null,
    identifiantFiscal: null, rc: null, patente: null, logoUrl: null, compteBancaire: null,
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title font-mono">{facture.numeroFacture}</h1>
          <div className="flex items-center gap-2 mt-1">
            {estValidee
              ? <span className="badge badge-info">Validée</span>
              : <span className="badge badge-neutral">Brouillon</span>}
            {estValidee && (estPayee
              ? <span className="badge badge-success">Payée le {new Date(facture.paiement!.datePaiement!).toLocaleDateString('fr-FR')}</span>
              : <span className="badge badge-warning">Non payée</span>)}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Link href="/factures" className="btn-ghost btn-sm">← Retour</Link>
          {!estValidee && (
          <Link href={`/factures/${facture.id}/modifier`} className="btn-secondary btn-sm">
            Modifier
          </Link>
        )}
          <Link href="/paiements" className="btn-secondary btn-sm">Paiements</Link>
          <FactureActions facture={factureData} entreprise={entrepriseData} />
          {estValidee && !facture.aUnAvoir && <AvoirButton factureId={facture.id} />}
          {estValidee && !estPayee && <DevaliderButton factureId={facture.id} />}
          {facture.aUnAvoir && <span className="badge badge-warning">Avoir créé</span>}
        </div>
      </div>

      {/* Info facture */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Client</div>
          <div className="font-semibold text-slate-800">{facture.client.raisonSociale}</div>
          {facture.client.adresse && <div className="text-sm text-slate-500 mt-1">{facture.client.adresse}</div>}
          {facture.client.ville && <div className="text-sm text-slate-500">{facture.client.codePostal} {facture.client.ville}</div>}
          {facture.client.telephone && <div className="text-sm text-slate-500">{facture.client.telephone}</div>}
          {facture.client.ice && <div className="text-xs text-slate-400 mt-1 font-mono">ICE: {facture.client.ice}</div>}
        </div>

        <div className="card p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Facture</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Date :</span>
              <span className="font-medium">{new Date(facture.dateFacture).toLocaleDateString('fr-FR')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total lignes :</span>
              <span>{facture.totalLignes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total articles :</span>
              <span>{Number(facture.totalArticles)}</span>
            </div>
          </div>
        </div>

        <div className="card p-4 bg-indigo-50 border-indigo-200">
          <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-2">Totaux</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Total HT :</span>
              <span className="font-medium">{formatMontant(Number(facture.totalHt))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total TVA :</span>
              <span>{formatMontant(Number(facture.totalTva))}</span>
            </div>
            <div className="flex justify-between text-base border-t border-indigo-200 pt-1 mt-1">
              <span className="font-semibold text-indigo-700">Total TTC :</span>
              <span className="font-bold text-indigo-700">{formatMontant(Number(facture.totalTtc))} MAD</span>
            </div>
            <div className="flex justify-between text-xs border-t border-indigo-100 pt-1 mt-1">
              <span className="text-slate-400">Marge HT :</span>
              <span className="text-emerald-600 font-medium">{formatMontant(Number(facture.margeHt))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lignes */}
      <div className="card mb-4 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 font-display">Lignes de facture</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Désignation</th><th>Quantité</th>
                <th>PU HT</th><th>Remise</th><th>TVA %</th>
                <th>Montant HT</th><th>Montant TTC</th>
              </tr>
            </thead>
            <tbody>
              {facture.lignes.map((l) => (
                <tr key={l.id}>
                  <td className="text-slate-400 text-xs">{l.ordreLigne}</td>
                  <td className="font-medium text-slate-800">{l.designation}</td>
                  <td>{Number(l.quantite)}</td>
                  <td>{formatMontant(Number(l.prixUnitaireHt))}</td>
                  <td>
                    {Number(l.remisePourcentage) > 0
                      ? <span className="badge badge-warning">{Number(l.remisePourcentage)}%</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="text-slate-500">{Number(l.tauxTva)}%</td>
                  <td>{formatMontant(Number(l.montantHt))}</td>
                  <td className="font-semibold text-indigo-600">{formatMontant(Number(l.montantTtc))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr>
                <td colSpan={6} className="px-4 py-2 text-right text-sm font-medium text-slate-500">Totaux</td>
                <td className="px-4 py-2 font-semibold">{formatMontant(Number(facture.totalHt))}</td>
                <td className="px-4 py-2 font-bold text-indigo-700">{formatMontant(Number(facture.totalTtc))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Paiement */}
      {facture.paiement && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 font-display">Paiement</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="form-label">Statut</div>
              {estPayee
                ? <span className="badge badge-success">Payée</span>
                : <span className="badge badge-warning">En attente</span>}
            </div>
            <div>
              <div className="form-label">Date encaissement</div>
              <div>{facture.paiement.datePaiement
                ? new Date(facture.paiement.datePaiement).toLocaleDateString('fr-FR')
                : '—'}</div>
            </div>
            <div>
              <div className="form-label">Mode de règlement</div>
              <div>{facture.paiement.modeReglement?.libelle ?? '—'}</div>
            </div>
            <div>
              <div className="form-label">N° pièce</div>
              <div className="font-mono">{facture.paiement.numeroPiece ?? '—'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

