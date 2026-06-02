'use client'
// src/app/(dashboard)/admin/sync/page.tsx
// Page de synchronisation bidirectionnelle PostgreSQL ↔ MariaDB

import { useState } from 'react'

type SyncResult = {
  success: boolean
  duration: string
  log: string[]
  warnings?: string[]
  error?: string
}

type Direction = 'pg-to-maria' | 'maria-to-pg'

export default function SyncPage() {
  const [direction, setDirection] = useState<Direction>('pg-to-maria')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [lastSync, setLastSync] = useState<{ dir: Direction; date: string } | null>(null)

  const config = {
    'pg-to-maria': {
      label: 'FacturApp → VB6',
      description: 'Copie les données saisies dans FacturApp vers MariaDB pour que VB6 les voie',
      source: 'PostgreSQL (FacturApp)',
      cible: 'MariaDB (VB6)',
      couleur: 'indigo',
      warning: 'Les données MariaDB/VB6 seront écrasées par celles de FacturApp.',
      useCasePrimary: true,
    },
    'maria-to-pg': {
      label: 'VB6 → FacturApp',
      description: 'Copie les données saisies dans VB6 vers PostgreSQL pour les retrouver dans FacturApp',
      source: 'MariaDB (VB6)',
      cible: 'PostgreSQL (FacturApp)',
      couleur: 'amber',
      warning: 'Les données FacturApp/PostgreSQL seront écrasées par celles de VB6.',
      useCasePrimary: false,
    },
  }

  const c = config[direction]

  async function lancerSync() {
    const msg = `Confirmer la synchronisation ?\n\n${c.source} → ${c.cible}\n\n⚠️ ${c.warning}\n\nCela peut prendre 1 à 2 minutes.`
    if (!confirm(msg)) return

    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/admin/sync-mariadb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      })
      const data = await res.json()
      setResult(data)
      if (data.success) {
        setLastSync({ dir: direction, date: new Date().toLocaleString('fr-FR') })
      }
    } catch {
      setResult({ success: false, duration: '?', log: [], error: 'Erreur réseau' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Synchronisation des bases</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Synchronisation bidirectionnelle PostgreSQL ↔ MariaDB
          </p>
        </div>
      </div>

      {/* Choix du sens */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {(Object.entries(config) as [Direction, typeof config[Direction]][]).map(([key, cfg]) => (
          <button
            key={key}
            type="button"
            onClick={() => { setDirection(key); setResult(null) }}
            className={`card p-4 text-left transition-all border-2 ${
              direction === key
                ? key === 'pg-to-maria'
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-amber-500 bg-amber-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className={`text-sm font-bold ${
                direction === key
                  ? key === 'pg-to-maria' ? 'text-indigo-700' : 'text-amber-700'
                  : 'text-slate-600'
              }`}>
                {cfg.label}
              </div>
              {cfg.useCasePrimary && (
                <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-medium">
                  Recommandé
                </span>
              )}
              {direction === key && (
                <div className={`w-4 h-4 rounded-full flex-shrink-0 ${
                  key === 'pg-to-maria' ? 'bg-indigo-500' : 'bg-amber-500'
                }`} />
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
              <span className={`font-medium ${direction === key ? (key === 'pg-to-maria' ? 'text-indigo-600' : 'text-amber-600') : ''}`}>
                {cfg.source}
              </span>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
              <span className={`font-medium ${direction === key ? (key === 'pg-to-maria' ? 'text-indigo-600' : 'text-amber-600') : ''}`}>
                {cfg.cible}
              </span>
            </div>
            <p className="text-xs text-slate-400">{cfg.description}</p>
          </button>
        ))}
      </div>

      {/* Avertissement */}
      <div className={`card p-3 mb-4 border ${
        direction === 'pg-to-maria'
          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
          : 'bg-amber-50 border-amber-200 text-amber-700'
      } text-sm`}>
        <strong>⚠️ Attention :</strong> {c.warning}
      </div>

      {/* Dernière sync */}
      {lastSync && (
        <div className="text-xs text-slate-400 mb-3">
          Dernière sync ({lastSync.dir === 'pg-to-maria' ? 'FacturApp → VB6' : 'VB6 → FacturApp'}) :
          <span className="font-medium text-slate-600 ml-1">{lastSync.date}</span>
        </div>
      )}

      {/* Bouton */}
      <button
        type="button"
        onClick={lancerSync}
        disabled={loading}
        className={`w-full py-3 px-6 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-colors ${
          direction === 'pg-to-maria'
            ? 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300'
            : 'bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300'
        }`}
      >
        {loading ? (
          <>
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Synchronisation en cours...
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 4h14M1 4l3-3M1 4l3 3M15 12H1M15 12l-3-3M15 12l-3 3"/>
            </svg>
            Lancer : {c.source} → {c.cible}
          </>
        )}
      </button>

      {/* Résultat */}
      {result && (
        <div className={`card overflow-hidden mt-4 ${result.success ? 'border-green-200' : 'border-red-200'}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
            <span className={`font-semibold ${result.success ? 'text-green-600' : 'text-red-600'}`}>
              {result.success ? '✅ Synchronisation réussie' : '❌ Synchronisation échouée'}
            </span>
            <span className="text-sm text-slate-500">{result.duration}</span>
          </div>
          {result.error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm border-b border-red-100">
              {result.error}
            </div>
          )}
          {result.log.length > 0 && (
            <div className="p-3 bg-slate-900 text-slate-100 font-mono text-xs max-h-72 overflow-y-auto">
              {result.log.map((line, i) => (
                <div key={i} className={
                  line.includes('❌') ? 'text-red-400' :
                  line.includes('✅') ? 'text-green-400' :
                  line.includes('⚠️') ? 'text-yellow-400' :
                  line.startsWith('•') ? 'text-indigo-300' :
                  'text-slate-300'
                }>{line}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info planification */}
      <div className="card p-4 mt-4 bg-slate-50 border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">⏰ Sync automatique nocturne</h3>
        <p className="text-xs text-slate-500 mb-2">
          Pour planifier automatiquement FacturApp → VB6 chaque nuit à 3h00 :
        </p>
        <code className="block bg-slate-800 text-slate-100 text-xs p-3 rounded overflow-x-auto whitespace-pre">{`$action = New-ScheduledTaskAction \`
  -Execute "node.exe" \`
  -Argument "node_modules\\.bin\\tsx prisma\\sync-pg-to-mariadb.ts" \`
  -WorkingDirectory "C:\\serveur\\facturapp"
$trigger = New-ScheduledTaskTrigger -Daily -At "03:00AM"
Register-ScheduledTask -TaskName "FacturApp-SyncMariaDB" \`
  -Action $action -Trigger $trigger \`
  -Principal (New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest)`}</code>
      </div>
    </div>
  )
}
