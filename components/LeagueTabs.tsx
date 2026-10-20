'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isActive, leagueTabs } from '@/lib/nav'
import { useT } from '@/components/i18n/I18nProvider'

/** Onglets d'une ligue, défilables sur téléphone. */
export default function LeagueTabs(props: { leagueId: string; hasPlayoffs: boolean; canManage: boolean }) {
  const pathname = usePathname()
  const t = useT()
  return (
    <nav aria-label={t.nav.leagueTabs} className="-mx-4 px-4 overflow-x-auto">
      <div className="flex gap-1 border-b border-dc-border min-w-max">
        {leagueTabs(props, t).map(({ href, label }) => {
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
