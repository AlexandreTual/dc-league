'use client'

// Sélecteur de langue : interface et cartes, réglées séparément (barre du site, table, page d'un deck).
import { useEffect, useRef, useState } from 'react'
import { Globe } from 'lucide-react'
import { LANGS, type Lang } from '@/lib/i18n/lang'
import { useI18n } from './I18nProvider'

const code = (lang: Lang) => lang.toUpperCase()

/** Largeur de la bulle (`w-64`). */
const MENU_WIDTH = 256

export default function LanguageMenu({ buttonClass }: {
  /** Classe du bouton, pour l'accorder à la barre où il est posé. */
  buttonClass: string
}) {
  const { t, lang, setLang, cardLang, setCardLang } = useI18n()
  const [open, setOpen] = useState(false)
  // La bulle s'ouvre du côté où elle tient : alignée à droite du bouton, sinon à gauche.
  const [align, setAlign] = useState<'left' | 'right'>('right')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const row = (label: string, current: Lang, choose: (l: Lang) => void, testid: string) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-dc-muted">{label}</span>
      <div className="flex gap-1">
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => choose(l)}
            aria-pressed={current === l}
            data-testid={`${testid}-${l}`}
            className={`text-xs px-2.5 py-1.5 rounded-lg border tablet:min-h-11 ${
              current === l ? 'border-dc-gold/60 bg-dc-gold/15 text-dc-gold font-semibold' : 'border-dc-border text-dc-muted hover:text-dc-text'
            }`}
          >
            {t.language.names[l]}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={buttonClass}
        onClick={(e) => {
          setAlign(e.currentTarget.getBoundingClientRect().right >= MENU_WIDTH + 8 ? 'right' : 'left')
          setOpen((o) => !o)
        }}
        aria-label={t.language.title}
        title={t.language.title}
        aria-expanded={open}
        data-testid="language-button"
      >
        <Globe className="w-3.5 h-3.5 shrink-0" />
        <span>{code(lang)}{cardLang !== lang && <span className="text-dc-muted"> · {code(cardLang)}</span>}</span>
      </button>
      {open && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-2 z-[80] w-64 max-w-[calc(100vw-2rem)] bg-dc-surface border border-dc-border rounded-xl shadow-card p-3 space-y-2`}
          data-testid="language-menu"
          role="dialog"
          aria-label={t.language.title}
        >
          <p className="text-xs font-semibold text-dc-gold">{t.language.title}</p>
          {row(t.language.interface, lang, setLang, 'ui-lang')}
          {row(t.language.cards, cardLang, setCardLang, 'card-lang')}
        </div>
      )}
    </div>
  )
}
