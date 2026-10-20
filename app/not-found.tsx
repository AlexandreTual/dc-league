import Link from 'next/link'
import { getMessages } from '@/lib/i18n/server'

export const runtime = 'edge'

export default async function NotFound() {
  const t = (await getMessages()).site.notFound
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center">
      <h1 className="font-fantasy text-3xl font-bold text-dc-gold">{t.title}</h1>
      <p className="text-dc-muted text-sm">{t.text}</p>
      <Link href="/" className="text-dc-gold text-sm hover:underline">{t.home}</Link>
    </div>
  )
}
