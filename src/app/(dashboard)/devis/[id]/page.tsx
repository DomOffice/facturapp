// src/app/(dashboard)/devis/[id]/page.tsx
export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatMontant } from '@/lib/utils/currency'
import DevisActions from './devis-actions'

export default async function DevisDetailPage({ params }: { params: { id: string } }) {
  const devis = await prisma.devis.findUnique({
    where: { id: Number(params.id) },
    include: {
      client: true,
      lignes: { orderBy: { ordreLigne: 'asc' } },
    },
  })
  if (!devis) notFound()

  const devisData = {
    id: devis.id,
    numeroDevis: devis.numeroDevis,
    dateDevis: devis.dateDevis.toISOString(),
    dateValidite: devis.dateValidite?.toISOString() ?? null,
    statut: devis.statut,
    remarque: devis.remarque,
    client: {
      id: devis.client.id,
      raisonSociale: devis.client.raisonSociale,
      adresse: devis.client.adresse,
      codePostal: devis.client.codePostal,
      ville: devis.client.ville,
      telephone: devis.client.telephone,
      ice: devis.client.ice,
      email: devis.client.email,
    },
    lignes: devis.lignes.map(l => ({
      ordreLigne: l.ordreLigne,
      designation: l.designation,
      quantite: Number(l.quantite),
      prixUnitaireHt: Number(l.prixUnitaireHt),
      remisePourcentage: Number(l.remisePourcentage),
      tauxTva: Number(l.tauxTva),
      montantHt: Number(l.montantHt),
      montantTva: Number(l.montantTva),
      montantTtc: Number(l.montantTtc),
    })),
    totalHt: Number(devis.totalHt),
    totalTva: Number(devis.totalTva),
    totalTtc: Number(devis.totalTtc),
    totalArticles: Number(devis.totalTtc), // approx
    totalLignes: devis.lignes.length,
  }

  const statutBadge = {
    brouillon: <span className="badge badge-neutral">Brouillon</span>,
    envoye: <span className="badge badge-info">Envoyé</span>,
    accepte: <span className="badge badge-success">Accepté</span>,
    refuse: <span className="badge badge-danger">Refusé</span>,
  }[devis.statut] ?? <span className="badge badge-neutral">{devis.statut}</span>

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title font-mono">{devis.numeroDevis}</h1>
          <div className="flex items-center gap-2 mt-1">{statutBadge}</div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Link href="/devis" className="btn-ghost btn-sm">← Retour</Link>
          <Link href={`/devis/${devis.id}/modifier`} className="btn-secondary btn-sm">Modifier</Link>
          <DevisActions devis={devisData} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Client</div>
          <div className="font-semibold text-slate-800">{devis.client.raisonSociale}</div>
          {devis.client.adresse && <div className="text-sm text-slate-500 mt-1">{devis.client.adresse}</div>}
          {devis.client.ville && <div className="text-sm text-slate-500">{devis.client.codePostal} {devis.client.ville}</div>}
          {devis.client.telephone && <div className="text-sm text-slate-500">{devis.client.telephone}</div>}
          {devis.client.ice && <div className="text-xs text-slate-400 mt-1 font-mono">ICE: {devis.client.ice}</div>}
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Devis</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Date :</span><span className="font-medium">{new Date(devis.dateDevis).toLocaleDateString('fr-FR')}</span></div>
            {devis.dateValidite && <div className="flex justify-between"><span className="text-slate-500">Valable jusqu'au :</span><span className="font-medium">{new Date(devis.dateValidite).toLocaleDateString('fr-FR')}</span></div>}
            <div className="flex justify-between"><span className="text-slate-500">Nb lignes :</span><span>{devis.lignes.length}</span></div>
            {devis.remarque && <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-500">{devis.remarque}</div>}
          </div>
        </div>
        <div className="card p-4 bg-indigo-50 border-indigo-200">
          <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-2">Totaux</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Total HT :</span><span className="font-medium">{formatMontant(Number(devis.totalHt))}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total TVA :</span><span>{formatMontant(Number(devis.totalTva))}</span></div>
            <div className="flex justify-between text-base border-t border-indigo-200 pt-1 mt-1">
              <span className="font-semibold text-indigo-700">Total TTC :</span>
              <span className="font-bold text-indigo-700">{formatMontant(Number(devis.totalTtc))} MAD</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 font-display">Lignes du devis</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>Désignation</th><th>Quantité</th><th>PU HT</th><th>Remise</th><th>TVA %</th><th>Montant HT</th><th>Montant TTC</th></tr>
            </thead>
            <tbody>
              {devis.lignes.map(l => (
                <tr key={l.id}>
                  <td className="text-slate-400 text-xs">{l.ordreLigne}</td>
                  <td className="font-medium text-slate-800">{l.designation}</td>
                  <td>{Number(l.quantite)}</td>
                  <td>{formatMontant(Number(l.prixUnitaireHt))}</td>
                  <td>{Number(l.remisePourcentage) > 0 ? <span className="badge badge-warning">{Number(l.remisePourcentage)}%</span> : <span className="text-slate-300">—</span>}</td>
                  <td className="text-slate-500">{Number(l.tauxTva)}%</td>
                  <td>{formatMontant(Number(l.montantHt))}</td>
                  <td className="font-semibold text-indigo-600">{formatMontant(Number(l.montantTtc))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr>
                <td colSpan={6} className="px-4 py-2 text-right text-sm font-medium text-slate-500">Totaux</td>
                <td className="px-4 py-2 font-semibold">{formatMontant(Number(devis.totalHt))}</td>
                <td className="px-4 py-2 font-bold text-indigo-700">{formatMontant(Number(devis.totalTtc))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
