'use client'
// src/app/(dashboard)/factures/nouvelle/page-client.tsx
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
  tempId: string
  produitId: number | null
  designation: string
  quantite: number
  prixAchatHt: number
  prixUnitaireHt: number
  remisePourcentage: number
  tauxTva: number
  montantHt: number
  montantTva: number
  montantTtc: number
}

type FactureExistante = {
  id: number
  clientId: number
  dateFacture: string
  lignes: Ligne[]
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export default function NouvelleFactureClient({
  clients,
  prochainNumero,
  factureExistante,
}: {
  clients: Client[]
  prochainNumero: string
  factureExistante?: FactureExistante
}) {
  const router = useRouter()
  const [clientId, setClientId] = useState<number | null>(factureExistante?.clientId ?? null)
  const [dateFacture, setDateFacture] = useState(factureExistante?.dateFacture ?? new Date().toISOString().split('T')[0])
  const [lignes, setLignes] = useState<Ligne[]>(factureExistante?.lignes ?? [])
  const [produits, setProduits] = useState<Produit[]>([])
  const [searchProduit, setSearchProduit] = useState('')
  const [showPrixAchat, setShowPrixAchat] = useState(false)
  const [saving, setSaving] = useState(false)

  // Popup quantité
  const [popupOpen, setPopupOpen] = useState(false)
  const popupProduitRef = useRef<Produit | null>(null)
  const editLigneIdRef = useRef<string | null>(null)
  const [popupQte, setPopupQte] = useState('1')
  const [popupDesc, setPopupDesc] = useState('')
  const qteInputRef = useRef<HTMLInputElement>(null)

  // Popup remise
  const [popupRemise, setPopupRemise] = useState(false)
  const [popupRemiseLigneId, setPopupRemiseLigneId] = useState<string | null>(null)
  const [popupRemiseVal, setPopupRemiseVal] = useState('0')

  useEffect(() => {
    fetch(`/api/produits?q=${encodeURIComponent(searchProduit)}&actif=true`)
      .then(r => r.json()).then(setProduits).catch(() => {})
  }, [searchProduit])

  useEffect(() => {
    if (popupOpen) setTimeout(() => qteInputRef.current?.focus(), 50)
  }, [popupOpen])

  const totaux = calculerTotauxFacture(
    lignes.map(l => ({
      quantite: l.quantite, prixAchatHt: l.prixAchatHt,
      montantHt: l.montantHt, montantTva: l.montantTva, montantTtc: l.montantTtc,
    }))
  )

  function ouvrirPopupQte(produit: Produit) {
    popupProduitRef.current = produit
    editLigneIdRef.current = null
    setPopupQte('1')
    setPopupDesc(produit.description)
    setPopupOpen(true)
  }

  function modifierLigne(ligne: Ligne) {
    const prod = produits.find(p => p.id === ligne.produitId) ?? null
    popupProduitRef.current = prod
    editLigneIdRef.current = ligne.tempId
    setPopupQte(String(ligne.quantite))
    setPopupDesc(ligne.designation)
    setPopupOpen(true)
  }

  function validerPopupQte() {
    const produit = popupProduitRef.current
    const editLigneId = editLigneIdRef.current
    if (!produit) return

    let qte = 1
    try {
      // eslint-disable-next-line no-new-func
      const res = Function('"use strict"; return (' + popupQte + ')')()
      qte = arrondi2(Number(res))
      if (isNaN(qte) || qte <= 0) qte = 1
    } catch { qte = parseFloat(popupQte) || 1 }

    const tauxTva = Number(produit.tauxTva?.valeurNum ?? 20)
    const prixUnitaireHt = Number(produit.prixVenteHt)
    const prixAchatHt = Number(produit.dernierPrixAchatHt)
    const remise = editLigneId
      ? (lignes.find(l => l.tempId === editLigneId)?.remisePourcentage ?? 0) : 0
    const calc = calculerLigne(qte, prixUnitaireHt, remise, tauxTva)

    const nouvelleLigne: Ligne = {
      tempId: editLigneId ?? genId(),
      produitId: produit.id,
      designation: produit.description,
      quantite: qte, prixAchatHt, prixUnitaireHt,
      remisePourcentage: remise, tauxTva,
      montantHt: calc.montantHt, montantTva: calc.montantTva, montantTtc: calc.montantTtc,
    }

    if (editLigneId) {
      setLignes(prev => prev.map(l => l.tempId === editLigneId ? nouvelleLigne : l))
    } else {
      setLignes(prev => [...prev, nouvelleLigne])
    }

    setPopupOpen(false)
    popupProduitRef.current = null
    editLigneIdRef.current = null
  }

  function validerRemise() {
    if (!popupRemiseLigneId) return
    const remise = parseFloat(popupRemiseVal) || 0
    setLignes(prev => prev.map(l => {
      if (l.tempId !== popupRemiseLigneId) return l
      const calc = calculerLigne(l.quantite, l.prixUnitaireHt, remise, l.tauxTva)
      return { ...l, remisePourcentage: remise, ...calc }
    }))
    setPopupRemise(false)
  }

  function supprimerLigne(tempId: string) {
    setLignes(prev => prev.filter(l => l.tempId !== tempId))
  }

  async function sauvegarder(statut: 'brouillon' | 'validee') {
    if (!clientId) return alert('Veuillez sélectionner un client')
    if (lignes.length === 0) return alert('Veuillez ajouter au moins un article')

    setSaving(true)
    try {
      const url = factureExistante
        ? `/api/factures/${factureExistante.id}`
        : '/api/factures'
      const method = factureExistante ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId, dateFacture, statut,
          lignes: lignes.map((l, i) => ({ ...l, ordreLigne: i + 1 })),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const facture = await res.json()
      router.push(`/factures/${facture.id}`)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const isModification = !!factureExistante

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">
          {isModification ? 'Modifier' : 'Nouvelle facture'} —{' '}
          <span className="text-indigo-600">{prochainNumero}</span>
        </h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => sauvegarder('brouillon')} disabled={saving} className="btn-secondary">
            Brouillon
          </button>
          <button type="button" onClick={() => sauvegarder('validee')} disabled={saving} className="btn-primary">
            {saving ? 'Enregistrement...' : 'Valider'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-ghost">Annuler</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="col-span-2 card p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Client *</label>
              <select value={clientId ?? ''} onChange={e => setClientId(Number(e.target.value) || null)} className="form-select">
                <option value="">— Sélectionner un client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.raisonSociale}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Date</label>
              <input type="date" value={dateFacture} onChange={e => setDateFacture(e.target.value)} className="form-input" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <input type="checkbox" id="showAchat" checked={showPrixAchat} onChange={e => setShowPrixAchat(e.target.checked)} className="w-4 h-4" />
            <label htmlFor="showAchat" className="text-xs text-slate-500">Afficher prix achat</label>
          </div>
        </div>

        <div className="card p-4 flex flex-col justify-center gap-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Total lignes</span><span className="font-medium">{totaux.totalLignes}</span></div>
          <div className="flex justify-between pt-1 border-t border-slate-100"><span className="text-slate-500">Total HT</span><span className="font-semibold">{formatMontant(totaux.totalHt)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Total TVA</span><span className="font-semibold">{formatMontant(totaux.totalTva)}</span></div>
          <div className="flex justify-between text-indigo-600 text-base"><span className="font-semibold">Total TTC</span><span className="font-bold">{formatMontant(totaux.totalTtc)}</span></div>
          {showPrixAchat && <>
            <div className="flex justify-between pt-1 border-t border-slate-100 text-slate-400"><span>Total achat HT</span><span>{formatMontant(totaux.totalAchatHt)}</span></div>
            <div className="flex justify-between text-emerald-600"><span>Marge HT</span><span className="font-semibold">{formatMontant(totaux.margeHt)}</span></div>
          </>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Lignes facture */}
        <div className="card overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Articles — double clic pour modifier
          </div>
          <table className="data-table text-xs">
            <thead>
              <tr>
                <th>#</th><th>Désignation</th><th>Qté</th><th>PU HT</th>
                <th>Remise</th><th>TVA%</th><th>Montant HT</th><th>TTC</th>
                {showPrixAchat && <th>P.Achat</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={l.tempId} onDoubleClick={() => modifierLigne(l)} className="hover:bg-indigo-50">
                  <td className="text-slate-400">{i + 1}</td>
                  <td className="max-w-32 truncate font-medium">{l.designation}</td>
                  <td>{l.quantite}</td>
                  <td>{formatMontant(l.prixUnitaireHt)}</td>
                  <td>
                    <button type="button"
                      onClick={() => { setPopupRemiseLigneId(l.tempId); setPopupRemiseVal(String(l.remisePourcentage)); setPopupRemise(true) }}
                      className="text-amber-500 hover:underline">
                      {l.remisePourcentage > 0 ? `${l.remisePourcentage}%` : '—'}
                    </button>
                  </td>
                  <td>{l.tauxTva}%</td>
                  <td className="font-medium">{formatMontant(l.montantHt)}</td>
                  <td className="font-semibold text-indigo-600">{formatMontant(l.montantTtc)}</td>
                  {showPrixAchat && <td className="text-slate-400">{formatMontant(l.prixAchatHt)}</td>}
                  <td>
                    <button type="button" onClick={() => supprimerLigne(l.tempId)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </td>
                </tr>
              ))}
              {lignes.length === 0 && (
                <tr><td colSpan={10} className="text-center text-slate-300 py-6 text-xs">Double clic sur un article ci-dessous pour l&apos;ajouter</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Catalogue produits */}
        <div className="card overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Articles</span>
            <input
              placeholder="Rechercher..."
              value={searchProduit}
              onChange={e => setSearchProduit(e.target.value)}
              className="form-input flex-1 text-xs py-1"
            />
          </div>
          <div className="overflow-y-auto max-h-80">
            <table className="data-table text-xs">
              <thead>
                <tr><th>Référence</th><th>Description</th><th>PV HT</th><th>TVA</th><th>PV TTC</th></tr>
              </thead>
              <tbody>
                {produits.map(p => (
                  <tr key={p.id} onDoubleClick={() => ouvrirPopupQte(p)} className="hover:bg-indigo-50 cursor-pointer">
                    <td className="text-slate-400">{p.reference}</td>
                    <td className="font-medium max-w-32 truncate">{p.description}</td>
                    <td>{formatMontant(Number(p.prixVenteHt))}</td>
                    <td>{p.tauxTva?.valeurNum ?? 0}%</td>
                    <td className="font-semibold text-indigo-600">
                      {formatMontant(arrondi2(Number(p.prixVenteHt) * (1 + Number(p.tauxTva?.valeurNum ?? 0) / 100)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* POPUP QUANTITÉ */}
      {popupOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={e => { if (e.target === e.currentTarget) setPopupOpen(false) }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96 border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-1">Saisie de quantité</h3>
            <p className="text-sm text-slate-500 mb-3">Article : <span className="font-medium text-slate-700">{popupDesc}</span></p>
            <p className="text-xs text-slate-400 mb-3">Astuce : tu peux entrer un calcul (ex: 12*3, 10+5)</p>
            <input
              ref={qteInputRef}
              value={popupQte}
              onChange={e => setPopupQte(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); validerPopupQte() }
                if (e.key === 'Escape') setPopupOpen(false)
              }}
              className="form-input mb-4 text-lg font-semibold"
              placeholder="1"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={validerPopupQte} className="btn-primary">OK</button>
              <button type="button" onClick={() => setPopupOpen(false)} className="btn-secondary">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP REMISE */}
      {popupRemise && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-80 border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-3">Remise sur la ligne (%)</h3>
            <input
              autoFocus
              type="number" min="0" max="100" step="0.01"
              value={popupRemiseVal}
              onChange={e => setPopupRemiseVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); validerRemise() } }}
              className="form-input mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={validerRemise} className="btn-primary">Appliquer</button>
              <button type="button" onClick={() => setPopupRemise(false)} className="btn-secondary">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
