'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sword, Calendar, BookOpen, Shield, Trophy, Clock } from 'lucide-react'

const navLinks = [
  { href: '/', label: 'Classement', icon: Sword },
  { href: '/calendar', label: 'Calendrier', icon: Calendar },
  { href: '/playoffs', label: 'Playoffs', icon: Trophy },
  { href: '/history', label: 'Historique', icon: Clock },
  { href: '/rules', label: 'Règles', icon: BookOpen },
  { href: '/admin', label: 'Admin', icon: Shield },
]

export default function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 border-b border-dc-border bg-dc-surface/95 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-dc-gold/20 border border-dc-gold/40 flex items-center justify-center">
              <Sword className="w-4 h-4 text-dc-gold" />
            </div>
            <span className="text-dc-gold font-fantasy font-semibold text-sm md:text-base hidden sm:block">
              Commander League
            </span>
          </Link>

          {/* Links */}
          <div className="flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-dc-gold/15 text-dc-gold border border-dc-gold/30'
                      : 'text-dc-muted hover:text-dc-text hover:bg-dc-border/50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="hidden md:block">{label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
