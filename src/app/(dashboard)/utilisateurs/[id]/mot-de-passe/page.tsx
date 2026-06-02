'use client'
// src/app/(dashboard)/utilisateurs/[id]/mot-de-passe/page.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MotDePassePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    const form = new FormData(e.currentTarget)
    const motDePasse = form.get('motDePasse') as string
    const confirmation = form.get('confirmation') as string

    if (motDePasse !== confirmation) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    if (motDePasse.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/utilisateurs/${params.id}/mot-de-passe`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motDePasse }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setSuccess(true)
      setTimeout(() => router.push('/utilisateurs'), 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Changer le mot de passe</h1>
      </div>
      <form onSubmit={handleSubmit} className="card p-6 max-w-md">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            Mot de passe modifié avec succès ! Redirection...
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="form-label">Nouveau mot de passe *</label>
            <input
              name="motDePasse"
              type="password"
              required
              className="form-input"
              placeholder="Minimum 6 caractères"
              autoComplete="new-password"
              autoFocus
            />
          </div>
          <div>
            <label className="form-label">Confirmation *</label>
            <input
              name="confirmation"
              type="password"
              required
              className="form-input"
              placeholder="Répéter le mot de passe"
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Enregistrement...' : 'Changer le mot de passe'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">Annuler</button>
        </div>
      </form>
    </div>
  )
}
