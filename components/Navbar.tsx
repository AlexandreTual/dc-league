'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sword, Calendar, BookOpen, Shield, Trophy, Clock, LogIn, Users, BarChart2, Menu, X } from 'lucide-react'
import type { CurrentUser } from '@/lib/auth/types'
import UserMenu from './UserMenu'

const navLinks = [
  { href: '/', label: 'Classement', icon: Sword },
  { href: '/calendar', label: 'Calendrier', icon: Calendar },
  { href: '/playoffs', label: 'Playoffs', icon: Trophy },
  { href: '/stats', label: 'Statistiques', icon: BarChart2 },
  { href: '/history', label: 'Historique', icon: Clock },
  { href: '/rules', label: 'Règles', icon: BookOpen },
]

const lobbyLink = { href: '/salon', label: 'Salon', icon: Users }
const adminLink = { href: '/admin', label: 'Admin', icon: Shield }

const linkClass = (isActive: boolean) =>
  `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
    isActive
      ? 'bg-dc-gold/15 text-dc-gold border border-dc-gold/30'
      : 'text-dc-muted hover:text-dc-text hover:bg-dc-border/50'
  }`

export default function Navbar({ user }: { user: CurrentUser | null }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const links = [...navLinks, ...(user && !user.isBootstrap ? [lobbyLink] : []), ...(user?.isAdmin ? [adminLink] : [])]

  // Le menu du téléphone se referme quand on change de page.
  useEffect(() => setMenuOpen(false), [pathname])

  const renderLinks = () =>
    links.map(({ href, label, icon: Icon }) => (
      <Link key={href} href={href} className={linkClass(pathname === href)} aria-current={pathname === href ? 'page' : undefined}>
        <Icon className="w-4 h-4 shrink-0" />
        <span>{label}</span>
      </Link>
    ))

  return (
    <nav className="sticky top-0 z-50 border-b border-dc-border bg-dc-surface/95 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 min-w-0" aria-label="Commander League, accueil">
            <div className="w-8 h-8 shrink-0 rounded-full bg-dc-gold/20 border border-dc-gold/40 flex items-center justify-center">
              <Sword className="w-4 h-4 text-dc-gold" />
            </div>
            <span className="text-dc-gold font-fantasy font-semibold text-sm md:text-base truncate">
              Commander League
            </span>
          </Link>

          <div className="flex items-center gap-1">
            {/* Liens : en ligne à partir de md, dans un menu repliable en dessous */}
            <div className="hidden md:flex items-center gap-1">{renderLinks()}</div>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="md:hidden p-2 rounded-lg text-dc-muted hover:text-dc-text hover:bg-dc-border/50"
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={menuOpen}
              aria-controls="menu-principal"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="ml-1 pl-1 md:ml-2 md:pl-2 border-l border-dc-border">
              {user ? (
                <UserMenu user={user} />
              ) : (
                <Link
                  href="/connexion"
                  aria-label="Connexion"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-dc-muted hover:text-dc-text hover:bg-dc-border/50 transition-all duration-200"
                >
                  <LogIn className="w-4 h-4 shrink-0" />
                  <span className="hidden md:block">Connexion</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {menuOpen && (
          <div id="menu-principal" className="md:hidden grid grid-cols-2 gap-1 pb-3">
            {renderLinks()}
          </div>
        )}
      </div>
    </nav>
  )
}
