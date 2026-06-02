'use client'
// src/app/(dashboard)/factures/[id]/avoir-button.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AvoirButton({ factureId }: { factureId: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const [dateAvoir, setDateAvoir] = useState(new Date().toISOString().split('T')[0])

  async function creerAvoir() {
    setLoading(true)
    try {
      const res = await fetch(`/api/factures/${factureId}/avoir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateAvoir }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      router.push(`/avoirs/${data.id}`)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
      setShowPopup(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowPopup(true)}
        className="btn-secondary btn-sm flex items-center gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/>
          <path d="M5 8h4M8 5l-3 3 3 3"/>
        </svg>
        Avoir
      </button>

      {showPopup && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={e => { if (e.target === e.currentTarget) setShowPopup(false) }}
        >
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96 border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-1">Créer un avoir</h3>
            <p className="text-sm text-slate-500 mb-4">
              L'avoir sera créé avec toutes les lignes de la facture. Vous pourrez le modifier ensuite.
            </p>

            <div className="mb-5">
              <label className="form-label">Date de l'avoir *</label>
              <input
                type="date"
                value={dateAvoir}
                onChange={e => setDateAvoir(e.target.value)}
                className="form-input"
                autoFocus
              />
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 mb-5">
              ⚠️ Cette action est irréversible. La facture sera marquée comme ayant un avoir.
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={creerAvoir}
                disabled={loading || !dateAvoir}
                className="btn-primary flex items-center gap-1.5"
              >
                {loading
                  ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : null}
                Créer l'avoir
              </button>
              <button type="button" onClick={() => setShowPopup(false)} className="btn-secondary">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
