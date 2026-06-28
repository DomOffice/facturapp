'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Fournisseur = {
  id: number
  nom: string
  code?: string | null
}

type ExtractionFacture = {
  fournisseurNom?: string
  numeroFacture?: string
  dateFacture?: string
  iceFournisseur?: string
  totalHt?: number
  totalTva?: number
  totalTtc?: number
  devise?: string
  confiance?: number
  alertes?: string[]
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
      extraction?: ExtractionFacture
    }
  | { type: 'erreur'; message: string }

type Props = {
  fournisseurs: Fournisseur[]
}

const FORMATS_ACCEPTES = ['application/pdf', 'image/jpeg', 'image/png']

function formaterTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

function formaterMontant(value?: number, devise = 'MAD') {
  if (typeof value !== 'number') return 'Non détecté'
  return `${value.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${devise}`
}

export default function UploadFacture({ fournisseurs }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [etat, setEtat] = useState<UploadEtat>({ type: 'idle' })
  const [fournisseurId, setFournisseurId] = useState('')
  const [fichierSelectionne, setFichierSelectionne] = useState<File | null>(null)

  const validerFichier = (fichier: File): string | null => {
    if (!FORMATS_ACCEPTES.includes(fichier.type)) {
      return 'Format non autorisé. Formats acceptés : PDF, JPEG, PNG.'
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

      const uploadRes = await fetch('/api/factures-fournisseurs/upload', {
        method: 'POST',
        body: formData,
      })

      const uploadData = await uploadRes.json()

      if (!uploadRes.ok) {
        setEtat({ type: 'erreur', message: uploadData.error || "Erreur lors de l'upload." })
        return
      }

      const documentId = Number(uploadData.documentId)

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
        setEtat({ type: 'erreur', message: ocrData.error || "Erreur lors de l'OCR." })
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
        extraction: ocrData.extraction,
      })
    } catch (error) {
      console.error('[UPLOAD_OCR_FACTURE]', error)
      setEtat({ type: 'erreur', message: 'Erreur réseau. Veuillez réessayer.' })
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
          onDragOver={(e) => {
            e.preventDefault()
            setEtat({ type: 'drag_over' })
          }}
          onDragLeave={() => etat.type === 'drag_over' && setEtat({ type: 'idle' })}
          onDrop={(e) => {
            e.preventDefault()
            const fichier = e.dataTransfer.files?.[0]
            if (fichier) selectionnerFichier(fichier)
          }}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer border-gray-300 hover:border-blue-400 hover:bg-gray-50"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => {
              const fichier = e.target.files?.[0]
              if (fichier) selectionnerFichier(fichier)
            }}
            className="hidden"
          />

          {fichierSelectionne ? (
            <div>
              <p className="font-medium text-gray-900">{fichierSelectionne.name}</p>
              <p className="text-sm text-gray-500">{formaterTaille(fichierSelectionne.size)}</p>
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
                Glissez-déposez ou cliquez pour sélectionner
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
          Upload en cours…
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
            <h3 className="font-semibold text-green-800">OCR terminé avec succès</h3>
            <p className="text-sm text-green-700 mt-1">
              Document #{etat.documentId} — {etat.nomFichier}
            </p>
          </div>

          {etat.extraction && (
            <div className="rounded-md bg-white border p-4">
              <h4 className="font-semibold text-gray-900 mb-3">
                Données détectées
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><strong>Fournisseur :</strong> {etat.extraction.fournisseurNom || 'Non détecté'}</div>
                <div><strong>N° facture :</strong> {etat.extraction.numeroFacture || 'Non détecté'}</div>
                <div><strong>Date :</strong> {etat.extraction.dateFacture || 'Non détectée'}</div>
                <div><strong>ICE :</strong> {etat.extraction.iceFournisseur || 'Non détecté'}</div>
                <div><strong>Total HT :</strong> {formaterMontant(etat.extraction.totalHt, etat.extraction.devise)}</div>
                <div><strong>TVA :</strong> {formaterMontant(etat.extraction.totalTva, etat.extraction.devise)}</div>
                <div><strong>Total TTC :</strong> {formaterMontant(etat.extraction.totalTtc, etat.extraction.devise)}</div>
                <div><strong>Confiance :</strong> {etat.extraction.confiance ?? 0}%</div>
              </div>

              {etat.extraction.alertes && etat.extraction.alertes.length > 0 && (
                <div className="mt-4 rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                  <strong>Alertes :</strong>
                  <ul className="list-disc ml-5 mt-1">
                    {etat.extraction.alertes.map((alerte, index) => (
                      <li key={index}>{alerte}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div>
            <h4 className="font-medium text-gray-900 mb-2">Texte OCR brut</h4>
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
            {etat.type === 'ocr_en_cours' ? 'OCR en cours…' : 'Uploader et lancer OCR'}
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