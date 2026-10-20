'use client'

import './globals.css'
import { useEffect, useState } from 'react'
import { DEFAULT_LANG, pickLang, UI_LANG_COOKIE, type Lang } from '@/lib/i18n/lang'
import { messages } from '@/lib/i18n/messages'

/** Langue de l'interface sans le fournisseur (la mise en page racine a planté) : cookie, sinon navigateur. */
function browserLang(): Lang {
  const cookie = document.cookie.split('; ').find((c) => c.startsWith(`${UI_LANG_COOKIE}=`))?.split('=')[1]
  return pickLang(cookie, navigator.languages?.join(',') || navigator.language)
}

// Remplace la mise en page racine quand celle-ci plante : elle doit fournir <html> et <body>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG)
  useEffect(() => setLang(browserLang()), [])
  const t = messages(lang).site.error
  return (
    <html lang={lang} className="dark">
      <body className="min-h-screen bg-dc-bg text-dc-text antialiased">
        <main role="alert" className="max-w-5xl mx-auto px-4 py-16 flex flex-col items-center gap-4 text-center">
          <h1 className="font-fantasy text-3xl font-bold text-dc-gold">{t.title}</h1>
          <p className="text-dc-muted text-sm">{t.site}</p>
          <div className="flex items-center gap-4">
            <button
              onClick={reset}
              className="bg-dc-gold/20 hover:bg-dc-gold/30 border border-dc-gold/40 text-dc-gold text-sm font-semibold px-4 py-2 rounded-xl transition-all"
            >
              {t.retry}
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- la mise en page racine a planté : rechargement complet voulu */}
            <a href="/" className="text-dc-gold text-sm hover:underline">{t.home}</a>
          </div>
        </main>
      </body>
    </html>
  )
}
