'use client'

import './globals.css'

// Remplace la mise en page racine quand celle-ci plante : elle doit fournir <html> et <body>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen bg-dc-bg text-dc-text antialiased">
        <main role="alert" className="max-w-5xl mx-auto px-4 py-16 flex flex-col items-center gap-4 text-center">
          <h1 className="font-fantasy text-3xl font-bold text-dc-gold">Une erreur est survenue</h1>
          <p className="text-dc-muted text-sm">Le site n&apos;a pas pu s&apos;afficher. Réessaie dans un instant.</p>
          <div className="flex items-center gap-4">
            <button
              onClick={reset}
              className="bg-dc-gold/20 hover:bg-dc-gold/30 border border-dc-gold/40 text-dc-gold text-sm font-semibold px-4 py-2 rounded-xl transition-all"
            >
              Réessayer
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- la mise en page racine a planté : rechargement complet voulu */}
            <a href="/" className="text-dc-gold text-sm hover:underline">Retour au classement</a>
          </div>
        </main>
      </body>
    </html>
  )
}
