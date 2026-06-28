'use client'

// src/components/ocr/upload-facture.tsx

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Fournisseur = {
  id: number
  nom: string
  code?: string | null
}

type UploadEtat =
  | { type: 'idle' }
  | { type: 'drag_over' }
  | { type: 'uploading'; progression: number }
  | { type: 'succes'; nomFichier: string; nomStocke: string; chemin: string; typeMime: string; taille: number }
  | { type: 'erreur'; message: string }

type Props = {
  fournisseurs: Fournisseur[]
}

const FORMATS_ACCEPTES = ['application/pdf', 'image/jpeg', 'image/png']
const LABELS_MIME: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
}

function formaterTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

export default function UploadFacture({ fournisseurs }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [etat, setEtat] = useState<UploadEtat>({ type: 'idle' })
  const [fournisseurId, setFournisseurId] = useState<string>('')
  const [fichierSelectionne, setFichierSelectionne] = useState<File | null>(null)

  // ── Validation côté client ─────────────────────────────────────────
  const validerFichier = (fichier: File): string | null => {
    if (!FORMATS_ACCEPTES.includes(fichier.type)) {
      return `Format non autorisé : ${fichier.type || 'inconnu'}. Formats acceptés : PDF, JPEG, PNG.`
    }
    if (fichier.size > 10 * 1024 * 1024) {
      return `Fichier trop volumineux (${formaterTaille(fichier.size)}). Maximum : 10 Mo.`
    }
    return null
  }

  const selectionnerFichier = useCallback((fichier: File) => {
    const erreur = validerFichier(fichier)
    if (erreur) {
      setEtat({ type: 'erreur', message: erreur })
      return
    }
    setFichierSelectionne(fichier)
    setEtat({ type: 'idle' })
  }, [])

  // ── Drag & Drop ────────────────────────────────────────────────────
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setEtat({ type: 'drag_over' })
  }
  const onDragLeave = () => {
    if (etat.type === 'drag_over') setEtat({ type: 'idle' })
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const fichier = e.dataTransfer.files?.[0]
    if (fichier) selectionnerFichier(fichier)
  }
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]
    if (fichier) selectionnerFichier(fichier)
  }

  // ── Soumission ─────────────────────────────────────────────────────
  const handleSoumettre = async () => {
    if (!fichierSelectionne) return
    if (!fournisseurId) {
      setEtat({ type: 'erreur', message: 'Veuillez sélectionner un fournisseur.' })
      return
    }

    setEtat({ type: 'uploading', progression: 0 })

    try {
      const formData = new FormData()
      formData.append('fichier', fichierSelectionne)
      formData.append('fournisseurId', fournisseurId)

      // Simulation progression (XHR pour vrai progress si besoin futur)
      const timer = setInterval(() => {
        setEtat(prev =>
          prev.type === 'uploading'
            ? { type: 'uploading', progression: Math.min(prev.progression + 15, 85) }
            : prev
        )
      }, 200)

      const res = await fetch('/api/factures-fournisseurs/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(timer)

      const data = await res.json()

      if (!res.ok) {
        setEtat({ type: 'erreur', message: data.error || 'Erreur lors de l\'upload.' })
        return
      }

      setEtat({
        type: 'succes',
        nomFichier: data.fichier.nomOriginal,
        nomStocke: data.fichier.nomStocke,
        chemin: data.fichier.chemin,
        typeMime: data.fichier.typeMime,
        taille: data.fichier.taille,
      })
    } catch {
      setEtat({ type: 'erreur', message: 'Erreur réseau. Veuillez réessayer.' })
    }
  }

  const reinitialiser = () => {
    setFichierSelectionne(null)
    setEtat({ type: 'idle' })
    if (inputRef.current) inputRef.current.value = ''
  }

  // ── Rendu ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Sélection fournisseur */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Fournisseur <span className="text-red-500">*</span>
        </label>
        <select
          value={fournisseurId}
          onChange={e => setFournisseurId(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          <option value="">-- Sélectionner un fournisseur --</option>
          {fournisseurs.map(f => (
            <option key={f.id} value={f.id}>
              {f.nom}{f.code ? ` (${f.code})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Zone de dépôt */}
      {etat.type !== 'succes' && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all
            ${etat.type === 'drag_over'
              ? 'border-blue-500 bg-blue-50'
              : fichierSelectionne
              ? 'border-green-400 bg-green-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={onInputChange}
          />

          {fichierSelectionne ? (
            /* Fichier sélectionné */
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <IconFichier mime={fichierSelectionne.type} />
                <span className="font-medium text-sm">{fichierSelectionne.name}</span>
              </div>
              <p className="text-xs text-gray-500">
                {LABELS_MIME[fichierSelectionne.type] || 'Fichier'} &bull; {formaterTaille(fichierSelectionne.size)}
              </p>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); reinitialiser() }}
                className="text-xs text-red-500 hover:underline mt-1"
              >
                Changer de fichier
              </button>
            </div>
          ) : (
            /* Zone vide */
            <div className="space-y-3">
              <div className="flex justify-center">
                <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {etat.type === 'drag_over'
                    ? 'Déposez le fichier ici'
                    : 'Glissez-déposez ou cliquez pour sélectionner'}
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF, JPEG, PNG — 10 Mo maximum</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Barre de progression */}
      {etat.type === 'uploading' && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Upload en cours…</span>
            <span>{etat.progression}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-200"
              style={{ width: `${etat.progression}%` }}
            />
          </div>
        </div>
      )}

      {/* Message d'erreur */}
      {etat.type === 'erreur' && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd" />
          </svg>
          <span>{etat.message}</span>
        </div>
      )}

      {/* Succès */}
      {etat.type === 'succes' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2 text-green-700">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd" />
            </svg>
            <span className="font-medium text-sm">Fichier uploadé avec succès</span>
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <p><span className="font-medium">Fichier :</span> {etat.nomFichier}</p>
            <p><span className="font-medium">Format :</span> {LABELS_MIME[etat.typeMime]}</p>
            <p><span className="font-medium">Taille :</span> {formaterTaille(etat.taille)}</p>
          </div>
          <p className="text-xs text-gray-500 italic">
            Prochaine étape : l&apos;OCR va extraire le texte de votre facture.
          </p>
        </div>
      )}

      {/* Boutons d'action */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push('/factures-fournisseurs')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          Annuler
        </button>

        {etat.type !== 'succes' ? (
          <button
            type="button"
            onClick={handleSoumettre}
            disabled={!fichierSelectionne || !fournisseurId || etat.type === 'uploading'}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {etat.type === 'uploading' ? 'Upload…' : 'Uploader la facture'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              // TODO Phase 2 : déclencher l'OCR ou rediriger vers la page de validation
              router.push('/factures-fournisseurs')
            }}
            className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
          >
            Continuer vers la validation →
          </button>
        )}
      </div>
    </div>
  )
}

// ── Icône selon le type MIME ─────────────────────────────────────────
function IconFichier({ mime }: { mime: string }) {
  if (mime === 'application/pdf') {
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
          clipRule="evenodd" />
      </svg>
    )
  }
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd"
        d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
        clipRule="evenodd" />
    </svg>
  )
}
