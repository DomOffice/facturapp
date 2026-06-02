'use client'
// src/components/forms/utilisateur-form.tsx
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Role = { id: number; code: string; nom: string }
type UtilisateurData = {
  id?: number
  nom?: string
  email?: string
  roleId?: number
  actif?: boolean
}

export default function UtilisateurForm({
  utilisateur,
  roles,
  isNew = false,
}: {
  utilisateur?: UtilisateurData
  roles: Role[]
  isNew?: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showMdp, setShowMdp] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const motDePasse = form.get('motDePasse') as string
    const confirmation = form.get('confirmation') as string

    if (isNew && !motDePasse) {
      setError('Le mot de passe est obligatoire pour un nouvel utilisateur')
      setLoading(false)
      return
    }

    if (motDePasse && motDePasse !== confirmation) {
      setError('Les mots de passe ne correspondent pas')
      setLoading(false)
      return
    }

    if (motDePasse && motDePasse.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      setLoading(false)
      return
    }

    const data: Record<string, unknown> = {
      nom: form.get('nom') as string,
      email: form.get('email') as string,
      roleId: Number(form.get('roleId')),
      actif: form.get('actif') === 'on',
    }

    if (motDePasse) data.motDePasse = motDePasse

    try {
      const url = utilisateur?.id
        ? `/api/utilisateurs/${utilisateur.id}`
        : '/api/utilisateurs'
      const method = utilisateur?.id ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) throw new Error((await res.json()).error || 'Erreur')
      router.push('/utilisateurs')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-lg">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Nom */}
        <div>
          <label className="form-label">Nom complet *</label>
          <input
            name="nom"
            required
            defaultValue={utilisateur?.nom ?? ''}
            className="form-input"
            placeholder="Prénom Nom"
          />
        </div>

        {/* Email */}
        <div>
          <label className="form-label">Email *</label>
          <input
            name="email"
            type="email"
            required
            defaultValue={utilisateur?.email ?? ''}
            className="form-input"
            placeholder="email@exemple.ma"
          />
        </div>

        {/* Rôle */}
        <div>
          <label className="form-label">Rôle *</label>
          <select name="roleId" defaultValue={utilisateur?.roleId ?? ''} required className="form-select">
            <option value="">— Sélectionner —</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.nom}</option>
            ))}
          </select>
        </div>

        {/* Mot de passe */}
        <div className="border-t border-slate-100 pt-4">
          {!isNew && (
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="changeMdp"
                checked={showMdp}
                onChange={e => setShowMdp(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="changeMdp" className="text-sm text-slate-600">
                Changer le mot de passe
              </label>
            </div>
          )}

          {(isNew || showMdp) && (
            <div className="space-y-3">
              <div>
                <label className="form-label">
                  {isNew ? 'Mot de passe *' : 'Nouveau mot de passe'}
                </label>
                <input
                  name="motDePasse"
                  type="password"
                  className="form-input"
                  placeholder="Minimum 6 caractères"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="form-label">Confirmation *</label>
                <input
                  name="confirmation"
                  type="password"
                  className="form-input"
                  placeholder="Répéter le mot de passe"
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actif */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="actif"
            id="actif-u"
            defaultChecked={utilisateur?.actif ?? true}
            className="w-4 h-4"
          />
          <label htmlFor="actif-u" className="text-sm text-slate-600">
            Utilisateur actif
          </label>
        </div>
      </div>

      <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Enregistrement...' : utilisateur?.id ? 'Enregistrer' : 'Créer'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          Annuler
        </button>
      </div>
    </form>
  )
}
