'use client'
// src/app/(dashboard)/fournisseurs/page-client.tsx
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SmartSearch, { fuzzyMatch } from '@/components/ui/smart-search'
import SortableTable, { Column } from '@/components/ui/sortable-table'

type Fournisseur = {
  id: number
  typeFournisseur: string | null
  raisonSociale: string
  telephone: string | null
  ville: string | null
  ice: string | null
  actif: boolean
}

export default function FournisseursPageClient({ fournisseurs }: { fournisseurs: Fournisseur[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query || query.length < 2) return fournisseurs
    return fournisseurs.filter(f =>
      fuzzyMatch(f.raisonSociale, query) ||
      fuzzyMatch(f.telephone ?? '', query) ||
      fuzzyMatch(f.ville ?? '', query)
    )
  }, [fournisseurs, query])

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'id', label: 'ID', sortable: true, className: 'text-slate-400 text-xs w-12' },
    { key: 'typeFournisseur', label: 'Type', sortable: true, render: (row) =>
      row.typeFournisseur
        ? <span className="badge badge-info">{String(row.typeFournisseur)}</span>
        : <span className="text-slate-300">—</span>
    },
    { key: 'raisonSociale', label: 'Raison sociale', sortable: true, render: (row) =>
      <span className="font-medium text-slate-800">{String(row.raisonSociale)}</span>
    },
    { key: 'telephone', label: 'Téléphone', sortable: true, render: (row) =>
      <span className="text-slate-500">{String(row.telephone ?? '—')}</span>
    },
    { key: 'ville', label: 'Ville', sortable: true, render: (row) =>
      <span className="text-slate-500">{String(row.ville ?? '—')}</span>
    },
    { key: 'ice', label: 'ICE', render: (row) =>
      <span className="text-slate-400 text-xs font-mono">{String(row.ice ?? '—')}</span>
    },
    { key: 'actions', label: '', render: (row) => (
      <Link href={`/fournisseurs/${row.id}/modifier`} className="btn-ghost btn-sm" onClick={e => e.stopPropagation()}>
        Modifier
      </Link>
    )},
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fournisseurs</h1>
          <p className="text-sm text-slate-400 mt-0.5">{filtered.length} / {fournisseurs.length} fournisseur(s)</p>
        </div>
        <Link href="/fournisseurs/nouveau" className="btn-primary text-sm">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 1v14M1 8h14"/></svg>
          <span className="hidden sm:inline">Nouveau fournisseur</span>
          <span className="sm:hidden">Nouveau</span>
        </Link>
      </div>

      <div className="card mb-4 p-3">
        <SmartSearch
          placeholder="Rechercher par nom, téléphone, ville..."
          apiUrl="/api/fournisseurs?q="
          mode="filter"
          onSearch={setQuery}
        />
        {query.length >= 2 && (
          <p className="text-xs text-slate-400 mt-1.5 ml-1">{filtered.length} résultat(s) pour &quot;{query}&quot;</p>
        )}
      </div>

      <div className="card overflow-hidden">
        <SortableTable
          columns={columns}
          data={filtered as Record<string, unknown>[]}
          defaultSort={{ key: 'id', dir: 'asc' }}
          rowKey={(row) => Number(row.id)}
          onRowClick={(row) => router.push(`/fournisseurs/${row.id}/modifier`)}
          emptyMessage="Aucun fournisseur trouvé"
          mobileCard={(row) => (
            <div className="card p-4 flex items-center justify-between active:bg-slate-50">
              <div>
                <div className="font-medium text-slate-800">{String(row.raisonSociale)}</div>
                <div className="text-xs text-slate-400 mt-0.5">{String(row.ville ?? '')} {row.telephone ? `· ${row.telephone}` : ''}</div>
              </div>
              <div className="text-xs text-slate-400 font-mono ml-4">{String(row.ice ?? '')}</div>
            </div>
          )}
        />
      </div>
    </div>
  )
}
