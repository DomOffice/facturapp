'use client'
// src/app/(dashboard)/paiements/page-client.tsx
import { useState } from 'react'
import { exporterPaiementsExcel } from '@/lib/exports/excel/export-excel'
import { useRouter } from 'next/navigation'
import { formatMontant } from '@/lib/utils/currency'

type Paiement = {
  id: number
  factureId: number
  numeroFacture: string
  dateFacture: string
  clientId: number
  clientNom: string
  montantHt: number
  montantTtc: number
  datePaiement: string | null
  modeReglementId: number | null
  modeReglementLibelle: string | null
  numeroPiece: string | null
  remarque: string | null
  justificatifUrl: string | null
}

type Option = { id: number; libelle: string }

export default function PaiementsClient({
  paiements,
  clients,
  modesReglement,
  sommeHt,
  sommeTtc,
  filtreNonPaye,
  filtreClientId,
}: {
  paiements: Paiement[]
  clients: Option[]
  modesReglement: Option[]
  sommeHt: number
  sommeTtc: number
  filtreNonPaye: boolean
  filtreClientId: number | null
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Paiement | null>(null)
  const [datePaiement, setDatePaiement] = useState('')
  const [modeReglementId, setModeReglementId] = useState<number | null>(null)
  const [numeroPiece, setNumeroPiece] = useState('')
  const [remarque, setRemarque] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingExcel, setLoadingExcel] = useState(false)

  function selectPaiement(p: Paiement) {
    setSelected(p)
    setDatePaiement(p.datePaiement ? p.datePaiement.split('T')[0] : '')
    setModeReglementId(p.modeReglementId)
    setNumeroPiece(p.numeroPiece ?? '')
    setRemarque(p.remarque ?? '')
  }

  async function sauvegarder() {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/paiements/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datePaiement: datePaiement || null, modeReglementId, numeroPiece, remarque }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setSelected(null)
      router.refresh()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function handleExcelExport() {
    setLoadingExcel(true)
    try {
      await exporterPaiementsExcel(paiements.map(p => ({
        numeroFacture: p.numeroFacture,
        dateFacture: p.dateFacture,
        clientNom: p.clientNom,
        montantHt: p.montantHt,
        montantTtc: p.montantTtc,
        datePaiement: p.datePaiement,
        modeReglement: p.modeReglementLibelle,
        numeroPiece: p.numeroPiece,
        remarque: p.remarque,
        estPayee: !!p.datePaiement,
      })))
    } catch { alert('Erreur export Excel') }
    finally { setLoadingExcel(false) }
  }

  return (
    <div className="p-6">
      <div className="page-header">
        <div className="flex items-center justify-between w-full">
        <h1 className="page-title">Suivi des paiements</h1>
        <button type="button" onClick={handleExcelExport} disabled={loadingExcel}
          className="btn-secondary btn-sm flex items-center gap-1.5">
          {loadingExcel
            ? <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/><path d="M5 5h6M5 8h3M8 11v3M6 13l2 2 2-2"/></svg>}
          Excel
        </button>
      </div>
      </div>

      {/* Filtres */}
      <form method="GET" className="card mb-4 p-3 flex gap-3 flex-wrap items-end">
        <div>
          <label className="form-label">Client</label>
          <select name="clientId" defaultValue={filtreClientId ?? ''} className="form-select w-52">
            <option value="">Tous les clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.libelle}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <input type="checkbox" name="payé" value="non" id="nonPaye" defaultChecked={filtreNonPaye} className="w-4 h-4" />
          <label htmlFor="nonPaye" className="text-sm text-slate-600">Non payées seulement</label>
        </div>
        <button type="submit" className="btn-secondary">Filtrer</button>
        <div className="ml-auto text-sm text-slate-500">
          Somme HT : <span className="font-semibold text-slate-700">{formatMontant(sommeHt)}</span>
          {' '} | Somme TTC : <span className="font-semibold text-indigo-600">{formatMontant(sommeTtc)}</span>
        </div>
      </form>

      {/* Panneau de saisie paiement */}
      {selected && (
        <div className="card mb-4 p-4 border-2 border-indigo-200 bg-indigo-50">
          <div className="flex items-center gap-6 mb-3 text-sm">
            <span><span className="text-slate-500">N° Facture :</span> <strong>{selected.numeroFacture}</strong></span>
            <span><span className="text-slate-500">Date :</span> {new Date(selected.dateFacture).toLocaleDateString('fr-FR')}</span>
            <span><span className="text-slate-500">Client :</span> <strong>{selected.clientNom}</strong></span>
            <span><span className="text-slate-500">Montant HT :</span> <strong>{formatMontant(selected.montantHt)}</strong></span>
            <span><span className="text-slate-500">Montant TTC :</span> <strong className="text-indigo-600">{formatMontant(selected.montantTtc)}</strong></span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="form-label">Date encaissement</label>
              <input type="date" value={datePaiement} onChange={e => setDatePaiement(e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="form-label">Mode de règlement</label>
              <select value={modeReglementId ?? ''} onChange={e => setModeReglementId(Number(e.target.value) || null)} className="form-select">
                <option value="">—</option>
                {modesReglement.map(m => <option key={m.id} value={m.id}>{m.libelle}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Numéro de la pièce</label>
              <input value={numeroPiece} onChange={e => setNumeroPiece(e.target.value)} className="form-input" placeholder="N° chèque, virement..." />
            </div>
            <div>
              <label className="form-label">Remarque</label>
              <input value={remarque} onChange={e => setRemarque(e.target.value)} className="form-input" placeholder="Optionnel" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={sauvegarder} disabled={saving} className="btn-primary">{saving ? 'Enregistrement...' : 'Valider'}</button>
            <button onClick={() => setSelected(null)} className="btn-secondary">Annuler</button>
          </div>
        </div>
      )}

      {/* Liste paiements */}
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>N° Facture</th>
              <th>Date</th>
              <th>Client</th>
              <th>Montant HT</th>
              <th>Montant TTC</th>
              <th>Date encaissement</th>
              <th>Mode règlement</th>
              <th>Numéro pièce</th>
              <th>Remarque</th>
              <th>Justif.</th>
            </tr>
          </thead>
          <tbody>
            {paiements.map((p) => (
              <tr
                key={p.id}
                onClick={() => selectPaiement(p)}
                className={`cursor-pointer ${selected?.id === p.id ? 'bg-indigo-50' : ''}`}
              >
                <td className="font-mono font-semibold text-indigo-600">{p.numeroFacture}</td>
                <td className="text-slate-500">{new Date(p.dateFacture).toLocaleDateString('fr-FR')}</td>
                <td className="max-w-xs truncate">{p.clientNom}</td>
                <td>{formatMontant(p.montantHt)}</td>
                <td className="font-semibold">{formatMontant(p.montantTtc)}</td>
                <td>
                  {p.datePaiement
                    ? <span className="badge badge-success">{new Date(p.datePaiement).toLocaleDateString('fr-FR')}</span>
                    : <span className="badge badge-warning">Non payée</span>}
                </td>
                <td className="text-slate-500">{p.modeReglementLibelle ?? '—'}</td>
                <td className="text-slate-500 font-mono">{p.numeroPiece ?? '—'}</td>
                <td className="text-slate-400">{p.remarque ?? '—'}</td>
                <td>{p.justificatifUrl ? <span className="badge badge-success">Oui</span> : '—'}</td>
              </tr>
            ))}
            {paiements.length === 0 && (
              <tr><td colSpan={10} className="text-center text-slate-400 py-10">Aucun paiement</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
