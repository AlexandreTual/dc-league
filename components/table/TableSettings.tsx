'use client'

import { X } from 'lucide-react'
import { CARD_SCALES, GRAVEYARD_ARTS, type TableSettings } from '@/lib/table-settings'
import { useT } from '@/components/i18n/I18nProvider'

/** Couleur proposée par le sélecteur quand le fond par défaut est utilisé (proche du fond actuel). */
const DEFAULT_PICKER = '#0e0e14'

/** Panneau « Réglages » ouvert depuis la barre de la table. */
export default function TableSettingsPanel({ settings, onChange, onClose, onShortcuts, onAnimations }: {
  settings: TableSettings
  onChange: (settings: TableSettings) => void
  onClose: () => void
  /** Ouvre la fenêtre « Raccourcis clavier ». */
  onShortcuts: () => void
  /** Ouvre la fenêtre « Animations ». */
  onAnimations: () => void
}) {
  const r = useT().table.settings
  return (
    <>
      <div className="absolute inset-0 z-[56]" onClick={onClose} />
      <div className="absolute right-3 top-12 z-[57] w-72 max-w-[calc(100%-1.5rem)] rounded-xl border border-dc-border bg-dc-surface p-4 space-y-3 shadow-card" role="dialog" aria-label={r.title}>
        <div className="flex items-center">
          <h2 className="font-fantasy text-dc-gold text-sm">{r.title}</h2>
          <button onClick={onClose} className="ml-auto text-dc-muted hover:text-dc-text" aria-label={r.close}><X className="w-4 h-4" /></button>
        </div>
        <label className="flex items-center gap-2 text-sm text-dc-text">
          <input type="checkbox" checked={settings.grid} onChange={(e) => onChange({ ...settings, grid: e.target.checked })} />
          {r.grid}
        </label>
        <div className="flex items-center gap-2 text-sm text-dc-text">
          <label className="flex items-center gap-2">
            <input
              type="color"
              className="h-7 w-10 cursor-pointer rounded border border-dc-border bg-transparent"
              value={settings.background ?? DEFAULT_PICKER}
              onChange={(e) => onChange({ ...settings, background: e.target.value })}
              aria-label={r.background}
            />
            {r.background}
          </label>
          <button
            className="ml-auto text-xs px-2 py-1 rounded border border-dc-border text-dc-text hover:border-dc-gold/50 disabled:opacity-40"
            disabled={settings.background === null}
            onClick={() => onChange({ ...settings, background: null })}
          >
            {r.defaultBackground}
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-dc-text">
          {r.cardSize}
          <select className="ml-auto bg-dc-bg border border-dc-border rounded px-2 py-1 text-sm" value={settings.cardScale}
            onChange={(e) => onChange({ ...settings, cardScale: Number(e.target.value) })} aria-label={r.cardSize}>
            {CARD_SCALES.map((s) => <option key={s} value={s}>{Math.round(s * 100)} %</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-dc-text">
          <input type="checkbox" checked={!settings.pilesBesideHand} onChange={(e) => onChange({ ...settings, pilesBesideHand: !e.target.checked })} />
          {r.pilesInColumn}
        </label>
        {settings.pilesBesideHand && (
          <label className="flex items-center gap-2 text-sm text-dc-text">
            {r.graveyardArt}
            <select className="ml-auto bg-dc-bg border border-dc-border rounded px-2 py-1 text-sm" value={settings.graveyardArt}
              onChange={(e) => onChange({ ...settings, graveyardArt: Number(e.target.value) })} aria-label={r.graveyardArt}>
              {GRAVEYARD_ARTS.map((h, i) => <option key={h} value={h}>{r.artSizes[i]}</option>)}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-dc-text">
          {r.abilityStyle}
          <select className="ml-auto bg-dc-bg border border-dc-border rounded px-2 py-1 text-sm" value={settings.abilityStyle}
            onChange={(e) => onChange({ ...settings, abilityStyle: e.target.value === 'labels' ? 'labels' : 'icons' })} aria-label={r.abilityStyle}>
            <option value="icons">{r.icons}</option>
            <option value="labels">{r.labels}</option>
          </select>
        </label>
        <button className="w-full text-left text-sm px-2 py-1 rounded border border-dc-border text-dc-text hover:border-dc-gold/50" onClick={onAnimations}>
          {r.animations}
        </button>
        <button className="w-full text-left text-sm px-2 py-1 rounded border border-dc-border text-dc-text hover:border-dc-gold/50" onClick={onShortcuts}>
          {r.shortcuts}
        </button>
        <p className="text-xs text-dc-muted">{r.remembered}</p>
      </div>
    </>
  )
}
