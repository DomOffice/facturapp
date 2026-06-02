'use client'
// src/components/ui/sortable-table.tsx
// En-tête de colonne triable — clic pour trier asc/desc

import { useState, useMemo } from 'react'

export type Column<T> = {
  key: keyof T | string
  label: string
  sortable?: boolean
  className?: string
  render?: (row: T) => React.ReactNode
}

type SortDir = 'asc' | 'desc'

type Props<T> = {
  columns: Column<T>[]
  data: T[]
  defaultSort?: { key: string; dir: SortDir }
  rowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  emptyMessage?: string
  mobileCard?: (row: T) => React.ReactNode
}

export default function SortableTable<T extends Record<string, unknown>>({
  columns,
  data,
  defaultSort,
  rowKey,
  onRowClick,
  emptyMessage = 'Aucune donnée',
  mobileCard,
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string>(defaultSort?.key ?? '')
  const [sortDir, setSortDir] = useState<SortDir>(defaultSort?.dir ?? 'asc')

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1

      let cmp = 0
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv
      } else if (av instanceof Date && bv instanceof Date) {
        cmp = av.getTime() - bv.getTime()
      } else {
        cmp = String(av).localeCompare(String(bv), 'fr', { sensitivity: 'base' })
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  return (
    <>
      {/* MOBILE — cartes custom */}
      {mobileCard && (
        <div className="md:hidden space-y-2">
          {sorted.map(row => (
            <div key={rowKey(row)} onClick={() => onRowClick?.(row)}>
              {mobileCard(row)}
            </div>
          ))}
          {sorted.length === 0 && (
            <div className="card p-8 text-center text-slate-400 text-sm">{emptyMessage}</div>
          )}
        </div>
      )}

      {/* DESKTOP — tableau */}
      <div className={`${mobileCard ? 'hidden md:block' : ''} overflow-x-auto`}>
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  className={`${col.className ?? ''} ${col.sortable ? 'cursor-pointer select-none hover:text-slate-700' : ''}`}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <span className="inline-flex flex-col gap-px">
                        <svg width="8" height="5" viewBox="0 0 8 5" fill={sortKey === String(col.key) && sortDir === 'asc' ? '#6366f1' : '#cbd5e1'}>
                          <path d="M4 0L8 5H0z"/>
                        </svg>
                        <svg width="8" height="5" viewBox="0 0 8 5" fill={sortKey === String(col.key) && sortDir === 'desc' ? '#6366f1' : '#cbd5e1'}>
                          <path d="M4 5L0 0H8z"/>
                        </svg>
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'cursor-pointer' : ''}
              >
                {columns.map(col => (
                  <td key={String(col.key)} className={col.className}>
                    {col.render
                      ? col.render(row)
                      : String(row[String(col.key)] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-center text-slate-400 py-10">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
