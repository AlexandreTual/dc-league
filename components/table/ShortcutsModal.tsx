'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { bind, comboOf, DEFAULT_BINDINGS, isReserved, keyLabel, SHORTCUTS, type Bindings, type Shortcut } from '@/lib/game/keyboard'

const GROUPS = [
  { group: 'table', title: 'Table' },
  { group: 'card', title: 'Carte survolée (sous la souris)' },
] as const

const labelOf = (id: Shortcut) => SHORTCUTS.find((s) => s.id === id)?.label ?? id

/** Fenêtre « Raccourcis clavier » : la liste, et « Changer » pour choisir une autre touche (mémorisé sur l'appareil). */
export default function ShortcutsModal({ bindings, onChange, onClose }: {
  bindings: Bindings
  onChange: (bindings: Bindings) => void
  onClose: () => void
}) {
  const [editing, setEditing] = useState<Shortcut | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Touche suivante : prise avant la table (phase de capture), qui ne la voit pas. Échap annule.
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') return setEditing(null)
      const combo = comboOf(e)
      if (!combo) return
      if (isReserved(combo)) return setNotice(`${keyLabel(combo)} est réservée : choisissez une autre touche.`)
      const { bindings: next, replaced } = bind(bindings, editing, combo)
      onChange(next)
      setNotice(replaced ? `${keyLabel(combo)} servait à « ${labelOf(replaced)} », qui n'a plus de raccourci.` : null)
      setEditing(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [editing, bindings, onChange])

  const button = 'text-xs px-2 py-1 rounded border border-dc-border text-dc-text hover:border-dc-gold/50 disabled:opacity-40'
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-dc-border bg-dc-surface p-4 space-y-3 shadow-card"
        role="dialog" aria-label="Raccourcis clavier" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center">
          <h2 className="font-fantasy text-dc-gold">Raccourcis clavier</h2>
          <button onClick={onClose} className="ml-auto text-dc-muted hover:text-dc-text" aria-label="Fermer les raccourcis"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-dc-muted">
          Les raccourcis de carte agissent sur la carte sous la souris, comme son menu clic droit. Échap ferme les fenêtres.
        </p>
        {notice && <p className="text-xs text-dc-gold" role="status">{notice}</p>}
        {GROUPS.map(({ group, title }) => (
          <section key={group} className="space-y-1">
            <h3 className="text-sm text-dc-text font-semibold">{title}</h3>
            {SHORTCUTS.filter((s) => s.group === group).map((s) => {
              const combo = bindings[s.id]
              return (
                <div key={s.id} className="flex items-center gap-2 text-sm text-dc-text" data-shortcut={s.id}>
                  <span className="flex-1">{s.label}</span>
                  {editing === s.id
                    ? <kbd className="px-2 py-0.5 rounded border border-dc-gold text-dc-gold text-xs animate-pulse">Appuyez sur une touche…</kbd>
                    : <kbd className="min-w-[2.5rem] text-center px-2 py-0.5 rounded border border-dc-border bg-dc-bg text-xs">{combo ? keyLabel(combo) : '—'}</kbd>}
                  <button className={button} onClick={() => { setNotice(null); setEditing(editing === s.id ? null : s.id) }}>
                    {editing === s.id ? 'Annuler' : 'Changer'}
                  </button>
                  <button className={button} disabled={!combo} aria-label={`Retirer le raccourci « ${s.label} »`}
                    onClick={() => { setEditing(null); onChange(bind(bindings, s.id, null).bindings) }}>
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </section>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <p className="text-xs text-dc-muted">Mémorisé sur cet appareil.</p>
          <button className={`${button} ml-auto`} onClick={() => { setEditing(null); setNotice(null); onChange({ ...DEFAULT_BINDINGS }) }}>
            Touches par défaut
          </button>
        </div>
      </div>
    </div>
  )
}
