'use client'
// src/app/(dashboard)/parametres/entreprise/entreprise-form.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type EntrepriseData = {
  id?: number
  raisonSociale?: string
  adresse?: string | null
  codePostal?: string | null
  ville?: string | null
  telephone?: string | null
  email?: string | null
  ice?: string | null
  identifiantFiscal?: string | null
  rc?: string | null
  patente?: string | null
  logoUrl?: string | null
  compteBancaire?: string | null
  devise?: string
}

export default function EntrepriseForm({ entreprise }: { entreprise: EntrepriseData | null }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    const form = new FormData(e.currentTarget)
    const data = {
      raisonSociale: form.get('raisonSociale') as string,
      adresse: form.get('adresse') as string || null,
      codePostal: form.get('codePostal') as string || null,
      ville: form.get('ville') as string || null,
      telephone: form.get('telephone') as string || null,
      email: form.get('email') as string || null,
      ice: form.get('ice') as string || null,
      identifiantFiscal: form.get('identifiantFiscal') as string || null,
      rc: form.get('rc') as string || null,
      patente: form.get('patente') as string || null,
      logoUrl: form.get('logoUrl') as string || null,
      compteBancaire: form.get('compteBancaire') as string || null,
      devise: form.get('devise') as string || 'MAD',
    }

    try {
      const url = entreprise?.id
        ? `/api/entreprise/${entreprise.id}`
        : '/api/entreprise'
      const method = entreprise?.id ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) throw new Error((await res.json()).error || 'Erreur')
      setSuccess(true)
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
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          ✅ Paramètres enregistrés avec succès !
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">

        {/* Raison sociale */}
        <div className="col-span-2">
          <label className="form-label">Raison sociale *</label>
          <input
            name="raisonSociale"
            required
            defaultValue={entreprise?.raisonSociale ?? ''}
            className="form-input"
            placeholder="Ma Société SARL"
          />
        </div>

        {/* Adresse */}
        <div className="col-span-2">
          <label className="form-label">Adresse</label>
          <textarea
            name="adresse"
            defaultValue={entreprise?.adresse ?? ''}
            className="form-input h-16 resize-none"
            placeholder="123, Boulevard Hassan II"
          />
        </div>

        {/* Code postal + Ville */}
        <div>
          <label className="form-label">Code postal</label>
          <input name="codePostal" defaultValue={entreprise?.codePostal ?? ''} className="form-input" placeholder="20000" />
        </div>
        <div>
          <label className="form-label">Ville</label>
          <input name="ville" defaultValue={entreprise?.ville ?? ''} className="form-input" placeholder="Casablanca" />
        </div>

        {/* Téléphone + Email */}
        <div>
          <label className="form-label">Téléphone</label>
          <input name="telephone" defaultValue={entreprise?.telephone ?? ''} className="form-input" placeholder="0522-000000" />
        </div>
        <div>
          <label className="form-label">Email</label>
          <input name="email" type="email" defaultValue={entreprise?.email ?? ''} className="form-input" placeholder="contact@societe.ma" />
        </div>

        {/* Séparateur identifiants fiscaux */}
        <div className="col-span-2 border-t border-slate-100 pt-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Identifiants fiscaux
          </div>
        </div>

        {/* ICE */}
        <div>
          <label className="form-label">ICE</label>
          <input name="ice" defaultValue={entreprise?.ice ?? ''} className="form-input font-mono" placeholder="000000000000000" />
        </div>

        {/* Identifiant fiscal */}
        <div>
          <label className="form-label">Identifiant fiscal (IF)</label>
          <input name="identifiantFiscal" defaultValue={entreprise?.identifiantFiscal ?? ''} className="form-input font-mono" placeholder="00000000" />
        </div>

        {/* RC */}
        <div>
          <label className="form-label">RC</label>
          <input name="rc" defaultValue={entreprise?.rc ?? ''} className="form-input font-mono" placeholder="000000" />
        </div>

        {/* Patente */}
        <div>
          <label className="form-label">Patente</label>
          <input name="patente" defaultValue={entreprise?.patente ?? ''} className="form-input font-mono" placeholder="00000000" />
        </div>

        {/* Séparateur apparence */}
        <div className="col-span-2 border-t border-slate-100 pt-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Apparence
          </div>
        </div>

        {/* Logo URL */}
        <div className="col-span-2">
          <label className="form-label">Logo (chemin relatif)</label>
          <input
            name="logoUrl"
            defaultValue={entreprise?.logoUrl ?? ''}
            className="form-input"
            placeholder="/logo/logo.png"
          />
          <p className="text-xs text-slate-400 mt-1">
            Placez votre logo dans <code className="bg-slate-100 px-1 rounded">C:\serveur\facturapp\public\logo\logo.png</code> puis entrez <code className="bg-slate-100 px-1 rounded">/logo/logo.png</code>
          </p>
          {entreprise?.logoUrl && (
            <div className="mt-2 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entreprise.logoUrl}
                alt="Logo société"
                className="h-12 w-auto object-contain border border-slate-200 rounded p-1"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <span className="text-xs text-slate-400">Aperçu du logo actuel</span>
            </div>
          )}
        </div>

        {/* Compte bancaire */}
        <div className="col-span-2">
          <label className="form-label">Compte bancaire (ex: CIH, Attijariwafa...)</label>
          <input
            name="compteBancaire"
            defaultValue={entreprise?.compteBancaire ?? ''}
            className="form-input"
            placeholder="230 792 5609782221031100 94"
          />
        </div>

        {/* Devise */}
        <div>
          <label className="form-label">Devise</label>
          <select name="devise" defaultValue={entreprise?.devise ?? 'MAD'} className="form-select">
            <option value="MAD">MAD — Dirham marocain</option>
            <option value="EUR">EUR — Euro</option>
            <option value="USD">USD — Dollar américain</option>
          </select>
        </div>
      </div>

      <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        <button type="button" onClick={() => router.refresh()} className="btn-secondary">
          Annuler
        </button>
      </div>
    </form>
  )
}
