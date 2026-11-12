'use client'

// Langues de l'interface (cookie, lue par le serveur) et des cartes (localStorage), pour tout le site.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UI_LANG_COOKIE, UI_LANG_MAX_AGE, type Lang } from '@/lib/i18n/lang'
import { messages, type Messages } from '@/lib/i18n/messages'
import { LANG_KEY, readLang, saveLang } from '@/lib/cards/lang'

type I18n = {
  lang: Lang
  t: Messages
  setLang: (lang: Lang) => void
  cardLang: Lang
  setCardLang: (lang: Lang) => void
}

const I18nContext = createContext<I18n | null>(null)

/** Langue des cartes choisie au moins une fois sur cet appareil. */
function cardLangChosen(): boolean {
  try {
    return localStorage.getItem(LANG_KEY) !== null
  } catch {
    return false
  }
}

export default function I18nProvider({ lang: initial, children }: { lang: Lang; children: React.ReactNode }) {
  const router = useRouter()
  const [lang, setLangState] = useState<Lang>(initial)
  // Rendu serveur : les cartes suivent l'interface ; la valeur retenue est relue au montage.
  const [cardLang, setCardLangState] = useState<Lang>(initial)

  useEffect(() => setLangState(initial), [initial])
  // `<html lang>` suit la bascule sans rechargement (lecteurs d'écran, messages de `sendJson`).
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  useEffect(() => setCardLangState(readLang(initial)), [initial])

  const setLang = useCallback((next: Lang) => {
    document.cookie = `${UI_LANG_COOKIE}=${next}; path=/; max-age=${UI_LANG_MAX_AGE}; samesite=lax`
    setLangState(next)
    if (!cardLangChosen()) setCardLangState(next)
    // Les composants serveur se rendent de nouveau dans la nouvelle langue, sans recharger la page.
    router.refresh()
  }, [router])

  const setCardLang = useCallback((next: Lang) => {
    setCardLangState(next)
    saveLang(next)
  }, [])

  const value = useMemo(() => ({ lang, t: messages(lang), setLang, cardLang, setCardLang }), [lang, setLang, cardLang, setCardLang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** Hors du fournisseur (ne devrait pas arriver) : français, réglages sans effet. */
const FALLBACK: I18n = { lang: 'fr', t: messages('fr'), setLang: () => {}, cardLang: 'fr', setCardLang: () => {} }

export function useI18n(): I18n {
  return useContext(I18nContext) ?? FALLBACK
}

export function useT(): Messages {
  return useI18n().t
}

export function useCardLang(): [Lang, (lang: Lang) => void] {
  const { cardLang, setCardLang } = useI18n()
  return [cardLang, setCardLang]
}
