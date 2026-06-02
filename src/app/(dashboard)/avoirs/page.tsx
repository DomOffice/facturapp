// src/app/(dashboard)/avoirs/page.tsx
export const dynamic = 'force-dynamic'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatMontant } from '@/lib/utils/currency'

export default async function AvoirsPage() {
  const avoirs = await prisma.avoir.findMany({
    include: {
      client: { select: { raisonSociale: true } },
      facture: { select: { numeroFacture: true } },
    },
    orderBy: { id: 'desc' },
  })

  return (
    <div className="p-4 md:p-6">
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Avoirs</h1>
          <p className="text-sm text-slate-400 mt-0.5">{avoirs.length} avoir(s)</p>
        </div>
      </div>

      <div className="card p-3 mb-4 bg-amber-50 border border-amber-200 text-sm text-amber-700">
        Un avoir est créé depuis la page de détail d'une facture validée via le bouton <strong>Avoir</strong>.
      </div>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>N° Avoir</th><th>Facture liée</th><th>Client</th>
              <th>Date</th><th>Total HT</th><th>Total TTC</th><th></th>
            </tr>
          </thead>
          <tbody>
            {avoirs.map(a => (
              <tr key={a.id}>
                <td className="font-mono font-semibold text-amber-600">{a.numeroAvoir}</td>
                <td>
                  <Link href={`/factures/${a.factureId}`} className="text-indigo-600 font-mono hover:underline">
                    {a.facture.numeroFacture}
                  </Link>
                </td>
                <td className="max-w-xs truncate">{a.client.raisonSociale}</td>
                <td className="text-slate-500">{new Date(a.dateAvoir).toLocaleDateString('fr-FR')}</td>
                <td>{formatMontant(Number(a.totalHt))}</td>
                <td className="font-semibold text-amber-700">{formatMontant(Number(a.totalTtc))}</td>
                <td>
                  <Link href={`/avoirs/${a.id}`} className="btn-ghost btn-sm">Voir</Link>
                </td>
              </tr>
            ))}
            {avoirs.length === 0 && (
              <tr><td colSpan={7} className="text-center text-slate-400 py-10">Aucun avoir</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
