'use client'
// src/app/(dashboard)/devis/page-client.tsx
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SmartSearch, { fuzzyMatch } from '@/components/ui/smart-search'
import SortableTable, { Column } from '@/components/ui/sortable-table'
import { formatMontant } from '@/lib/utils/currency'

type Devis = {
  id: number
  numeroDevis: string
  clientNom: string
  dateDevis: string
  dateValidite?: string | null
  totalHt: number
  totalTtc: number
  statut: string
}

export default function DevisPageClient({ devis }: { devis: Devis[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [filtreStatut, setFiltreStatut] = useState('')

  const filtered = useMemo(() => {
    return devis.filter(d => {
      const matchQuery = !query || query.length < 2 ||
        fuzzyMatch(d.numeroDevis, query) || fuzzyMatch(d.clientNom, query)
      const matchStatut = !filtreStatut || d.statut === filtreStatut
      return matchQuery && matchStatut
    })
  }, [devis, query, filtreStatut])

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'id', label: 'ID', sortable: true, className: 'text-slate-400 text-xs w-12' },
    { key: 'numeroDevis', label: 'N° Devis', sortable: true, render: (row) =>
      <span className="font-mono font-semibold text-indigo-600">{String(row.numeroDevis)}</span>
    },
    { key: 'clientNom', label: 'Client', sortable: true, render: (row) =>
      <span className="max-w-xs truncate block">{String(row.clientNom)}</span>
    },
    { key: 'dateDevis', label: 'Date', sortable: true, render: (row) =>
      <span className="text-slate-500">{new Date(String(row.dateDevis)).toLocaleDateString('fr-FR')}</span>
    },
    { key: 'dateValidite', label: 'Validité', sortable: true, render: (row) =>
      row.dateValidite
        ? <span className="text-slate-500">{new Date(String(row.dateValidite)).toLocaleDateString('fr-FR')}</span>
        : <span className="text-slate-300">—</span>
    },
    { key: 'totalHt', label: 'Total HT', sortable: true, render: (row) =>
      formatMontant(Number(row.totalHt))
    },
    { key: 'totalTtc', label: 'Total TTC', sortable: true, render: (row) =>
      <span className="font-semibold text-indigo-700">{formatMontant(Number(row.totalTtc))}</span>
    },
    { key: 'statut', label: 'Statut', sortable: true, render: (row) => {
      const s = String(row.statut)
      return s === 'accepte' ? <span className="badge badge-success">Accepté</span>
        : s === 'refuse' ? <span className="badge badge-danger">Refusé</span>
        : s === 'envoye' ? <span className="badge badge-info">Envoyé</span>
        : <span className="badge badge-neutral">Brouillon</span>
    }},
    { key: 'actions', label: '', sortable: false, render: (row) => (
      <div className="flex gap-2 justify-end">
        <Link href={`/devis/${row.id}`} className="btn-ghost btn-sm" onClick={e => e.stopPropagation()}>Voir</Link>
        <Link href={`/devis/${row.id}/modifier`} className="btn-ghost btn-sm" onClick={e => e.stopPropagation()}>Modifier</Link>
      </div>
    )},
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Devis</h1>
          <p className="text-sm text-slate-400 mt-0.5">{filtered.length} / {devis.length} devis</p>
        </div>
        <Link href="/devis/nouveau" className="btn-primary text-sm">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 1v14M1 8h14"/></svg>
          Nouveau devis
        </Link>
      </div>

      <div className="card mb-4 p-3 flex flex-col sm:flex-row gap-2">
        <SmartSearch
          placeholder="Rechercher par N° ou client..."
          apiUrl="/api/devis?q="
          mode="filter"
          onSearch={setQuery}
          className="flex-1"
        />
        <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} className="form-select sm:w-36">
          <option value="">Tous</option>
          <option value="brouillon">Brouillon</option>
          <option value="envoye">Envoyé</option>
          <option value="accepte">Accepté</option>
          <option value="refuse">Refusé</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <SortableTable
          columns={columns}
          data={filtered as Record<string, unknown>[]}
          defaultSort={{ key: 'id', dir: 'asc' }}
          rowKey={(row) => Number(row.id)}
          onRowClick={(row) => router.push(`/devis/${row.id}`)}
          emptyMessage="Aucun devis"
          mobileCard={(row) => (
            <div className="card p-4 flex items-center justify-between active:bg-slate-50">
              <div>
                <div className="font-mono font-bold text-indigo-600 text-sm">{String(row.numeroDevis)}</div>
                <div className="text-sm font-medium text-slate-700 truncate max-w-48 mt-0.5">{String(row.clientNom)}</div>
                <div className="text-xs text-slate-400 mt-0.5">{new Date(String(row.dateDevis)).toLocaleDateString('fr-FR')}</div>
              </div>
              <div className="text-right ml-4">
                <div className="font-bold text-slate-800">{formatMontant(Number(row.totalTtc))}</div>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  )
}
