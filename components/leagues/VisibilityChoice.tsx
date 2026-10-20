'use client'

import { Globe, Lock } from 'lucide-react'
import type { LeagueVisibility } from '@/lib/db-leagues'
import { useT } from '@/components/i18n/I18nProvider'

/** Choix publique / privée, en deux grandes cases faciles à toucher. */
export default function VisibilityChoice({ value, onChange }: { value: LeagueVisibility; onChange: (v: LeagueVisibility) => void }) {
  const t = useT().leagues.visibility
  const options: { value: LeagueVisibility; label: string; text: string; Icon: typeof Globe }[] = [
    { value: 'public', label: t.public, text: t.publicText, Icon: Globe },
    { value: 'private', label: t.private, text: t.privateText, Icon: Lock },
  ]
  return (
    <fieldset className="space-y-2">
      <legend className="block text-dc-muted text-xs mb-1.5">{t.legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map(({ value: v, label, text, Icon }) => (
          <label
            key={v}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
              value === v ? 'border-dc-gold/60 bg-dc-gold/10' : 'border-dc-border hover:border-dc-gold/30'
            }`}
          >
            <input type="radio" name="visibility" value={v} checked={value === v} onChange={() => onChange(v)} className="mt-1 accent-dc-gold" />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-dc-text"><Icon className="w-4 h-4 text-dc-gold" /> {label}</span>
              <span className="block text-xs text-dc-muted">{text}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
