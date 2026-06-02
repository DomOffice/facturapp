'use client'
// src/app/(dashboard)/clients/page-client.tsx
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SmartSearch, { fuzzyMatch } from '@/components/ui/smart-search'
import SortableTable, { Column } from '@/components/ui/sortable-table'

type Client = {
  id: number
  typeClient: string | null
  raisonSociale: string
  telephone: string | null
  ville: string | null
  ice: string | null
  email: string | null
  actif: boolean
}

export default function ClientsPageClient({ clients }: { clients: Client[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query || query.length < 2) return clients
    return clients.filter(c =>
      fuzzyMatch(c.raisonSociale, query) ||
      fuzzyMatch(c.telephone ?? '', query) ||
      fuzzyMatch(c.ville ?? '', query) ||
      fuzzyMatch(c.ice ?? '', query)
    )
  }, [clients, query])

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'id', label: 'ID', sortable: true, className: 'text-slate-400 text-xs w-12' },
    { key: 'typeClient', label: 'Type', sortable: true, render: (row) => row.typeClient
      ? <span className="badge badge-info">{String(row.typeClient)}</span>
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
    { key: 'ice', label: 'ICE', sortable: false, render: (row) =>
      <span className="text-slate-400 text-xs font-mono">{String(row.ice ?? '—')}</span>
    },
    { key: 'actif', label: 'Statut', sortable: true, render: (row) =>
      row.actif
        ? <span className="badge badge-success">Actif</span>
        : <span className="badge badge-neutral">Inactif</span>
    },
    { key: 'actions', label: '', sortable: false, render: (row) => (
      <div className="flex gap-2 justify-end">
        <Link href={`/clients/${row.id}/modifier`} className="btn-ghost btn-sm" onClick={e => e.stopPropagation()}>Modifier</Link>
        <Link href={`/factures?clientId=${row.id}`} className="btn-ghost btn-sm text-indigo-500" onClick={e => e.stopPropagation()}>Factures</Link>
      </div>
    )},
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {filtered.length} / {clients.length} client(s)
          </p>
        </div>
        <Link href="/clients/nouveau" className="btn-primary text-sm">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 1v14M1 8h14"/></svg>
          <span className="hidden sm:inline">Nouveau client</span>
          <span className="sm:hidden">Nouveau</span>
        </Link>
      </div>

      <div className="card mb-4 p-3">
        <SmartSearch
          placeholder="Rechercher : nom, téléphone, ville, ICE... (ex: al ta pour Albert Tasso)"
          apiUrl="/api/clients?q="
          mode="filter"
          onSearch={setQuery}
        />
        {query.length >= 2 && (
          <p className="text-xs text-slate-400 mt-1.5 ml-1">
            {filtered.length} résultat(s) pour &quot;{query}&quot;
          </p>
        )}
      </div>

      <div className="card overflow-hidden">
        <SortableTable
          columns={columns}
          data={filtered as Record<string, unknown>[]}
          defaultSort={{ key: 'id', dir: 'asc' }}
          rowKey={(row) => Number(row.id)}
          onRowClick={(row) => router.push(`/clients/${row.id}/modifier`)}
          emptyMessage="Aucun client trouvé"
          mobileCard={(row) => (
            <div className="card p-4 flex items-center justify-between active:bg-slate-50">
              <div>
                <div className="font-medium text-slate-800">{String(row.raisonSociale)}</div>
                <div className="text-xs text-slate-400 mt-0.5">{String(row.ville ?? '')} {row.telephone ? `· ${row.telephone}` : ''}</div>
              </div>
              <div className="text-right">
                {row.typeClient ? <div className="badge badge-info mb-1">{String(row.typeClient)}</div> : null}
                <div className="text-xs text-slate-400 font-mono">{String(row.ice ?? '')}</div>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  )
}
