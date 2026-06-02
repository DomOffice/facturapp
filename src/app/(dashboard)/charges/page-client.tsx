'use client'
// src/app/(dashboard)/charges/page-client.tsx
import { useState } from 'react'
import { exporterChargesExcel } from '@/lib/exports/excel/export-excel'
import { useRouter } from 'next/navigation'
import { arrondi2, formatMontant } from '@/lib/utils/currency'

type Charge = {
  id: number
  dateCharge: string
  numeroFacture: string | null
  emetteur: string
  typeChargeLibelle: string
  typeChargeId: number
  montantHt: number
  tauxTva: number
  montantTva: number
  montantTtc: number
  remarque: string | null
}
type Option = { id: number; libelle: string; valeurNum?: number | null }

export default function ChargesClient({ charges, typesCharge, tauxTva, totalTtc }: {
  charges: Charge[]
  typesCharge: Option[]
  tauxTva: Option[]
  totalTtc: number
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [loadingExcel, setLoadingExcel] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    numeroFacture: '',
    emetteur: '',
    typeChargeId: '',
    montantHt: '',
    tauxTvaId: '',
    remarque: '',
  })

  const tauxTvaVal = tauxTva.find(t => t.id === Number(form.tauxTvaId))?.valeurNum ?? 0
  const montantTva = arrondi2(Number(form.montantHt) * Number(tauxTvaVal) / 100)
  const montantTtc = arrondi2(Number(form.montantHt) + montantTva)

  async function handleExcelExport() {
    setLoadingExcel(true)
    try {
      await exporterChargesExcel(charges.map(c => ({
        dateCharge: c.dateCharge,
        numeroFacture: c.numeroFacture,
        emetteur: c.emetteur,
        typeCharge: c.typeChargeLibelle,
        montantHt: c.montantHt,
        tauxTva: c.tauxTva,
        montantTva: c.montantTva,
        montantTtc: c.montantTtc,
        remarque: c.remarque,
      })))
    } catch { alert('Erreur export Excel') }
    finally { setLoadingExcel(false) }
  }

  async function ajouter() {
    if (!form.emetteur || !form.montantHt || !form.typeChargeId) {
      setError('Emetteur, type et montant HT sont obligatoires')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateCharge: form.date,
          numeroFacture: form.numeroFacture || null,
          emetteur: form.emetteur,
          typeChargeId: Number(form.typeChargeId),
          montantHt: Number(form.montantHt),
          tauxTva: Number(tauxTvaVal),
          montantTva,
          montantTtc,
          remarque: form.remarque || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setForm({ date: new Date().toISOString().split('T')[0], numeroFacture: '', emetteur: '', typeChargeId: '', montantHt: '', tauxTvaId: '', remarque: '' })
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Charges</h1>
          <p className="text-sm text-slate-400 mt-0.5">Total TTC : <span className="font-semibold text-slate-700">{formatMontant(totalTtc)} MAD</span></p>
        </div>
        <button type="button" onClick={handleExcelExport} disabled={loadingExcel}
          className="btn-secondary btn-sm flex items-center gap-1.5">
          {loadingExcel
            ? <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/><path d="M5 5h6M5 8h3M8 11v3M6 13l2 2 2-2"/></svg>}
          Excel
        </button>
      </div>

      {/* Formulaire ajout */}
      <div className="card p-4 mb-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-3">Ajouter une charge</h2>
        {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="form-label">Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="form-input" />
          </div>
          <div>
            <label className="form-label">Num Facture</label>
            <input value={form.numeroFacture} onChange={e => setForm(f => ({ ...f, numeroFacture: e.target.value }))} className="form-input" placeholder="Optionnel" />
          </div>
          <div>
            <label className="form-label">Emetteur *</label>
            <input value={form.emetteur} onChange={e => setForm(f => ({ ...f, emetteur: e.target.value }))} className="form-input" placeholder="Nom de l'émetteur" />
          </div>
          <div>
            <label className="form-label">Type *</label>
            <select value={form.typeChargeId} onChange={e => setForm(f => ({ ...f, typeChargeId: e.target.value }))} className="form-select">
              <option value="">— Sélectionner —</option>
              {typesCharge.map(t => <option key={t.id} value={t.id}>{t.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Montant HT *</label>
            <input type="number" step="0.01" value={form.montantHt} onChange={e => setForm(f => ({ ...f, montantHt: e.target.value }))} className="form-input" placeholder="0.00" />
          </div>
          <div>
            <label className="form-label">TVA</label>
            <select value={form.tauxTvaId} onChange={e => setForm(f => ({ ...f, tauxTvaId: e.target.value }))} className="form-select">
              <option value="">0%</option>
              {tauxTva.map(t => <option key={t.id} value={t.id}>{t.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Montant TVA / TTC</label>
            <div className="text-sm py-2 px-3 bg-slate-50 rounded-lg border border-slate-200">
              {formatMontant(montantTva)} / <span className="font-semibold text-indigo-600">{formatMontant(montantTtc)}</span>
            </div>
          </div>
          <div>
            <label className="form-label">Remarque</label>
            <input value={form.remarque} onChange={e => setForm(f => ({ ...f, remarque: e.target.value }))} className="form-input" placeholder="Optionnel" />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={ajouter} disabled={saving} className="btn-primary">{saving ? 'Ajout...' : 'Ajouter'}</button>
          <button onClick={() => setForm({ date: new Date().toISOString().split('T')[0], numeroFacture: '', emetteur: '', typeChargeId: '', montantHt: '', tauxTvaId: '', remarque: '' })} className="btn-secondary">Annuler</button>
        </div>
      </div>

      {/* Liste */}
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr><th>ID</th><th>Date</th><th>N° Facture</th><th>Emetteur</th><th>Type</th><th>Montant HT</th><th>% TVA</th><th>Montant TVA</th><th>Montant TTC</th></tr>
          </thead>
          <tbody>
            {charges.map(c => (
              <tr key={c.id}>
                <td className="text-slate-400 text-xs">{c.id}</td>
                <td className="text-slate-500">{new Date(c.dateCharge).toLocaleDateString('fr-FR')}</td>
                <td className="font-mono text-xs">{c.numeroFacture ?? '—'}</td>
                <td className="font-medium">{c.emetteur}</td>
                <td><span className="badge badge-info">{c.typeChargeLibelle}</span></td>
                <td>{formatMontant(c.montantHt)}</td>
                <td className="text-slate-500">{c.tauxTva}%</td>
                <td>{formatMontant(c.montantTva)}</td>
                <td className="font-semibold text-indigo-600">{formatMontant(c.montantTtc)}</td>
              </tr>
            ))}
            {charges.length === 0 && (
              <tr><td colSpan={9} className="text-center text-slate-400 py-10">Aucune charge enregistrée</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
