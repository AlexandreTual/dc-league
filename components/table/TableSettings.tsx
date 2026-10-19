'use client'

import { X } from 'lucide-react'
import { CARD_SCALES, GRAVEYARD_ARTS, type TableSettings } from '@/lib/table-settings'

const ART_LABELS = ['Petite', 'Moyenne', 'Grande', 'Très grande']

/** Couleur proposée par le sélecteur quand le fond par défaut est utilisé (proche du fond actuel). */
const DEFAULT_PICKER = '#0e0e14'

/** Panneau « Réglages » ouvert depuis la barre de la table. */
export default function TableSettingsPanel({ settings, onChange, onClose, onShortcuts }: {
  settings: TableSettings
  onChange: (settings: TableSettings) => void
  onClose: () => void
  /** Ouvre la fenêtre « Raccourcis clavier ». */
  onShortcuts: () => void
}) {
  return (
    <>
      <div className="absolute inset-0 z-[56]" onClick={onClose} />
      <div className="absolute right-3 top-12 z-[57] w-72 max-w-[calc(100%-1.5rem)] rounded-xl border border-dc-border bg-dc-surface p-4 space-y-3 shadow-card" role="dialog" aria-label="Réglages de la table">
        <div className="flex items-center">
          <h2 className="font-fantasy text-dc-gold text-sm">Réglages de la table</h2>
          <button onClick={onClose} className="ml-auto text-dc-muted hover:text-dc-text" aria-label="Fermer les réglages"><X className="w-4 h-4" /></button>
        </div>
        <label className="flex items-center gap-2 text-sm text-dc-text">
          <input type="checkbox" checked={settings.grid} onChange={(e) => onChange({ ...settings, grid: e.target.checked })} />
          Quadrillage sur le champ de bataille
        </label>
        <div className="flex items-center gap-2 text-sm text-dc-text">
          <label className="flex items-center gap-2">
            <input
              type="color"
              className="h-7 w-10 cursor-pointer rounded border border-dc-border bg-transparent"
              value={settings.background ?? DEFAULT_PICKER}
              onChange={(e) => onChange({ ...settings, background: e.target.value })}
              aria-label="Couleur du fond"
            />
            Couleur du fond
          </label>
          <button
            className="ml-auto text-xs px-2 py-1 rounded border border-dc-border text-dc-text hover:border-dc-gold/50 disabled:opacity-40"
            disabled={settings.background === null}
            onClick={() => onChange({ ...settings, background: null })}
          >
            Par défaut
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-dc-text">
          Taille des cartes
          <select className="ml-auto bg-dc-bg border border-dc-border rounded px-2 py-1 text-sm" value={settings.cardScale}
            onChange={(e) => onChange({ ...settings, cardScale: Number(e.target.value) })} aria-label="Taille des cartes">
            {CARD_SCALES.map((s) => <option key={s} value={s}>{Math.round(s * 100)} %</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-dc-text">
          <input type="checkbox" checked={!settings.pilesBesideHand} onChange={(e) => onChange({ ...settings, pilesBesideHand: !e.target.checked })} />
          Piles dans la colonne (ancienne disposition)
        </label>
        {settings.pilesBesideHand && (
          <label className="flex items-center gap-2 text-sm text-dc-text">
            Image du cimetière
            <select className="ml-auto bg-dc-bg border border-dc-border rounded px-2 py-1 text-sm" value={settings.graveyardArt}
              onChange={(e) => onChange({ ...settings, graveyardArt: Number(e.target.value) })} aria-label="Image du cimetière">
              {GRAVEYARD_ARTS.map((h, i) => <option key={h} value={h}>{ART_LABELS[i]}</option>)}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-dc-text">
          <input type="checkbox" checked={settings.cardEffects} onChange={(e) => onChange({ ...settings, cardEffects: e.target.checked })} />
          Animations des cartes
        </label>
        <label className="flex items-center gap-2 text-sm text-dc-text">
          Capacités sur les cartes
          <select className="ml-auto bg-dc-bg border border-dc-border rounded px-2 py-1 text-sm" value={settings.abilityStyle}
            onChange={(e) => onChange({ ...settings, abilityStyle: e.target.value === 'labels' ? 'labels' : 'icons' })} aria-label="Capacités sur les cartes">
            <option value="icons">Symboles</option>
            <option value="labels">Libellés</option>
          </select>
        </label>
        <button className="w-full text-left text-sm px-2 py-1 rounded border border-dc-border text-dc-text hover:border-dc-gold/50" onClick={onShortcuts}>
          Raccourcis clavier…
        </button>
        <p className="text-xs text-dc-muted">Mémorisé sur cet appareil.</p>
      </div>
    </>
  )
}
