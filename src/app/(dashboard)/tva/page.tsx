// src/app/(dashboard)/tva/page.tsx
import prisma from '@/lib/db/prisma'
import { formatMontant } from '@/lib/utils/currency'

export default async function TvaPage({
  searchParams,
}: {
  searchParams: { debut?: string; fin?: string; clientId?: string }
}) {
  const debut = searchParams.debut ? new Date(searchParams.debut) : new Date(new Date().getFullYear(), 0, 1)
  const fin = searchParams.fin ? new Date(searchParams.fin) : new Date(new Date().getFullYear(), 11, 31)
  const clientId = searchParams.clientId ? Number(searchParams.clientId) : undefined

  const [factures, charges, clients] = await Promise.all([
    prisma.facture.findMany({
      where: {
        statut: 'validee',
        dateFacture: { gte: debut, lte: fin },
        ...(clientId ? { clientId } : {}),
      },
      include: {
        client: { select: { raisonSociale: true } },
        lignes: { select: { tauxTva: true, montantHt: true, montantTva: true } },
      },
      orderBy: { dateFacture: 'asc' },
    }),
    prisma.charge.findMany({
      where: { dateCharge: { gte: debut, lte: fin } },
      select: { montantHt: true, montantTva: true, tauxTva: true },
    }),
    prisma.client.findMany({
      where: { actif: true },
      orderBy: { raisonSociale: 'asc' },
      select: { id: true, raisonSociale: true },
    }),
  ])

  // TVA perçue (sur factures émises)
  const tvaPercue = factures.reduce((s, f) => s + f.lignes.reduce((ls, l) => ls + Number(l.montantTva), 0), 0)
  const htPercue = factures.reduce((s, f) => s + f.lignes.reduce((ls, l) => ls + Number(l.montantHt), 0), 0)

  // TVA payée (sur charges)
  const tvaPayee = charges.reduce((s, c) => s + Number(c.montantTva), 0)
  const htCharge = charges.reduce((s, c) => s + Number(c.montantHt), 0)

  // TVA à régler
  const tvaARegler = Math.max(0, tvaPercue - tvaPayee)

  // Détail par taux TVA (factures)
  const parTaux: Record<string, { ht: number; tva: number; nb: number }> = {}
  for (const f of factures) {
    for (const l of f.lignes) {
      const taux = String(l.tauxTva)
      if (!parTaux[taux]) parTaux[taux] = { ht: 0, tva: 0, nb: 0 }
      parTaux[taux].ht += Number(l.montantHt)
      parTaux[taux].tva += Number(l.montantTva)
      parTaux[taux].nb++
    }
  }

  const debutStr = debut.toISOString().split('T')[0]
  const finStr = fin.toISOString().split('T')[0]

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">TVA</h1>
      </div>

      {/* Filtres */}
      <form method="GET" className="card mb-6 p-4 flex gap-4 flex-wrap items-end">
        <div>
          <label className="form-label">Date début</label>
          <input type="date" name="debut" defaultValue={debutStr} className="form-input" />
        </div>
        <div>
          <label className="form-label">Date fin</label>
          <input type="date" name="fin" defaultValue={finStr} className="form-input" />
        </div>
        <div>
          <label className="form-label">Client</label>
          <select name="clientId" defaultValue={clientId ?? ''} className="form-select w-52">
            <option value="">Tous les clients</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.raisonSociale}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">Calculer</button>
        <a href="/tva" className="btn-secondary">Réinitialiser</a>
      </form>

      {/* KPIs TVA */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="kpi-card border-l-4 border-indigo-400">
          <div className="kpi-label">TVA perçue</div>
          <div className="kpi-value text-indigo-600">{formatMontant(tvaPercue)}</div>
          <div className="text-xs text-slate-400 mt-1">Base HT : {formatMontant(htPercue)} MAD</div>
        </div>
        <div className="kpi-card border-l-4 border-amber-400">
          <div className="kpi-label">TVA payée (charges)</div>
          <div className="kpi-value text-amber-600">{formatMontant(tvaPayee)}</div>
          <div className="text-xs text-slate-400 mt-1">Base HT : {formatMontant(htCharge)} MAD</div>
        </div>
        <div className="kpi-card border-l-4 border-emerald-400">
          <div className="kpi-label">TVA à régler</div>
          <div className={`kpi-value ${tvaARegler > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
            {formatMontant(tvaARegler)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Perçue − Payée</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Détail par taux */}
        <div className="card">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700 font-display">Répartition par taux TVA</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Taux</th>
                <th>Base HT</th>
                <th>TVA</th>
                <th>Nb lignes</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(parTaux)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([taux, data]) => (
                  <tr key={taux}>
                    <td><span className="badge badge-info">{taux}%</span></td>
                    <td>{formatMontant(data.ht)}</td>
                    <td className="font-semibold text-indigo-600">{formatMontant(data.tva)}</td>
                    <td className="text-slate-400">{data.nb}</td>
                  </tr>
                ))}
              {Object.keys(parTaux).length === 0 && (
                <tr><td colSpan={4} className="text-center text-slate-400 py-6">Aucune donnée</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Détail factures */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700 font-display">
              Factures ({factures.length})
            </h2>
          </div>
          <div className="overflow-y-auto max-h-72">
            <table className="data-table text-xs">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>HT</th>
                  <th>TVA</th>
                </tr>
              </thead>
              <tbody>
                {factures.map(f => (
                  <tr key={f.id}>
                    <td className="font-mono text-indigo-600">{f.numeroFacture}</td>
                    <td className="max-w-24 truncate">{f.client.raisonSociale}</td>
                    <td className="text-slate-400">{new Date(f.dateFacture).toLocaleDateString('fr-FR')}</td>
                    <td>{formatMontant(Number(f.totalHt))}</td>
                    <td className="font-semibold">{formatMontant(Number(f.totalTva))}</td>
                  </tr>
                ))}
                {factures.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-slate-400 py-6">Aucune facture</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
