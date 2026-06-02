export const dynamic = 'force-dynamic'
// src/app/(dashboard)/page.tsx
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatMontant } from '@/lib/utils/currency'
import { deleteUtilisateur } from './utilisateurs/actions'

// Removed duplicate export default function UtilisateursPage() { ... }

async function getDashboardData() {
  const [totalFactures, facturesNonPayees, chiffreAffaires, totalCharges, dernieresFactures] = await Promise.all([
    prisma.facture.count({ where: { statut: 'validee' } }),
    prisma.paiement.count({ where: { datePaiement: null } }),
    prisma.facture.aggregate({ _sum: { totalTtc: true }, where: { statut: 'validee' } }),
    prisma.charge.aggregate({ _sum: { montantTtc: true } }),
    prisma.facture.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { raisonSociale: true } }, paiement: true },
    }),
  ])
  return { totalFactures, facturesNonPayees, chiffreAffaires, totalCharges, dernieresFactures }
}

export default async function DashboardPage() {
  const data = await getDashboardData()
  const ca = Number(data.chiffreAffaires._sum.totalTtc ?? 0)
  const charges = Number(data.totalCharges._sum.montantTtc ?? 0)

  return (
    <div className="p-4 md:p-6">
      {/* En-tête */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="text-sm text-slate-400 mt-0.5 hidden md:block">Vue d'ensemble de votre activité</p>
        </div>
        <Link href="/factures/nouvelle" className="btn-primary text-sm">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 1v14M1 8h14"/></svg>
          <span className="hidden sm:inline">Nouvelle facture</span>
          <span className="sm:hidden">Nouveau</span>
        </Link>
      </div>

      {/* KPIs — 2 colonnes sur mobile, 4 sur desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="kpi-card">
          <div className="kpi-label">CA TTC</div>
          <div className="kpi-value text-lg md:text-2xl">{formatMontant(ca)}</div>
          <div className="text-xs text-slate-400 mt-1">MAD</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Factures</div>
          <div className="kpi-value text-lg md:text-2xl">{data.totalFactures}</div>
          <div className="text-xs text-slate-400 mt-1">validées</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Non encaissées</div>
          <div className="kpi-value text-lg md:text-2xl text-amber-600">{data.facturesNonPayees}</div>
          <div className="text-xs text-slate-400 mt-1">en attente</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Charges</div>
          <div className="kpi-value text-lg md:text-2xl">{formatMontant(charges)}</div>
          <div className="text-xs text-slate-400 mt-1">MAD TTC</div>
        </div>
      </div>

      {/* Dernières factures */}
      <div className="card">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 font-display">Dernières factures</h2>
          <Link href="/factures" className="text-xs text-indigo-500 hover:text-indigo-700">Voir tout →</Link>
        </div>

        {/* VERSION MOBILE — cartes */}
        <div className="md:hidden divide-y divide-slate-50">
          {data.dernieresFactures.map((f) => (
            <Link key={f.id} href={`/factures/${f.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 active:bg-slate-100">
              <div>
                <div className="text-sm font-semibold text-indigo-600">{f.numeroFacture}</div>
                <div className="text-xs text-slate-500 truncate max-w-40">{f.client.raisonSociale}</div>
                <div className="text-xs text-slate-400">{new Date(f.dateFacture).toLocaleDateString('fr-FR')}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-slate-800">{formatMontant(Number(f.totalTtc))}</div>
                <div className="mt-1">
                  {f.statut === 'validee' && f.paiement?.datePaiement
                    ? <span className="badge badge-success">Payée</span>
                    : f.statut === 'validee'
                    ? <span className="badge badge-warning">Attente</span>
                    : <span className="badge badge-neutral">Brouillon</span>}
                </div>
              </div>
            </Link>
          ))}
          {data.dernieresFactures.length === 0 && (
            <div className="text-center text-slate-400 py-8 text-sm">Aucune facture</div>
          )}
        </div>

        {/* VERSION DESKTOP — tableau */}
        <div className="hidden md:block overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>N° Facture</th><th>Client</th><th>Date</th>
                <th>Total HT</th><th>Total TTC</th><th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {data.dernieresFactures.map((f) => (
                <tr key={f.id}>
                  <td><Link href={`/factures/${f.id}`} className="text-indigo-600 font-medium hover:underline">{f.numeroFacture}</Link></td>
                  <td className="max-w-xs truncate">{f.client.raisonSociale}</td>
                  <td className="text-slate-500">{new Date(f.dateFacture).toLocaleDateString('fr-FR')}</td>
                  <td className="font-medium">{formatMontant(Number(f.totalHt))}</td>
                  <td className="font-medium">{formatMontant(Number(f.totalTtc))}</td>
                  <td>
                    {f.statut === 'validee' && f.paiement?.datePaiement
                      ? <span className="badge badge-success">Payée</span>
                      : f.statut === 'validee'
                      ? <span className="badge badge-warning">En attente</span>
                      : <span className="badge badge-neutral">Brouillon</span>}
                  </td>
                </tr>
              ))}
              {data.dernieresFactures.length === 0 && (
                <tr><td colSpan={6} className="text-center text-slate-400 py-8">Aucune facture</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}