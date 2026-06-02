'use client'
// src/components/forms/produit-form.tsx
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { arrondi2 } from '@/lib/utils/currency'

type Option = { id: number; libelle: string; valeurNum?: number | null }
type ProduitData = {
  id?: number
  typeProduitId?: number | null
  reference?: string
  description?: string
  uniteId?: number | null
  fournisseurId?: number | null
  tauxTvaId?: number | null
  dernierPrixAchatHt?: number
  prixVenteHt?: number
  margeHt?: number
  actif?: boolean
}

export default function ProduitForm({
  produit,
  typesProduit,
  unites,
  tauxTva,
  fournisseurs,
}: {
  produit?: ProduitData
  typesProduit: Option[]
  unites: Option[]
  tauxTva: Option[]
  fournisseurs: Option[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Calculs dynamiques
  const [prixAchatHt, setPrixAchatHt] = useState(Number(produit?.dernierPrixAchatHt ?? 0))
  const [marge, setMarge] = useState(Number(produit?.margeHt ?? 0))
  const [tauxTvaId, setTauxTvaId] = useState<number | null>(produit?.tauxTvaId ?? null)

  const tauxTvaVal = tauxTva.find(t => t.id === tauxTvaId)?.valeurNum ?? 0
  const prixVenteHt = arrondi2(prixAchatHt + marge)
  const prixAchatTtc = arrondi2(prixAchatHt * (1 + Number(tauxTvaVal) / 100))
  const prixVenteTtc = arrondi2(prixVenteHt * (1 + Number(tauxTvaVal) / 100))

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const data = {
      typeProduitId: form.get('typeProduitId') ? Number(form.get('typeProduitId')) : null,
      reference: form.get('reference') as string,
      description: form.get('description') as string,
      uniteId: form.get('uniteId') ? Number(form.get('uniteId')) : null,
      fournisseurId: form.get('fournisseurId') ? Number(form.get('fournisseurId')) : null,
      tauxTvaId: tauxTvaId,
      dernierPrixAchatHt: prixAchatHt,
      dernierPrixAchatTtc: prixAchatTtc,
      prixVenteHt: prixVenteHt,
      prixVenteTtc: prixVenteTtc,
      margeHt: marge,
      actif: form.get('actif') === 'on',
    }

    try {
      const url = produit?.id ? `/api/produits/${produit.id}` : '/api/produits'
      const method = produit?.id ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur')
      router.push('/produits')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-2xl">
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Type</label>
          <select name="typeProduitId" defaultValue={produit?.typeProduitId ?? ''} className="form-select">
            <option value="">— Sélectionner —</option>
            {typesProduit.map(t => <option key={t.id} value={t.id}>{t.libelle}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">Unité</label>
          <select name="uniteId" defaultValue={produit?.uniteId ?? ''} className="form-select">
            <option value="">— Sélectionner —</option>
            {unites.map(u => <option key={u.id} value={u.id}>{u.libelle}</option>)}
          </select>
        </div>

        <div className="col-span-2">
          <label className="form-label">Article / Référence *</label>
          <input name="reference" required defaultValue={produit?.reference ?? ''} className="form-input" placeholder="Ex: Stylo Bic Cristal" />
        </div>

        <div className="col-span-2">
          <label className="form-label">Description *</label>
          <input name="description" required defaultValue={produit?.description ?? ''} className="form-input" placeholder="Description complète" />
        </div>

        <div>
          <label className="form-label">Fournisseur</label>
          <select name="fournisseurId" defaultValue={produit?.fournisseurId ?? ''} className="form-select">
            <option value="">— Sélectionner —</option>
            {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.libelle}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">TVA</label>
          <select
            value={tauxTvaId ?? ''}
            onChange={e => setTauxTvaId(e.target.value ? Number(e.target.value) : null)}
            className="form-select"
          >
            <option value="">— Sélectionner —</option>
            {tauxTva.map(t => <option key={t.id} value={t.id}>{t.libelle}</option>)}
          </select>
        </div>

        {/* Calculs prix */}
        <div>
          <label className="form-label">Prix achat HT</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={prixAchatHt}
            onChange={e => setPrixAchatHt(Number(e.target.value))}
            className="form-input"
          />
        </div>

        <div>
          <label className="form-label">Marge HT</label>
          <input
            type="number"
            step="0.01"
            value={marge}
            onChange={e => setMarge(Number(e.target.value))}
            className="form-input"
          />
        </div>

        {/* Résultats calculés */}
        <div className="col-span-2 grid grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg">
          <div>
            <div className="form-label">Prix achat TTC</div>
            <div className="text-sm font-semibold text-slate-700">{prixAchatTtc.toFixed(2)}</div>
          </div>
          <div>
            <div className="form-label">Prix vente HT</div>
            <div className="text-sm font-semibold text-indigo-600">{prixVenteHt.toFixed(2)}</div>
          </div>
          <div>
            <div className="form-label">Prix vente TTC</div>
            <div className="text-sm font-semibold text-indigo-600">{prixVenteTtc.toFixed(2)}</div>
          </div>
          <div>
            <div className="form-label">Coeff. marge</div>
            <div className="text-sm font-semibold text-emerald-600">
              {prixAchatHt > 0 ? (marge / prixAchatHt).toFixed(2) : '—'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" name="actif" id="actif-prod" defaultChecked={produit?.actif ?? true} className="w-4 h-4" />
          <label htmlFor="actif-prod" className="text-sm text-slate-600">Produit actif</label>
        </div>
      </div>

      <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Enregistrement...' : produit?.id ? 'Enregistrer' : 'Créer le produit'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">Annuler</button>
      </div>
    </form>
  )
}
