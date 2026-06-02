'use client'
// src/app/(dashboard)/produits/page-client.tsx
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SmartSearch, { fuzzyMatch } from '@/components/ui/smart-search'
import SortableTable, { Column } from '@/components/ui/sortable-table'
import { formatMontant } from '@/lib/utils/currency'

type Produit = {
  id: number
  reference: string
  description: string
  dernierPrixAchatHt: number
  prixVenteHt: number
  margeHt: number
  tauxTva: number | null
  dernierPrixAchatTtc: number
  prixVenteTtc: number
  actif: boolean
}

export default function ProduitsPageClient({ produits }: { produits: Produit[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query || query.length < 2) return produits
    return produits.filter(p =>
      fuzzyMatch(p.description, query) ||
      fuzzyMatch(p.reference, query)
    )
  }, [produits, query])

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'id', label: 'ID', sortable: true, className: 'text-slate-400 text-xs w-12' },
    { key: 'reference', label: 'Référence', sortable: true, render: (row) =>
      <span className="badge badge-info">{String(row.reference)}</span>
    },
    { key: 'description', label: 'Description', sortable: true, render: (row) =>
      <span className="font-medium text-slate-800">{String(row.description)}</span>
    },
    { key: 'dernierPrixAchatHt', label: 'P.Achat HT', sortable: true, render: (row) =>
      formatMontant(Number(row.dernierPrixAchatHt))
    },
    { key: 'prixVenteHt', label: 'P.Vente HT', sortable: true, render: (row) =>
      <span className="font-medium text-indigo-600">{formatMontant(Number(row.prixVenteHt))}</span>
    },
    { key: 'margeHt', label: 'Marge HT', sortable: true, render: (row) =>
      <span className="text-emerald-600">{formatMontant(Number(row.margeHt))}</span>
    },
    { key: 'tauxTva', label: 'TVA', sortable: true, render: (row) =>
      <span className="text-slate-500">{row.tauxTva !== null ? `${row.tauxTva}%` : '—'}</span>
    },
    { key: 'prixVenteTtc', label: 'P.Vente TTC', sortable: true, render: (row) =>
      <span className="font-semibold">{formatMontant(Number(row.prixVenteTtc))}</span>
    },
    { key: 'actions', label: '', render: (row) => (
      <Link href={`/produits/${row.id}/modifier`} className="btn-ghost btn-sm" onClick={e => e.stopPropagation()}>
        Modifier
      </Link>
    )},
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Produits</h1>
          <p className="text-sm text-slate-400 mt-0.5">{filtered.length} / {produits.length} produit(s)</p>
        </div>
        <Link href="/produits/nouveau" className="btn-primary text-sm">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 1v14M1 8h14"/></svg>
          <span className="hidden sm:inline">Nouveau produit</span>
          <span className="sm:hidden">Nouveau</span>
        </Link>
      </div>

      <div className="card mb-4 p-3">
        <SmartSearch
          placeholder="Rechercher par description ou référence..."
          apiUrl="/api/produits?q="
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
          onRowClick={(row) => router.push(`/produits/${row.id}/modifier`)}
          emptyMessage="Aucun produit trouvé"
          mobileCard={(row) => (
            <div className="card p-4 flex items-center justify-between active:bg-slate-50">
              <div>
                <div className="text-xs text-indigo-500 font-medium">{String(row.reference)}</div>
                <div className="font-medium text-slate-800 truncate max-w-48">{String(row.description)}</div>
                <div className="text-xs text-slate-400 mt-0.5">Achat: {formatMontant(Number(row.dernierPrixAchatHt))} · TVA: {String(row.tauxTva ?? '')}%</div>
              </div>
              <div className="text-right ml-4">
                <div className="font-bold text-indigo-600">{formatMontant(Number(row.prixVenteTtc))}</div>
                <div className="text-xs text-emerald-600">+{formatMontant(Number(row.margeHt))}</div>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  )
}
