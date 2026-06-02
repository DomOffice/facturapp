'use client'
// src/app/(dashboard)/factures/[id]/facture-actions.tsx
import { useState } from 'react'
import { genererDocumentPDF, TypeDocument } from '@/lib/exports/pdf/facture-pdf'
import { exporterFactureExcel } from '@/lib/exports/excel/facture-excel'

type LigneData = {
  ordreLigne: number
  designation: string
  quantite: number
  prixUnitaireHt: number
  remisePourcentage: number
  montantRemiseHt?: number
  tauxTva: number
  montantHt: number
  montantTva: number
  montantTtc: number
}

type FactureData = {
  id: number
  numeroFacture: string
  dateFacture: string
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
    echeanceJours?: number | null
  }
  lignes: LigneData[]
  totalHt: number
  totalTva: number
  totalTtc: number
  totalArticles: number
  totalLignes: number
  margeHt: number
}

type EntrepriseData = {
  raisonSociale: string
  adresse?: string | null
  codePostal?: string | null
  ville?: string | null
  telephone?: string | null
  email?: string | null
  ice?: string | null
  identifiantFiscal?: string | null
  rc?: string | null
  patente?: string | null
  compteBancaire?: string | null
  logoUrl?: string | null
}

export default function FactureActions({ facture, entreprise }: { facture: FactureData; entreprise: EntrepriseData }) {
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [loadingExcel, setLoadingExcel] = useState(false)

  // Popup options avant impression PDF
  const [showOptions, setShowOptions] = useState(false)
  const [typeDoc, setTypeDoc] = useState<TypeDocument>('facture')
  const [afficherEcheance, setAfficherEcheance] = useState(false)
  const [echeanceValeur, setEcheanceValeur] = useState('')
  const [modeReglement, setModeReglement] = useState('')

  async function handlePDF() {
    setShowOptions(false)
    setLoadingPdf(true)
    try {
      await genererDocumentPDF(
        {
          ...facture,
          typeDoc,
          afficherEcheance,
          echeanceValeur: afficherEcheance ? echeanceValeur : undefined,
          modeReglement: afficherEcheance ? modeReglement : undefined,
        },
        entreprise
      )
    } catch (e) {
      console.error('Erreur PDF:', e)
      alert('Erreur lors de la génération du PDF')
    } finally {
      setLoadingPdf(false)
    }
  }

  async function handleExcel() {
    setLoadingExcel(true)
    try {
      await exporterFactureExcel(
        {
          ...facture,
          lignes: facture.lignes.map(l => ({
            ...l,
            montantRemiseHt: l.montantRemiseHt ?? 0,
            montantTva: l.montantTva,
          })),
        },
        entreprise
      )
    } catch (e) {
      console.error('Erreur Excel:', e)
      alert('Erreur lors de la génération du fichier Excel')
    } finally {
      setLoadingExcel(false)
    }
  }

  return (
    <>
      {/* Bouton PDF avec options */}
      <button type="button" onClick={() => setShowOptions(true)} disabled={loadingPdf}
        className="btn-primary btn-sm flex items-center gap-1.5">
        {loadingPdf
          ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/><path d="M5 5h6M5 8h6M5 11h3"/></svg>}
        PDF
      </button>

      {/* Bouton Excel */}
      <button type="button" onClick={handleExcel} disabled={loadingExcel}
        className="btn-secondary btn-sm flex items-center gap-1.5">
        {loadingExcel
          ? <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/><path d="M5 5h6M5 8h3M8 11v3M6 13l2 2 2-2"/></svg>}
        Excel
      </button>

      {/* Bouton Imprimer */}
      <button type="button" onClick={() => window.print()} className="btn-secondary btn-sm flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 6V2h8v4"/><path d="M4 11H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-2"/><path d="M4 9h8v5H4z"/>
        </svg>
        Imprimer
      </button>

      {/* POPUP OPTIONS PDF */}
      {showOptions && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={e => { if (e.target === e.currentTarget) setShowOptions(false) }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96 border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-4">Options du document</h3>

            {/* Type de document */}
            <div className="mb-4">
              <label className="form-label">Type de document</label>
              <select value={typeDoc} onChange={e => setTypeDoc(e.target.value as TypeDocument)} className="form-select">
                <option value="facture">Facture</option>
                <option value="bl">Bon de livraison (BL)</option>
                <option value="avoir">Avoir</option>
                <option value="devis">Devis</option>
              </select>
            </div>

            {/* Échéance / Règlement */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" id="showEch" checked={afficherEcheance}
                  onChange={e => setAfficherEcheance(e.target.checked)} className="w-4 h-4" />
                <label htmlFor="showEch" className="text-sm text-slate-600 font-medium">
                  Renseigner Échéance / Règlement
                </label>
              </div>
              {afficherEcheance && (
                <div className="space-y-2 pl-6">
                  <div>
                    <label className="form-label">Échéance</label>
                    <input value={echeanceValeur} onChange={e => setEcheanceValeur(e.target.value)}
                      className="form-input" placeholder="ex: 30 jours, 15/04/2026..." />
                  </div>
                  <div>
                    <label className="form-label">Mode de règlement</label>
                    <input value={modeReglement} onChange={e => setModeReglement(e.target.value)}
                      className="form-input" placeholder="ex: Chèque, Virement..." />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
              <button type="button" onClick={handlePDF} className="btn-primary">
                {loadingPdf ? 'Génération...' : 'Générer le PDF'}
              </button>
              <button type="button" onClick={() => setShowOptions(false)} className="btn-secondary">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
