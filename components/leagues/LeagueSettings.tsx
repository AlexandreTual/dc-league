'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import type { DbLeague, LeagueVisibility } from '@/lib/db-leagues'
import { inputClass, labelClass } from '@/components/formStyles'
import type { AdminApi } from '@/components/admin/useAdminApi'
import VisibilityChoice from './VisibilityChoice'
import { useT } from '@/components/i18n/I18nProvider'

/** Nom et visibilité de la ligue. */
export default function LeagueSettings({ league, api }: { league: DbLeague; api: AdminApi }) {
  const router = useRouter()
  const t = useT().leagues.settings
  const { call, showToast } = api
  const [name, setName] = useState(league.name)
  const [visibility, setVisibility] = useState<LeagueVisibility>(league.visibility)
  const [saving, setSaving] = useState(false)
  const changed = name.trim() !== league.name || visibility !== league.visibility

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { ok } = await call<DbLeague>(`/api/leagues/${league.id}`, 'PATCH', { name: name.trim(), visibility })
      if (!ok) return
      showToast(t.updated)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="bg-dc-surface border border-dc-border rounded-2xl p-5 space-y-4" aria-label={t.aria}>
      <div>
        <label htmlFor="league-name" className={labelClass}>{t.name}</label>
        <input id="league-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </div>
      <VisibilityChoice value={visibility} onChange={setVisibility} />
      <button
        type="submit"
        disabled={!changed || !name.trim() || saving}
        className="inline-flex items-center gap-1.5 bg-dc-gold/20 hover:bg-dc-gold/30 border border-dc-gold/40 text-dc-gold px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
      >
        <Save className="w-4 h-4" /> {saving ? t.saving : t.save}
      </button>
    </form>
  )
}
