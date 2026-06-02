'use client'
// src/app/(dashboard)/factures/[id]/devalider-button.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DevaliderButton({ factureId }: { factureId: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function devalider() {
    if (!confirm('Repasser cette facture en brouillon ?\n\nElle deviendra modifiable mais ne sera plus validée.')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/factures/${factureId}/devalider`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error)
      router.refresh()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button type="button" onClick={devalider} disabled={loading}
      className="btn-secondary btn-sm flex items-center gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50">
      {loading
        ? <span className="w-3.5 h-3.5 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
        : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 4h14M1 4l3-3M1 4l3 3"/>
          </svg>}
      Dévalider
    </button>
  )
}
