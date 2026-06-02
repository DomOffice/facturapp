'use client'
// src/app/(dashboard)/devis/nouveau/page-client.tsx
// Même logique que saisie facture — libellés adaptés

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { calculerLigne, calculerTotauxFacture, formatMontant, arrondi2 } from '@/lib/utils/currency'

type Produit = {
  id: number
  reference: string
  description: string
  prixVenteHt: number
  dernierPrixAchatHt: number
  tauxTva?: { valeurNum: number | null } | null
}
type Client = { id: number; raisonSociale: string }
type Ligne = {
  tempId: string; produitId: number | null; designation: string
  quantite: number; prixAchatHt: number; prixUnitaireHt: number
  remisePourcentage: number; tauxTva: number
  montantHt: number; montantTva: number; montantTtc: number
}

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

type DevisExistant = {
  id: number
  clientId: number
  dateDevis: string
  dateValidite: string
  remarque: string
  lignes: Ligne[]
}

export default function DevisNouveauClient({
  clients,
  prochainNumero,
  devisExistant,
}: {
  clients: Client[]
  prochainNumero: string
  devisExistant?: DevisExistant
}) {
  const router = useRouter()
  const [clientId, setClientId] = useState<number | null>(devisExistant?.clientId ?? null)
  const [dateDevis, setDateDevis] = useState(devisExistant?.dateDevis ?? new Date().toISOString().split('T')[0])
  const [dateValidite, setDateValidite] = useState(devisExistant?.dateValidite ?? '')
  const [remarque, setRemarque] = useState(devisExistant?.remarque ?? '')
  const [lignes, setLignes] = useState<Ligne[]>(devisExistant?.lignes ?? [])
  const [produits, setProduits] = useState<Produit[]>([])
  const [searchProduit, setSearchProduit] = useState('')
  const [saving, setSaving] = useState(false)
  const [popupOpen, setPopupOpen] = useState(false)
  const popupProduitRef = useRef<Produit | null>(null)
  const editLigneIdRef = useRef<string | null>(null)
  const [popupQte, setPopupQte] = useState('1')
  const [popupDesc, setPopupDesc] = useState('')
  const qteInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/produits?q=${encodeURIComponent(searchProduit)}&actif=true`)
      .then(r => r.json()).then(setProduits).catch(() => {})
  }, [searchProduit])

  useEffect(() => {
    if (popupOpen) setTimeout(() => qteInputRef.current?.focus(), 50)
  }, [popupOpen])

  const totaux = calculerTotauxFacture(lignes.map(l => ({
    quantite: l.quantite, prixAchatHt: l.prixAchatHt,
    montantHt: l.montantHt, montantTva: l.montantTva, montantTtc: l.montantTtc,
  })))

  function ouvrirPopup(produit: Produit) {
    popupProduitRef.current = produit
    editLigneIdRef.current = null
    setPopupQte('1'); setPopupDesc(produit.description); setPopupOpen(true)
  }

  function validerPopup() {
    const produit = popupProduitRef.current
    const editId = editLigneIdRef.current
    if (!produit) return
    let qte = 1
    try { const r = Function('"use strict"; return (' + popupQte + ')')(); qte = arrondi2(Number(r)); if (isNaN(qte) || qte <= 0) qte = 1 }
    catch { qte = parseFloat(popupQte) || 1 }
    const tauxTva = Number(produit.tauxTva?.valeurNum ?? 20)
    const calc = calculerLigne(qte, Number(produit.prixVenteHt), editId ? (lignes.find(l => l.tempId === editId)?.remisePourcentage ?? 0) : 0, tauxTva)
    const ligne: Ligne = {
      tempId: editId ?? genId(), produitId: produit.id, designation: produit.description,
      quantite: qte, prixAchatHt: Number(produit.dernierPrixAchatHt), prixUnitaireHt: Number(produit.prixVenteHt),
      remisePourcentage: editId ? (lignes.find(l => l.tempId === editId)?.remisePourcentage ?? 0) : 0,
      tauxTva, ...calc,
    }
    if (editId) setLignes(prev => prev.map(l => l.tempId === editId ? ligne : l))
    else setLignes(prev => [...prev, ligne])
    setPopupOpen(false)
  }

  async function sauvegarder() {
    if (!clientId) return alert('Veuillez sélectionner un client')
    if (lignes.length === 0) return alert('Veuillez ajouter au moins un article')
    setSaving(true)
    try {
      const url = devisExistant ? `/api/devis/${devisExistant.id}` : '/api/devis'
      const res = await fetch(url, {
        method: devisExistant ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, dateDevis, dateValidite: dateValidite || null, remarque, lignes: lignes.map((l, i) => ({ ...l, ordreLigne: i + 1 })) }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const d = await res.json()
      router.push(`/devis/${d.id}`)
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Erreur') }
    finally { setSaving(false) }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">Nouveau devis — <span className="text-indigo-600">{prochainNumero}</span></h1>
        <div className="flex gap-2">
          <button type="button" onClick={sauvegarder} disabled={saving} className="btn-primary">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-ghost">Annuler</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="col-span-2 card p-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="form-label">Client *</label>
              <select value={clientId ?? ''} onChange={e => setClientId(Number(e.target.value) || null)} className="form-select">
                <option value="">— Client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.raisonSociale}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Date devis</label>
              <input type="date" value={dateDevis} onChange={e => setDateDevis(e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="form-label">Valable jusqu'au</label>
              <input type="date" value={dateValidite} onChange={e => setDateValidite(e.target.value)} className="form-input" />
            </div>
          </div>
          <div className="mt-3">
            <label className="form-label">Remarque</label>
            <input value={remarque} onChange={e => setRemarque(e.target.value)} className="form-input" placeholder="Remarque optionnelle" />
          </div>
        </div>
        <div className="card p-4 flex flex-col justify-center gap-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Total HT</span><span className="font-semibold">{formatMontant(totaux.totalHt)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Total TVA</span><span>{formatMontant(totaux.totalTva)}</span></div>
          <div className="flex justify-between text-indigo-600 text-base"><span className="font-semibold">Total TTC</span><span className="font-bold">{formatMontant(totaux.totalTtc)}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Lignes du devis — double clic pour modifier
          </div>
          <table className="data-table text-xs">
            <thead><tr><th>#</th><th>Désignation</th><th>Qté</th><th>PU HT</th><th>TVA%</th><th>Montant HT</th><th>TTC</th><th></th></tr></thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={l.tempId} onDoubleClick={() => { popupProduitRef.current = produits.find(p => p.id === l.produitId) ?? null; editLigneIdRef.current = l.tempId; setPopupQte(String(l.quantite)); setPopupDesc(l.designation); setPopupOpen(true) }} className="hover:bg-indigo-50">
                  <td>{i + 1}</td><td className="max-w-32 truncate font-medium">{l.designation}</td>
                  <td>{l.quantite}</td><td>{formatMontant(l.prixUnitaireHt)}</td>
                  <td>{l.tauxTva}%</td><td>{formatMontant(l.montantHt)}</td>
                  <td className="font-semibold text-indigo-600">{formatMontant(l.montantTtc)}</td>
                  <td><button type="button" onClick={() => setLignes(prev => prev.filter(x => x.tempId !== l.tempId))} className="text-red-400 hover:text-red-600 text-xs">✕</button></td>
                </tr>
              ))}
              {lignes.length === 0 && <tr><td colSpan={8} className="text-center text-slate-300 py-6 text-xs">Double clic sur un article pour l&apos;ajouter</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Articles</span>
            <input placeholder="Rechercher..." value={searchProduit} onChange={e => setSearchProduit(e.target.value)} className="form-input flex-1 text-xs py-1" />
          </div>
          <div className="overflow-y-auto max-h-80">
            <table className="data-table text-xs">
              <thead><tr><th>Référence</th><th>Description</th><th>PV HT</th><th>TVA</th><th>PV TTC</th></tr></thead>
              <tbody>
                {produits.map(p => (
                  <tr key={p.id} onDoubleClick={() => ouvrirPopup(p)} className="hover:bg-indigo-50 cursor-pointer">
                    <td className="text-slate-400">{p.reference}</td>
                    <td className="font-medium max-w-32 truncate">{p.description}</td>
                    <td>{formatMontant(Number(p.prixVenteHt))}</td>
                    <td>{p.tauxTva?.valeurNum ?? 0}%</td>
                    <td className="font-semibold text-indigo-600">{formatMontant(arrondi2(Number(p.prixVenteHt) * (1 + Number(p.tauxTva?.valeurNum ?? 0) / 100)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {popupOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={e => { if (e.target === e.currentTarget) setPopupOpen(false) }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96 border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-1">Saisie de quantité</h3>
            <p className="text-sm text-slate-500 mb-3">Article : <span className="font-medium">{popupDesc}</span></p>
            <input ref={qteInputRef} value={popupQte} onChange={e => setPopupQte(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); validerPopup() } if (e.key === 'Escape') setPopupOpen(false) }}
              className="form-input mb-4 text-lg font-semibold" placeholder="1" />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={validerPopup} className="btn-primary">OK</button>
              <button type="button" onClick={() => setPopupOpen(false)} className="btn-secondary">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
