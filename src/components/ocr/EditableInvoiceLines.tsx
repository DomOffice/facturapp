'use client'

import ConfidenceBadge from './ConfidenceBadge'

export type LigneFactureExtraite = {
  reference?: string
  designation: string
  quantite?: number
  prixUnitaireTtc?: number
  tauxTva?: number
  totalTtc?: number
  confiance: number
  alertes: string[]
}

type Props = {
  lignes: LigneFactureExtraite[]
  onChange: (lignes: LigneFactureExtraite[]) => void
}

export default function EditableInvoiceLines({ lignes, onChange }: Props) {
  function modifierLigne(
    index: number,
    champ: keyof LigneFactureExtraite,
    valeur: string,
  ) {
    const lignesMaj = lignes.map((ligne, i) => {
      if (i !== index) return ligne

      if (
        champ === 'quantite' ||
        champ === 'prixUnitaireTtc' ||
        champ === 'tauxTva' ||
        champ === 'totalTtc'
      ) {
        const nombre = Number(valeur.replace(',', '.'))
        return {
          ...ligne,
          [champ]: Number.isFinite(nombre) ? nombre : undefined,
        }
      }

      return {
        ...ligne,
        [champ]: valeur,
      }
    })

    onChange(lignesMaj)
  }

  if (lignes.length === 0) return null

  return (
    <div className="mt-6">
      <h4 className="font-semibold mb-3">Lignes articles détectées</h4>

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Référence</th>
              <th className="px-3 py-2 text-left">Désignation</th>
              <th className="px-3 py-2 text-right">Qté</th>
              <th className="px-3 py-2 text-right">PU TTC</th>
              <th className="px-3 py-2 text-right">TVA</th>
              <th className="px-3 py-2 text-right">Total TTC</th>
              <th className="px-3 py-2 text-center">Confiance</th>
            </tr>
          </thead>

          <tbody>
            {lignes.map((ligne, index) => (
              <tr key={index} className="border-t align-top">
                <td className="px-3 py-2">
                  <input
                    value={ligne.reference || ''}
                    onChange={(e) => modifierLigne(index, 'reference', e.target.value)}
                    className="w-28 border rounded px-2 py-1"
                  />
                </td>

                <td className="px-3 py-2">
                  <textarea
                    value={ligne.designation || ''}
                    onChange={(e) => modifierLigne(index, 'designation', e.target.value)}
                    className="w-full min-w-[260px] max-w-[420px] border rounded px-2 py-1"
                    rows={2}
                  />
                </td>

                <td className="px-3 py-2 text-right">
                  <input
                    value={ligne.quantite ?? ''}
                    onChange={(e) => modifierLigne(index, 'quantite', e.target.value)}
                    className="w-20 border rounded px-2 py-1 text-right"
                  />
                </td>

                <td className="px-3 py-2 text-right">
                  <input
                    value={ligne.prixUnitaireTtc ?? ''}
                    onChange={(e) => modifierLigne(index, 'prixUnitaireTtc', e.target.value)}
                    className="w-24 border rounded px-2 py-1 text-right"
                  />
                </td>

                <td className="px-3 py-2 text-right">
                  <input
                    value={ligne.tauxTva ?? ''}
                    onChange={(e) => modifierLigne(index, 'tauxTva', e.target.value)}
                    className="w-20 border rounded px-2 py-1 text-right"
                  />
                </td>

                <td className="px-3 py-2 text-right">
                  <input
                    value={ligne.totalTtc ?? ''}
                    onChange={(e) => modifierLigne(index, 'totalTtc', e.target.value)}
                    className="w-24 border rounded px-2 py-1 text-right"
                  />
                </td>

                <td className="px-3 py-2 text-center">
                  <ConfidenceBadge confiance={ligne.confiance} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}