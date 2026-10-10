'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isActive, leagueTabs } from '@/lib/nav'

/** Onglets des pages de la ligue, défilables sur téléphone. */
export default function LeagueTabs({ hasPlayoffs }: { hasPlayoffs: boolean }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Pages de la ligue" className="-mx-4 px-4 overflow-x-auto">
      <div className="flex gap-1 border-b border-dc-border min-w-max">
        {leagueTabs({ hasPlayoffs }).map(({ href, label }) => {
          const active = isActive(href, pathname, 'tab')
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`px-3 py-2 -mb-px text-sm border-b-2 transition-colors ${
                active ? 'border-dc-gold text-dc-gold' : 'border-transparent text-dc-muted hover:text-dc-text'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
