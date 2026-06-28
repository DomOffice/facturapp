'use client'

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
  | { type: 'ocr_en_cours'; documentId: number; nomFichier: string }
  | {
      type: 'succes'
      documentId: number
      nomFichier: string
      nomStocke: string
      chemin: string
      typeMime: string
      taille: number
      texteOcr: string
    }
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
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [etat, setEtat] = useState<UploadEtat>({ type: 'idle' })
  const [fournisseurId, setFournisseurId] = useState('')
  const [fichierSelectionne, setFichierSelectionne] = useState<File | null>(null)

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

      const timer = setInterval(() => {
        setEtat((prev) =>
          prev.type === 'uploading'
            ? { type: 'uploading', progression: Math.min(prev.progression + 15, 85) }
            : prev
        )
      }, 200)

      const uploadRes = await fetch('/api/factures-fournisseurs/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(timer)

      const uploadData = await uploadRes.json()

      if (!uploadRes.ok) {
        setEtat({
          type: 'erreur',
          message: uploadData.error || "Erreur lors de l'upload.",
        })
        return
      }

      const documentId = Number(uploadData.documentId)

      if (!Number.isInteger(documentId) || documentId <= 0) {
        setEtat({
          type: 'erreur',
          message: "Upload terminé, mais l'identifiant du document est invalide.",
        })
        return
      }

      setEtat({
        type: 'ocr_en_cours',
        documentId,
        nomFichier: uploadData.fichier.nomOriginal,
      })

      const ocrRes = await fetch(`/api/factures-fournisseurs/ocr/${documentId}`, {
        method: 'POST',
      })

      const ocrData = await ocrRes.json()

      if (!ocrRes.ok) {
        setEtat({
          type: 'erreur',
          message: ocrData.error || "Erreur lors de l'OCR.",
        })
        return
      }

      setEtat({
        type: 'succes',
        documentId,
        nomFichier: uploadData.fichier.nomOriginal,
        nomStocke: uploadData.fichier.nomStocke,
        chemin: uploadData.fichier.chemin,
        typeMime: uploadData.fichier.typeMime,
        taille: uploadData.fichier.taille,
        texteOcr: ocrData.texte || '',
      })
    } catch (error) {
      console.error('[UPLOAD_OCR_FACTURE]', error)
      setEtat({
        type: 'erreur',
        message: 'Erreur réseau. Veuillez réessayer.',
      })
    }
  }

  const reinitialiser = () => {
    setFichierSelectionne(null)
    setEtat({ type: 'idle' })
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Fournisseur *
        </label>

        <select
          value={fournisseurId}
          onChange={(e) => setFournisseurId(e.target.value)}
          disabled={etat.type === 'uploading' || etat.type === 'ocr_en_cours'}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="">-- Sélectionner un fournisseur --</option>
          {fournisseurs.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nom}{f.code ? ` (${f.code})` : ''}
            </option>
          ))}
        </select>
      </div>

      {etat.type !== 'succes' && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all ${
            etat.type === 'drag_over'
              ? 'border-blue-500 bg-blue-50'
              : fichierSelectionne
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={onInputChange}
            className="hidden"
          />

          {fichierSelectionne ? (
            <div>
              <p className="font-medium text-gray-900">{fichierSelectionne.name}</p>
              <p className="text-sm text-gray-500">
                {LABELS_MIME[fichierSelectionne.type] || 'Fichier'} •{' '}
                {formaterTaille(fichierSelectionne.size)}
              </p>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  reinitialiser()
                }}
                className="text-xs text-red-500 hover:underline mt-1"
              >
                Changer de fichier
              </button>
            </div>
          ) : (
            <div>
              <p className="font-medium text-gray-900">
                {etat.type === 'drag_over'
                  ? 'Déposez le fichier ici'
                  : 'Glissez-déposez ou cliquez pour sélectionner'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                PDF, JPEG, PNG — 10 Mo maximum
              </p>
            </div>
          )}
        </div>
      )}

      {etat.type === 'uploading' && (
        <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-700">
          Upload en cours… {etat.progression}%
        </div>
      )}

      {etat.type === 'ocr_en_cours' && (
        <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
          Upload terminé. OCR en cours sur le document #{etat.documentId}…
        </div>
      )}

      {etat.type === 'erreur' && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {etat.message}
        </div>
      )}

      {etat.type === 'succes' && (
        <div className="space-y-4 rounded-lg border border-green-200 bg-green-50 p-5">
          <div>
            <h3 className="font-semibold text-green-800">
              OCR terminé avec succès
            </h3>
            <p className="text-sm text-green-700 mt-1">
              Document #{etat.documentId} — {etat.nomFichier}
            </p>
            <p className="text-sm text-green-700">
              Taille : {formaterTaille(etat.taille)}
            </p>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-2">Texte OCR extrait</h4>
            <pre className="max-h-96 overflow-auto rounded-md bg-white p-4 text-xs text-gray-800 border whitespace-pre-wrap">
              {etat.texteOcr || 'Aucun texte extrait.'}
            </pre>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push('/factures-fournisseurs')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Annuler
        </button>

        {etat.type !== 'succes' ? (
          <button
            type="button"
            onClick={handleSoumettre}
            disabled={
              !fichierSelectionne ||
              !fournisseurId ||
              etat.type === 'uploading' ||
              etat.type === 'ocr_en_cours'
            }
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {etat.type === 'uploading'
              ? 'Upload…'
              : etat.type === 'ocr_en_cours'
                ? 'OCR en cours…'
                : 'Uploader et lancer OCR'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => router.push('/factures-fournisseurs')}
            className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
          >
            Terminer
          </button>
        )}
      </div>
    </div>
  )
}