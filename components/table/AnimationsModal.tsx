'use client'

import { X } from 'lucide-react'
import { ALL_EFFECTS, CARD_EFFECTS, NO_EFFECTS, type CardEffects } from '@/lib/table-settings'

/** Fenêtre « Animations » : chaque animation des cartes en jeu activée ou non (mémorisé sur l'appareil). */
export default function AnimationsModal({ effects, onChange, onClose }: {
  effects: CardEffects
  onChange: (effects: CardEffects) => void
  onClose: () => void
}) {
  const button = 'text-xs px-2 py-1 rounded border border-dc-border text-dc-text hover:border-dc-gold/50 disabled:opacity-40'
  const all = CARD_EFFECTS.every((e) => effects[e.id])
  const none = CARD_EFFECTS.every((e) => !effects[e.id])
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-xl border border-dc-border bg-dc-surface p-4 space-y-3 shadow-card"
        role="dialog" aria-label="Animations" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center">
          <h2 className="font-fantasy text-dc-gold">Animations</h2>
          <button onClick={onClose} className="ml-auto text-dc-muted hover:text-dc-text" aria-label="Fermer les animations"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-dc-muted">Animations des cartes sur le champ de bataille.</p>
        {CARD_EFFECTS.map((e) => (
          <label key={e.id} className="flex items-start gap-2 text-sm text-dc-text" data-effect={e.id}>
            <input type="checkbox" className="mt-1" checked={effects[e.id]} onChange={(ev) => onChange({ ...effects, [e.id]: ev.target.checked })} />
            <span>
              {e.label}
              <span className="block text-xs text-dc-muted">{e.hint}</span>
            </span>
          </label>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <p className="text-xs text-dc-muted">Mémorisé sur cet appareil.</p>
          <button className={`${button} ml-auto`} disabled={all} onClick={() => onChange({ ...ALL_EFFECTS })}>Tout activer</button>
          <button className={button} disabled={none} onClick={() => onChange({ ...NO_EFFECTS })}>Tout couper</button>
        </div>
      </div>
    </div>
  )
}
