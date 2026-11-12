'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { sendJson } from '@/components/formStyles'
import type { AiAdminStatus } from '@/lib/ai/admin'
import { AI_DAILY_QUOTA } from '@/lib/ai/limits'
import { useT } from '@/components/i18n/I18nProvider'

/** Section « Assistant IA » du tableau de bord : interrupteur et utilisation du jour. */
export default function AiSettingsPanel({ initial, onToast }: { initial: AiAdminStatus; onToast: (msg: string) => void }) {
  const [status, setStatus] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const t = useT().admin.ai

  async function toggle() {
    setSaving(true)
    setError('')
    const { data, error } = await sendJson('/api/admin/ai', 'PATCH', { enabled: !status.enabled })
    setSaving(false)
    if (error) return setError(error)
    const next = data as AiAdminStatus
    setStatus(next)
    onToast(next.enabled ? t.enabled : t.disabled)
  }

  const state = !status.keyPresent ? t.noKey : status.enabled ? t.stateOn : t.stateOff
  const stateClass = status.keyPresent && status.enabled ? 'text-dc-green-light' : 'text-dc-red-light'

  return (
    <section className="space-y-3" aria-labelledby="assistant-ia" data-testid="ai-admin">
      <h2 id="assistant-ia" className="font-fantasy font-bold text-dc-text flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-dc-gold" /> {t.title}
      </h2>
      <div className="bg-dc-surface border border-dc-border rounded-2xl p-4 space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1 min-w-0">
            {t.state}<span className={`font-semibold ${stateClass}`} data-testid="ai-admin-state">{state}</span>
          </p>
          <button
            onClick={toggle}
            disabled={saving}
            aria-pressed={status.enabled}
            className="px-4 py-2 rounded-xl border border-dc-gold/40 text-dc-gold hover:bg-dc-gold/10 disabled:opacity-50"
          >
            {status.enabled ? t.turnOff : t.turnOn}
          </button>
        </div>
        {!status.keyPresent && (
          <p className="text-dc-muted text-xs">
            {t.keyMissingBefore}<code>GEMINI_API_KEY</code>{t.keyMissingMiddle}<code>docs/assistant-ia.md</code>{t.keyMissingAfter}
          </p>
        )}
        <p className="text-dc-muted" data-testid="ai-admin-usage">
          {t.usage(status.today.questions, status.today.players, AI_DAILY_QUOTA)}
        </p>
        {error && <p className="text-dc-red-light">{error}</p>}
      </div>
    </section>
  )
}
