'use client'
// src/components/ui/smart-search.tsx
// Recherche dynamique : fuzzy match, debounce 300ms, min 2 caractères

import { useState, useEffect, useRef, useCallback } from 'react'

type SearchResult = {
  id: number
  label: string
  sublabel?: string
  badge?: string
}

type Props = {
  placeholder?: string
  apiUrl: string          // ex: /api/clients?q=
  onSelect?: (result: SearchResult) => void
  onSearch?: (query: string) => void  // pour filtrer la liste directement
  mode?: 'dropdown' | 'filter' | 'both'
  defaultValue?: string
  className?: string
}

// Fuzzy match : "al ta" trouve "Albert Tasso"
export function fuzzyMatch(text: string, query: string): boolean {
  if (!query || query.length < 2) return true
  const textLower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  
  // Chaque mot du query doit être présent dans le texte
  const words = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().split(/\s+/)
  return words.every(word => textLower.includes(word))
}

export default function SmartSearch({
  placeholder = 'Rechercher...',
  apiUrl,
  onSelect,
  onSearch,
  mode = 'filter',
  defaultValue = '',
  className = '',
}: Props) {
  const [query, setQuery] = useState(defaultValue)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fermer le dropdown si clic extérieur
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setShowDropdown(false)
      if (onSearch) onSearch('')
      return
    }

    // Mode filter — pas d'appel API, juste notifier le parent
    if (mode === 'filter') {
      if (onSearch) onSearch(q)
      return
    }

    // Mode dropdown ou both
    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data.slice(0, 8) : [])
      setShowDropdown(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }

    if (mode === 'both' && onSearch) onSearch(q)
  }, [apiUrl, mode, onSearch])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 300)
  }

  function handleSelect(result: SearchResult) {
    setQuery(result.label)
    setShowDropdown(false)
    if (onSelect) onSelect(result)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setShowDropdown(false)
    if (e.key === 'Enter') {
      if (onSearch) onSearch(query)
      setShowDropdown(false)
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="7" cy="7" r="5"/><path d="M12 12l2 2"/>
        </svg>
        <input
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && mode !== 'filter' && setShowDropdown(true)}
          placeholder={placeholder}
          className="form-input pl-9 pr-8"
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        )}
        {query && !loading && (
          <button
            onClick={() => { setQuery(''); setResults([]); setShowDropdown(false); if (onSearch) onSearch('') }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 2l10 10M12 2L2 12"/>
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown résultats */}
      {showDropdown && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => handleSelect(r)}
              className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 flex items-center justify-between transition-colors border-b border-slate-50 last:border-0"
            >
              <div>
                <div className="text-sm font-medium text-slate-800">{highlightMatch(r.label, query)}</div>
                {r.sublabel && <div className="text-xs text-slate-400 mt-0.5">{r.sublabel}</div>}
              </div>
              {r.badge && <span className="badge badge-info text-xs">{r.badge}</span>}
            </button>
          ))}
        </div>
      )}

      {showDropdown && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm text-slate-400">
          Aucun résultat pour &quot;{query}&quot;
        </div>
      )}
    </div>
  )
}

// Surligner les mots recherchés dans le texte
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text
  const words = query.trim().split(/\s+/).filter(w => w.length >= 2)
  if (!words.length) return text

  const regex = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(regex)

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-indigo-100 text-indigo-800 rounded px-0.5">{part}</mark>
    ) : part
  )
}
