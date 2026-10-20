'use client'

import { X } from 'lucide-react'
import { ALL_EFFECTS, CARD_EFFECTS, NO_EFFECTS, type CardEffects } from '@/lib/table-settings'
import { useT } from '@/components/i18n/I18nProvider'

const GROUPS = ['cards', 'players'] as const

/** Fenêtre « Animations » : chaque animation (cartes en jeu, joueurs et partie) activée ou non (mémorisé sur l'appareil). */
export default function AnimationsModal({ effects, onChange, onClose }: {
  effects: CardEffects
  onChange: (effects: CardEffects) => void
  onClose: () => void
}) {
  const t = useT().table
  const a = t.animations
  const button = 'text-xs px-2 py-1 rounded border border-dc-border text-dc-text hover:border-dc-gold/50 disabled:opacity-40'
  const all = CARD_EFFECTS.every((e) => effects[e.id])
  const none = CARD_EFFECTS.every((e) => !effects[e.id])
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-xl border border-dc-border bg-dc-surface p-4 space-y-3 shadow-card"
        role="dialog" aria-label={a.title} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center">
          <h2 className="font-fantasy text-dc-gold">{a.title}</h2>
          <button onClick={onClose} className="ml-auto text-dc-muted hover:text-dc-text" aria-label={a.close}><X className="w-4 h-4" /></button>
        </div>
        {GROUPS.map((group) => (
          <section key={group} className="space-y-2" data-effect-group={group}>
            <h3 className="text-xs uppercase tracking-wide text-dc-muted">{a.groups[group]}</h3>
            {CARD_EFFECTS.filter((e) => e.group === group).map((e) => (
              <label key={e.id} className="flex items-start gap-2 text-sm text-dc-text" data-effect={e.id}>
                <input type="checkbox" className="mt-1" checked={effects[e.id]} onChange={(ev) => onChange({ ...effects, [e.id]: ev.target.checked })} />
                <span>
                  {a.effects[e.id].label}
                  <span className="block text-xs text-dc-muted">{a.effects[e.id].hint}</span>
                </span>
              </label>
            ))}
          </section>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <p className="text-xs text-dc-muted">{t.settings.remembered}</p>
          <button className={`${button} ml-auto`} disabled={all} onClick={() => onChange({ ...ALL_EFFECTS })}>{a.allOn}</button>
          <button className={button} disabled={none} onClick={() => onChange({ ...NO_EFFECTS })}>{a.allOff}</button>
        </div>
      </div>
    </div>
  )
}
