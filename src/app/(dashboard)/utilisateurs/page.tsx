// src/app/(dashboard)/utilisateurs/page.tsx
export const dynamic = 'force-dynamic'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'

export default async function UtilisateursPage() {
  const [utilisateurs, roles] = await Promise.all([
    prisma.utilisateur.findMany({
      include: { role: true },
      orderBy: { id: 'asc' },
    }),
    prisma.role.findMany({ orderBy: { id: 'asc' } }),
  ])

  return (
    <div className="p-4 md:p-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Utilisateurs</h1>
          <p className="text-sm text-slate-400 mt-0.5">{utilisateurs.length} utilisateur(s)</p>
        </div>
        <Link href="/utilisateurs/nouveau" className="btn-primary text-sm">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 1v14M1 8h14"/></svg>
          <span className="hidden sm:inline">Nouvel utilisateur</span>
          <span className="sm:hidden">Nouveau</span>
        </Link>
      </div>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th><th>Nom</th><th>Email</th><th>Rôle</th><th>Statut</th><th></th>
            </tr>
          </thead>
          <tbody>
            {utilisateurs.map(u => (
              <tr key={u.id}>
                <td className="text-slate-400 text-xs">{u.id}</td>
                <td className="font-medium text-slate-800">{u.nom}</td>
                <td className="text-slate-500">{u.email}</td>
                <td>
                  <span className={`badge ${u.role.code === 'admin' ? 'badge-danger' : u.role.code === 'saisie' ? 'badge-info' : 'badge-neutral'}`}>
                    {u.role.nom}
                  </span>
                </td>
                <td>
                  {u.actif
                    ? <span className="badge badge-success">Actif</span>
                    : <span className="badge badge-neutral">Inactif</span>}
                </td>
                <td>
                  <div className="flex gap-2 justify-end">
                    <Link href={`/utilisateurs/${u.id}/modifier`} className="btn-ghost btn-sm">
                      Modifier
                    </Link>
                    <Link href={`/utilisateurs/${u.id}/mot-de-passe`} className="btn-ghost btn-sm text-amber-500">
                      Mot de passe
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info rôles */}
      <div className="mt-6 card p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3 font-display">Rôles disponibles</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-red-50 rounded-lg border border-red-100">
            <div className="font-medium text-red-700 text-sm">Administrateur</div>
            <div className="text-xs text-red-500 mt-1">Accès complet à toutes les fonctionnalités</div>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
            <div className="font-medium text-indigo-700 text-sm">Saisie</div>
            <div className="text-xs text-indigo-500 mt-1">Peut créer et modifier les données</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="font-medium text-slate-700 text-sm">Consultation</div>
            <div className="text-xs text-slate-500 mt-1">Lecture seule, aucune modification</div>
          </div>
        </div>
      </div>
    </div>
  )
}
