'use client'
// src/app/(dashboard)/factures/page-client.tsx
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SmartSearch, { fuzzyMatch } from '@/components/ui/smart-search'
import SortableTable, { Column } from '@/components/ui/sortable-table'
import { formatMontant } from '@/lib/utils/currency'
import { exporterFacturesExcel } from '@/lib/exports/excel/export-excel'

type Facture = {
  id: number
  numeroFacture: string
  clientNom: string
  dateFacture: string
  totalHt: number
  totalTtc: number
  margeHt: number
  statut: string
  estPayee: boolean
  datePaiement?: string | null
  modeReglement?: string | null
  numeroPiece?: string | null
}

export default function FacturesPageClient({ factures }: { factures: Facture[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [filtreStatut, setFiltreStatut] = useState('')
  const [loadingExcel, setLoadingExcel] = useState(false)

  const filtered = useMemo(() => {
    return factures.filter(f => {
      const matchQuery = !query || query.length < 2 ||
        fuzzyMatch(f.numeroFacture, query) ||
        fuzzyMatch(f.clientNom, query)
      const matchStatut = !filtreStatut || f.statut === filtreStatut
      return matchQuery && matchStatut
    })
  }, [factures, query, filtreStatut])

  async function handleExcelExport() {
    setLoadingExcel(true)
    try {
      await exporterFacturesExcel(filtered.map(f => ({
        numeroFacture: f.numeroFacture,
        clientNom: f.clientNom,
        dateFacture: f.dateFacture,
        totalLignes: 0,
        totalArticles: 0,
        totalHt: f.totalHt,
        totalTva: f.totalTtc - f.totalHt,
        totalTtc: f.totalTtc,
        margeHt: f.margeHt,
        statut: f.statut,
        estPayee: f.estPayee,
        datePaiement: f.datePaiement,
        modeReglement: f.modeReglement,
        numeroPiece: f.numeroPiece,
      })))
    } catch (e) {
      alert('Erreur export Excel')
    } finally {
      setLoadingExcel(false)
    }
  }

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'id', label: 'ID', sortable: true, className: 'text-slate-400 text-xs w-12' },
    { key: 'numeroFacture', label: 'N° Facture', sortable: true, render: (row) =>
      <Link href={`/factures/${row.id}`} className="text-indigo-600 font-mono font-semibold hover:underline" onClick={e => e.stopPropagation()}>
        {String(row.numeroFacture)}
      </Link>
    },
    { key: 'clientNom', label: 'Client', sortable: true, render: (row) =>
      <span className="max-w-xs truncate block">{String(row.clientNom)}</span>
    },
    { key: 'dateFacture', label: 'Date', sortable: true, render: (row) =>
      <span className="text-slate-500">{new Date(String(row.dateFacture)).toLocaleDateString('fr-FR')}</span>
    },
    { key: 'totalHt', label: 'Total HT', sortable: true, render: (row) =>
      formatMontant(Number(row.totalHt))
    },
    { key: 'totalTtc', label: 'Total TTC', sortable: true, render: (row) =>
      <span className="font-semibold text-indigo-700">{formatMontant(Number(row.totalTtc))}</span>
    },
    { key: 'statut', label: 'Statut', sortable: true, render: (row) =>
      row.statut === 'validee' ? <span className="badge badge-info">Validée</span>
      : row.statut === 'brouillon' ? <span className="badge badge-neutral">Brouillon</span>
      : <span className="badge badge-danger">Annulée</span>
    },
    { key: 'estPayee', label: 'Paiement', sortable: true, render: (row) =>
      row.estPayee ? <span className="badge badge-success">Payée</span>
      : row.statut === 'validee' ? <span className="badge badge-warning">En attente</span>
      : <span className="text-slate-300">—</span>
    },
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Factures</h1>
          <p className="text-sm text-slate-400 mt-0.5">{filtered.length} / {factures.length} facture(s)</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExcelExport}
            disabled={loadingExcel || filtered.length === 0}
            className="btn-secondary btn-sm flex items-center gap-1.5"
          >
            {loadingExcel ? (
              <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/>
                <path d="M5 5h6M5 8h3M8 11v3M6 13l2 2 2-2"/>
              </svg>
            )}
            <span className="hidden sm:inline">Excel</span>
          </button>
          <Link href="/factures/nouvelle" className="btn-primary text-sm">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 1v14M1 8h14"/></svg>
            <span className="hidden sm:inline">Nouvelle facture</span>
            <span className="sm:hidden">Nouveau</span>
          </Link>
        </div>
      </div>

      <div className="card mb-4 p-3 flex flex-col sm:flex-row gap-2">
        <SmartSearch
          placeholder="Rechercher par N° ou client..."
          apiUrl="/api/factures?q="
          mode="filter"
          onSearch={setQuery}
          className="flex-1"
        />
        <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} className="form-select sm:w-36">
          <option value="">Tous</option>
          <option value="brouillon">Brouillon</option>
          <option value="validee">Validée</option>
          <option value="annulee">Annulée</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <SortableTable
          columns={columns}
          data={filtered as Record<string, unknown>[]}
          defaultSort={{ key: 'id', dir: 'asc' }}
          rowKey={(row) => Number(row.id)}
          onRowClick={(row) => router.push(`/factures/${row.id}`)}
          emptyMessage="Aucune facture trouvée"
          mobileCard={(row) => (
            <Link href={`/factures/${row.id}`} className="card p-4 flex items-center justify-between active:bg-slate-50 block">
              <div className="flex items-center justify-between w-full">
                <div>
                  <div className="font-mono font-bold text-indigo-600 text-sm">{String(row.numeroFacture)}</div>
                  <div className="text-sm font-medium text-slate-700 truncate max-w-48 mt-0.5">{String(row.clientNom)}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{new Date(String(row.dateFacture)).toLocaleDateString('fr-FR')}</div>
                </div>
                <div className="text-right ml-4">
                  <div className="font-bold text-slate-800">{formatMontant(Number(row.totalTtc))}</div>
                  <div className="mt-1">
                    {row.estPayee ? <span className="badge badge-success">Payée</span>
                      : row.statut === 'validee' ? <span className="badge badge-warning">Attente</span>
                      : <span className="badge badge-neutral">Brouillon</span>}
                  </div>
                </div>
              </div>
            </Link>
          )}
        />
      </div>
    </div>
  )
}
