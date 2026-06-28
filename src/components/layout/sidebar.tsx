'use client'
// src/components/layout/sidebar.tsx
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

type NavItem = { href: string; label: string; icon: React.ReactNode }
type NavGroup = { label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: 'Principal',
    items: [
      { href: '/', label: 'Tableau de bord', icon: <IconGrid /> },
      { href: '/clients', label: 'Clients', icon: <IconUser /> },
      { href: '/fournisseurs', label: 'Fournisseurs', icon: <IconTruck /> },
      { href: '/produits', label: 'Produits', icon: <IconBox /> },
    ],
  },
  {
    label: 'Facturation',
    items: [
      { href: '/factures', label: 'Factures', icon: <IconDoc /> },
      { href: '/devis', label: 'Devis', icon: <IconDevis /> },
      { href: '/avoirs', label: 'Avoirs', icon: <IconAvoir /> },
      { href: '/paiements', label: 'Paiements', icon: <IconCash /> },
      { href: '/factures-fournisseurs', label: 'Factures fournisseurs', icon: <IconDoc /> },
      { href: '/charges', label: 'Charges', icon: <IconCharge /> },
    ],
  },
  {
    label: 'Comptabilité',
    items: [{ href: '/tva', label: 'TVA', icon: <IconPercent /> }],
  },
  {
    label: 'Administration',
    items: [
      { href: '/parametres', label: 'Paramètres', icon: <IconSettings /> },
      { href: '/parametres/entreprise', label: 'Ma société', icon: <IconBuilding /> },
      { href: '/utilisateurs', label: 'Utilisateurs', icon: <IconUsers /> },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const navContent = (
    <>
      <div className="px-4 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--sidebar-border)' }}>
        <div>
          <div className="font-display text-white text-base font-bold leading-none">FacturApp</div>
          <div className="text-xs mt-1 font-medium tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>ERP v1.0</div>
        </div>
        <button onClick={() => setOpen(false)} className="md:hidden text-white/50 hover:text-white p-1">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l12 12M16 4L4 16"/></svg>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-1">
            <div className="px-4 py-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {group.label}
            </div>
            {group.items.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              return (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm mx-2 rounded-lg transition-all"
                  style={{
                    color: isActive ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                    background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
                    borderLeft: isActive ? '2px solid #818cf8' : '2px solid transparent',
                  }}>
                  <span style={{ opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="px-4 py-3 border-t space-y-2" style={{ borderColor: 'var(--sidebar-border)' }}>
        <UserInfo />
        <button
          onClick={() => signOut({ callbackUrl: '/connexion' })}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition-colors"
          style={{ color: 'rgba(255,255,255,0.4)', background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 8H2M6 4l-4 4 4 4"/><path d="M6 2h6a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6"/>
          </svg>
          Déconnexion
        </button>
        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>© 2026 FacturApp</div>
      </div>
    </>
  )

  return (
    <>
      {/* DESKTOP */}
      <aside className="hidden md:flex w-52 flex-shrink-0 flex-col h-screen sticky top-0" style={{ background: 'var(--sidebar-bg)' }}>
        {navContent}
      </aside>

      {/* MOBILE */}
      <div className="md:hidden">
        <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14"
          style={{ background: 'var(--sidebar-bg)', borderBottom: '1px solid var(--sidebar-border)' }}>
          <div className="font-display text-white text-base font-bold">FacturApp</div>
          <button onClick={() => setOpen(true)} className="text-white/70 hover:text-white p-1">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h16M3 11h16M3 16h16"/>
            </svg>
          </button>
        </div>
        {open && <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />}
        <aside className="fixed top-0 left-0 z-50 h-full w-64 flex flex-col transition-transform duration-300"
          style={{ background: 'var(--sidebar-bg)', transform: open ? 'translateX(0)' : 'translateX(-100%)' }}>
          {navContent}
        </aside>
      </div>
    </>
  )
}

function UserInfo() {
  const { data: session } = useSession()
  if (!session?.user) return null
  return (
    <div className="flex items-center gap-2 px-1">
      <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
        {session.user.name?.charAt(0).toUpperCase() ?? 'U'}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-white/80 truncate">{session.user.name}</div>
        <div className="text-xs text-white/30 truncate">{session.user.email}</div>
      </div>
    </div>
  )
}


function IconGrid() { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg> }
function IconUser() { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5"/></svg> }
function IconTruck() { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="4" width="10" height="8" rx="1"/><path d="M11 6h2l2 3v3h-4V6z"/><circle cx="4" cy="13" r="1.2"/><circle cx="12" cy="13" r="1.2"/></svg> }
function IconBox() { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1L15 4.5V11.5L8 15L1 11.5V4.5L8 1z"/><path d="M8 1v14M1 4.5l7 3.5 7-3.5"/></svg> }
function IconDevis() { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/><path d="M5 5h6M5 8h6M5 11h6"/><circle cx="12" cy="12" r="3" fill="white" stroke="currentColor"/><path d="M11 12h2M12 11v2"/></svg> }
function IconAvoir() { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/><path d="M5 5h6M5 8h4M10 11l-2 2-2-2"/></svg> }
function IconDoc() { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/><path d="M5 5h6M5 8h6M5 11h3"/></svg> }
function IconCash() { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="4" width="14" height="9" rx="1"/><circle cx="8" cy="8.5" r="2"/></svg> }
function IconCharge() { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1v5l3-3"/><path d="M8 6L5 3"/><path d="M3 8H1l2 7h10l2-7h-2"/></svg> }
function IconPercent() { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 4L4 12"/><circle cx="5" cy="5" r="2"/><circle cx="11" cy="11" r="2"/></svg> }
function IconSettings() { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M2.9 13.1l1.4-1.4M11.7 4.3l1.4-1.4"/></svg> }
function IconBuilding() { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="3" width="14" height="12" rx="1"/><path d="M5 15V9h6v6"/><path d="M1 7h14"/></svg> }
function IconUsers() { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="5" r="2.5"/><path d="M1 14c0-2.5 2.2-4 5-4s5 1.5 5 4"/><path d="M11 7c1.5 0 2.5 1 2.5 2.5"/><path d="M13 14c0-1.5-1-2.5-2.5-2.5"/></svg> }
