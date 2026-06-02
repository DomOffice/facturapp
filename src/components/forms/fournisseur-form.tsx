'use client'
// src/components/forms/fournisseur-form.tsx
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Option = { id: number; libelle: string }
type FournisseurData = {
  id?: number
  typeFournisseurId?: number | null
  raisonSociale?: string
  adresse?: string | null
  codePostal?: string | null
  telephone?: string | null
  ville?: string | null
  ice?: string | null
  email?: string | null
  actif?: boolean
}

export default function FournisseurForm({
  fournisseur,
  typesFournisseur,
}: {
  fournisseur?: FournisseurData
  typesFournisseur: Option[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const data = {
      typeFournisseurId: form.get('typeFournisseurId') ? Number(form.get('typeFournisseurId')) : null,
      raisonSociale: form.get('raisonSociale') as string,
      adresse: form.get('adresse') as string,
      codePostal: form.get('codePostal') as string,
      telephone: form.get('telephone') as string,
      ville: form.get('ville') as string,
      ice: form.get('ice') as string,
      email: form.get('email') as string,
      actif: form.get('actif') === 'on',
    }

    try {
      const url = fournisseur?.id ? `/api/fournisseurs/${fournisseur.id}` : '/api/fournisseurs'
      const method = fournisseur?.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur')
      router.push('/fournisseurs')
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
        <div className="col-span-2">
          <label className="form-label">Type</label>
          <select name="typeFournisseurId" defaultValue={fournisseur?.typeFournisseurId ?? ''} className="form-select">
            <option value="">— Sélectionner —</option>
            {typesFournisseur.map(t => <option key={t.id} value={t.id}>{t.libelle}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="form-label">Nom / Raison sociale *</label>
          <input name="raisonSociale" required defaultValue={fournisseur?.raisonSociale ?? ''} className="form-input" placeholder="Nom du fournisseur" />
        </div>
        <div className="col-span-2">
          <label className="form-label">Adresse</label>
          <textarea name="adresse" defaultValue={fournisseur?.adresse ?? ''} className="form-input h-16 resize-none" />
        </div>
        <div>
          <label className="form-label">Code postal</label>
          <input name="codePostal" defaultValue={fournisseur?.codePostal ?? ''} className="form-input" />
        </div>
        <div>
          <label className="form-label">Ville</label>
          <input name="ville" defaultValue={fournisseur?.ville ?? ''} className="form-input" />
        </div>
        <div>
          <label className="form-label">Téléphone</label>
          <input name="telephone" defaultValue={fournisseur?.telephone ?? ''} className="form-input" />
        </div>
        <div>
          <label className="form-label">E-Mail</label>
          <input name="email" type="email" defaultValue={fournisseur?.email ?? ''} className="form-input" />
        </div>
        <div>
          <label className="form-label">ICE</label>
          <input name="ice" defaultValue={fournisseur?.ice ?? ''} className="form-input" />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input type="checkbox" name="actif" id="actif-f" defaultChecked={fournisseur?.actif ?? true} className="w-4 h-4" />
          <label htmlFor="actif-f" className="text-sm text-slate-600">Fournisseur actif</label>
        </div>
      </div>
      <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Enregistrement...' : fournisseur?.id ? 'Enregistrer' : 'Créer le fournisseur'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">Annuler</button>
      </div>
    </form>
  )
}
