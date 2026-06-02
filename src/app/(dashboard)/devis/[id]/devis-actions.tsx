'use client'
// src/app/(dashboard)/devis/[id]/devis-actions.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { genererDocumentPDF } from '@/lib/exports/pdf/facture-pdf'

type DevisData = {
  id: number
  numeroDevis: string
  dateDevis: string
  statut: string
  client: {
    id?: number
    raisonSociale: string
    adresse?: string | null
    codePostal?: string | null
    ville?: string | null
    telephone?: string | null
    ice?: string | null
    email?: string | null
  }
  lignes: Array<{
    ordreLigne: number
    designation: string
    quantite: number
    prixUnitaireHt: number
    remisePourcentage: number
    tauxTva: number
    montantHt: number
    montantTva: number
    montantTtc: number
  }>
  totalHt: number
  totalTva: number
  totalTtc: number
  totalArticles: number
  totalLignes: number
}

const STATUTS = ['brouillon', 'envoye', 'accepte', 'refuse']
const STATUT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon', envoye: 'Envoyé', accepte: 'Accepté', refuse: 'Refusé'
}

export default function DevisActions({ devis }: { devis: DevisData }) {
  const router = useRouter()
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [loadingStatut, setLoadingStatut] = useState(false)

  async function handlePDF() {
    setLoadingPdf(true)
    try {
      await genererDocumentPDF(
        { ...devis, typeDoc: 'devis', numeroFacture: devis.numeroDevis, dateFacture: devis.dateDevis },
        { raisonSociale: 'Ma Société' } // sera remplacé par les données entreprise
      )
    } catch (e) {
      alert('Erreur PDF')
    } finally {
      setLoadingPdf(false)
    }
  }

  async function changerStatut(statut: string) {
    setLoadingStatut(true)
    try {
      const res = await fetch(`/api/devis/${devis.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      router.refresh()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoadingStatut(false)
    }
  }

  async function convertirEnFacture() {
    if (!confirm('Convertir ce devis en facture ?')) return
    try {
      const res = await fetch(`/api/devis/${devis.id}/convertir`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      router.push(`/factures/${data.id}`)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erreur')
    }
  }

  return (
    <>
      {/* Changer statut */}
      <select
        value={devis.statut}
        onChange={e => changerStatut(e.target.value)}
        disabled={loadingStatut}
        className="form-select text-sm h-8 py-0"
      >
        {STATUTS.map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
      </select>

      {/* Convertir en facture */}
      {devis.statut === 'accepte' && (
        <button type="button" onClick={convertirEnFacture}
          className="btn-primary btn-sm flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/>
            <path d="M5 8h6M9 5l3 3-3 3"/>
          </svg>
          → Facture
        </button>
      )}

      {/* PDF */}
      <button type="button" onClick={handlePDF} disabled={loadingPdf}
        className="btn-secondary btn-sm flex items-center gap-1.5">
        {loadingPdf
          ? <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/><path d="M5 5h6M5 8h6M5 11h3"/></svg>}
        PDF
      </button>
    </>
  )
}
