import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import I18nProvider from '@/components/i18n/I18nProvider'
import { getCurrentUser } from '@/lib/auth/session'
import { getLang } from '@/lib/i18n/server'
import { messages } from '@/lib/i18n/messages'

export const runtime = 'edge'

export async function generateMetadata(): Promise<Metadata> {
  const t = messages(await getLang())
  return {
    title: t.common.siteName,
    description: t.common.siteDescription,
    // Fichiers dans public/ : next-on-pages refuse app/icon.svg (il en ferait une route non edge).
    icons: {
      icon: { url: '/icon.svg', type: 'image/svg+xml' },
      apple: { url: '/apple-icon.png', sizes: '180x180' },
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [user, lang] = await Promise.all([getCurrentUser(), getLang()])

  return (
    <html lang={lang} className="dark">
      <body className="min-h-screen bg-dc-bg text-dc-text antialiased">
        <I18nProvider lang={lang}>
          <Navbar user={user} />
          <main className="max-w-5xl mx-auto px-4 py-8">
            {children}
          </main>
        </I18nProvider>
      </body>
    </html>
  )
}
