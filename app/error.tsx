'use client'

import Link from 'next/link'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center">
      <h1 className="font-fantasy text-3xl font-bold text-dc-gold">Une erreur est survenue</h1>
      <p className="text-dc-muted text-sm">La page n&apos;a pas pu s&apos;afficher. Réessaie dans un instant.</p>
      <div className="flex items-center gap-4">
        <button
          onClick={reset}
          className="bg-dc-gold/20 hover:bg-dc-gold/30 border border-dc-gold/40 text-dc-gold text-sm font-semibold px-4 py-2 rounded-xl transition-all"
        >
          Réessayer
        </button>
        <Link href="/" className="text-dc-gold text-sm hover:underline">Retour au classement</Link>
      </div>
    </div>
  )
}
