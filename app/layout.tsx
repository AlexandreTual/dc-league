import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import { getCurrentUser } from '@/lib/auth/session'

export const runtime = 'edge'

export const metadata: Metadata = {
  title: 'Commander League',
  description: 'Gestionnaire de ligue Duel Commander',
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
