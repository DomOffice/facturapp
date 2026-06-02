'use client'
// src/app/(dashboard)/parametres/page-client.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Type = { id: number; code: string; nom: string }
type Parametre = {
  id: number; typeId: number; typeNom: string; typeCode: string
  code: string; libelle: string; valeurNum: number | null; actif: boolean
}

export default function ParametresClient({ types, parametres }: { types: Type[]; parametres: Parametre[] }) {
  const router = useRouter()
  const [filtreType, setFiltreType] = useState<number | null>(null)
  const [ajout, setAjout] = useState(false)
  const [newLibelle, setNewLibelle] = useState('')
  const [newValeur, setNewValeur] = useState('')
  const [saving, setSaving] = useState(false)

  const filtrés = filtreType
    ? parametres.filter(p => p.typeId === filtreType)
    : parametres

  const typeActif = types.find(t => t.id === filtreType)
  const besoinValeur = typeActif?.code === 'taux_tva'

  async function ajouter() {
    if (!filtreType || !newLibelle.trim()) return
    setSaving(true)
    try {
      await fetch('/api/parametres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typeId: filtreType,
          code: newLibelle.toLowerCase().replace(/\s+/g, '_').replace(/[éèê]/g, 'e').replace(/[àâ]/g, 'a'),
          libelle: newLibelle,
          valeurNum: newValeur ? Number(newValeur) : null,
        }),
      })
      setNewLibelle('')
      setNewValeur('')
      setAjout(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActif(id: number, actif: boolean) {
    await fetch(`/api/parametres/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actif: !actif }),
    })
    router.refresh()
  }

  return (
    <div className="p-6">
      <div className="page-header">
        <h1 className="page-title">Paramètres</h1>
      </div>

      <div className="flex gap-4">
        {/* Sidebar types */}
        <div className="w-56 flex-shrink-0">
          <div className="card overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Catégories
            </div>
            {types.map(t => (
              <button
                key={t.id}
                onClick={() => { setFiltreType(t.id); setAjout(false) }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-slate-50
                  ${filtreType === t.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {t.nom}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1">
          {filtreType ? (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700 font-display">{typeActif?.nom}</h2>
                <button onClick={() => setAjout(!ajout)} className="btn-primary btn-sm">+ Ajouter</button>
              </div>

              {ajout && (
                <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="form-label">Libellé *</label>
                    <input value={newLibelle} onChange={e => setNewLibelle(e.target.value)} className="form-input" placeholder="Nouveau libellé" autoFocus />
                  </div>
                  {besoinValeur && (
                    <div className="w-32">
                      <label className="form-label">Valeur (%)</label>
                      <input type="number" value={newValeur} onChange={e => setNewValeur(e.target.value)} className="form-input" placeholder="0" />
                    </div>
                  )}
                  <button onClick={ajouter} disabled={saving} className="btn-primary">{saving ? '...' : 'Ajouter'}</button>
                  <button onClick={() => setAjout(false)} className="btn-secondary">Annuler</button>
                </div>
              )}

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Libellé</th>
                    {besoinValeur && <th>Valeur</th>}
                    <th>Statut</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrés.map(p => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.libelle}</td>
                      {besoinValeur && <td className="text-indigo-600">{p.valeurNum !== null ? `${p.valeurNum}%` : '—'}</td>}
                      <td>
                        {p.actif
                          ? <span className="badge badge-success">Actif</span>
                          : <span className="badge badge-neutral">Inactif</span>}
                      </td>
                      <td>
                        <button
                          onClick={() => toggleActif(p.id, p.actif)}
                          className="btn-ghost btn-sm"
                        >
                          {p.actif ? 'Désactiver' : 'Activer'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtrés.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-slate-400 py-8">Aucun paramètre dans cette catégorie</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card p-12 text-center text-slate-400">
              <div className="text-4xl mb-3">⚙️</div>
              <div>Sélectionner une catégorie à gauche</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
