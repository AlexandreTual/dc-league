import Link from 'next/link'

export const runtime = 'edge'

export default function NotFound() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center">
      <h1 className="font-fantasy text-3xl font-bold text-dc-gold">Page introuvable</h1>
      <p className="text-dc-muted text-sm">Cette page n&apos;existe pas ou a été déplacée.</p>
      <Link href="/" className="text-dc-gold text-sm hover:underline">Retour au classement</Link>
    </div>
  )
}
