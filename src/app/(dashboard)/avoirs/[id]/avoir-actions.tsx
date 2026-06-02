'use client'
// src/app/(dashboard)/avoirs/[id]/avoir-actions.tsx
import { useState } from 'react'
import { genererDocumentPDF, TypeDocument } from '@/lib/exports/pdf/facture-pdf'

export default function AvoirActions({ avoir, entreprise }: { avoir: Record<string, unknown>; entreprise: Record<string, unknown> }) {
  const [loading, setLoading] = useState(false)

  async function handlePDF() {
    setLoading(true)
    try {
      await genererDocumentPDF(avoir as Parameters<typeof genererDocumentPDF>[0], entreprise as Parameters<typeof genererDocumentPDF>[1])
    } catch { alert('Erreur PDF') }
    finally { setLoading(false) }
  }

  return (
    <>
      <button type="button" onClick={handlePDF} disabled={loading}
        className="btn-primary btn-sm flex items-center gap-1.5">
        {loading
          ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/><path d="M5 5h6M5 8h6M5 11h3"/></svg>}
        PDF Avoir
      </button>
      <button type="button" onClick={() => window.print()} className="btn-secondary btn-sm">Imprimer</button>
    </>
  )
}
