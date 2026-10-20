'use client'

import Link from 'next/link'
import { useT } from '@/components/i18n/I18nProvider'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT().site.error
  return (
    <div role="alert" className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center">
      <h1 className="font-fantasy text-3xl font-bold text-dc-gold">{t.title}</h1>
      <p className="text-dc-muted text-sm">{t.page}</p>
      <div className="flex items-center gap-4">
        <button
          onClick={reset}
          className="bg-dc-gold/20 hover:bg-dc-gold/30 border border-dc-gold/40 text-dc-gold text-sm font-semibold px-4 py-2 rounded-xl transition-all"
        >
          {t.retry}
        </button>
        <Link href="/" className="text-dc-gold text-sm hover:underline">{t.home}</Link>
      </div>
    </div>
  )
}
