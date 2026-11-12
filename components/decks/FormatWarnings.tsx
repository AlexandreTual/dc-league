'use client'

import { AlertTriangle } from 'lucide-react'
import { useT } from '@/components/i18n/I18nProvider'

/** Bandeau non bloquant : écarts au format Commander (#239). Rien si la liste est vide ou absente. */
export default function FormatWarnings({ items }: { items: string[] | undefined }) {
  const t = useT()
  if (!items?.length) return null
  return (
    <div className="flex gap-2 rounded-xl border border-dc-gold/40 bg-dc-gold/10 px-3 py-2 text-sm text-dc-text" role="note" data-testid="deck-warnings">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-dc-gold" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold text-dc-gold">{t.decks.warnings.title}</p>
        <ul className="space-y-0.5 break-words">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
    </div>
  )
}
