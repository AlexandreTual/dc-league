import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import { getCurrentUser } from '@/lib/auth/session'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/page-titles'

export const runtime = 'edge'

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Aperçu d'un lien partagé (WhatsApp, Discord…) : nom du site et titre de la page, sans donnée d'une ligue privée.
  openGraph: { siteName: SITE_NAME, description: SITE_DESCRIPTION, locale: 'fr_FR', type: 'website' },
  // « Ajouter à l'écran d'accueil » : nom court, couleurs et icône (public/manifest.webmanifest).
  manifest: '/manifest.webmanifest',
  // Fichiers dans public/ : next-on-pages refuse app/icon.svg (il en ferait une route non edge).
  icons: {
    icon: { url: '/icon.svg', type: 'image/svg+xml' },
    apple: { url: '/apple-icon.png', sizes: '180x180' },
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getCurrentUser()

  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen bg-dc-bg text-dc-text antialiased">
        <Navbar user={user} />
        <main className="max-w-5xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
