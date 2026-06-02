'use client'
// src/components/forms/client-form.tsx
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type TypeOption = { id: number; libelle: string }
type ClientData = {
  id?: number
  typeClientId?: number | null
  raisonSociale?: string
  adresse?: string | null
  codePostal?: string | null
  telephone?: string | null
  ville?: string | null
  ice?: string | null
  email?: string | null
  echeanceJours?: number | null
  actif?: boolean
}

export default function ClientForm({
  client,
  typesClient,
}: {
  client?: ClientData
  typesClient: TypeOption[]
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
      typeClientId: form.get('typeClientId') ? Number(form.get('typeClientId')) : null,
      raisonSociale: form.get('raisonSociale') as string,
      adresse: form.get('adresse') as string,
      codePostal: form.get('codePostal') as string,
      telephone: form.get('telephone') as string,
      ville: form.get('ville') as string,
      ice: form.get('ice') as string,
      email: form.get('email') as string,
      echeanceJours: form.get('echeanceJours') ? Number(form.get('echeanceJours')) : null,
      actif: form.get('actif') === 'on',
    }

    try {
      const url = client?.id ? `/api/clients/${client.id}` : '/api/clients'
      const method = client?.id ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur serveur')
      }

      router.push('/clients')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-2xl">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Type */}
        <div className="col-span-2">
          <label className="form-label">Type</label>
          <select name="typeClientId" defaultValue={client?.typeClientId ?? ''} className="form-select">
            <option value="">— Sélectionner —</option>
            {typesClient.map((t) => (
              <option key={t.id} value={t.id}>{t.libelle}</option>
            ))}
          </select>
        </div>

        {/* Raison sociale */}
        <div className="col-span-2">
          <label className="form-label">Nom / Raison sociale *</label>
          <input
            name="raisonSociale"
            required
            defaultValue={client?.raisonSociale ?? ''}
            className="form-input"
            placeholder="Nom du client"
          />
        </div>

        {/* Adresse */}
        <div className="col-span-2">
          <label className="form-label">Adresse</label>
          <textarea
            name="adresse"
            defaultValue={client?.adresse ?? ''}
            className="form-input h-16 resize-none"
            placeholder="Adresse complète"
          />
        </div>

        {/* Code postal */}
        <div>
          <label className="form-label">Code postal</label>
          <input name="codePostal" defaultValue={client?.codePostal ?? ''} className="form-input" placeholder="20000" />
        </div>

        {/* Ville */}
        <div>
          <label className="form-label">Ville</label>
          <input name="ville" defaultValue={client?.ville ?? ''} className="form-input" placeholder="Casablanca" />
        </div>

        {/* Téléphone */}
        <div>
          <label className="form-label">Téléphone</label>
          <input name="telephone" defaultValue={client?.telephone ?? ''} className="form-input" placeholder="0522-000000" />
        </div>

        {/* Email */}
        <div>
          <label className="form-label">E-Mail</label>
          <input name="email" type="email" defaultValue={client?.email ?? ''} className="form-input" placeholder="contact@example.ma" />
        </div>

        {/* ICE */}
        <div>
          <label className="form-label">ICE</label>
          <input name="ice" defaultValue={client?.ice ?? ''} className="form-input" placeholder="000000000000000" />
        </div>

        {/* Echéance */}
        <div>
          <label className="form-label">Délai de paiement (jours)</label>
          <input
            name="echeanceJours"
            type="number"
            min="0"
            defaultValue={client?.echeanceJours ?? ''}
            className="form-input"
            placeholder="ex: 30, 60, 90"
          />
          <p className="text-xs text-slate-400 mt-1">Affiché sur la facture PDF</p>
        </div>

        {/* Actif */}
        <div className="flex items-center gap-2 pt-5">
          <input
            type="checkbox"
            name="actif"
            id="actif"
            defaultChecked={client?.actif ?? true}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600"
          />
          <label htmlFor="actif" className="text-sm text-slate-600">Client actif</label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Enregistrement...' : client?.id ? 'Enregistrer les modifications' : 'Créer le client'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          Annuler
        </button>
      </div>
    </form>
  )
}
