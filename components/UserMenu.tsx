'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, Layers, LogOut, User } from 'lucide-react'
import type { CurrentUser } from '@/lib/auth/types'

export default function UserMenu({ user }: { user: CurrentUser }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setOpen(false)
    router.push('/')
    router.refresh()
  }

  const itemClass = 'flex items-center gap-2 w-full px-3 py-2 text-sm text-dc-muted hover:text-dc-text hover:bg-dc-border/50 rounded-lg'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-dc-border/50 transition-colors"
        aria-expanded={open}
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-dc-gold/40" />
        ) : (
          <span className="w-7 h-7 rounded-full bg-dc-gold/20 border border-dc-gold/40 flex items-center justify-center text-dc-gold text-xs font-semibold">
            {user.playerName.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="hidden md:block text-sm text-dc-text max-w-[8rem] truncate">{user.playerName}</span>
        <ChevronDown className="w-3 h-3 text-dc-muted" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-dc-surface border border-dc-border rounded-xl shadow-card p-1 z-50">
          {!user.isBootstrap && (
            <>
              <Link href="/profil" className={itemClass} onClick={() => setOpen(false)}>
                <User className="w-4 h-4" /> Mon profil
              </Link>
              <Link href="/profil/decks" className={itemClass} onClick={() => setOpen(false)}>
                <Layers className="w-4 h-4" /> Mes decks
              </Link>
            </>
          )}
          <button onClick={logout} className={itemClass}>
            <LogOut className="w-4 h-4" /> Déconnexion
          </button>
        </div>
      )}
    </div>
  )
}
