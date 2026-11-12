import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { LogIn } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/session'
import { safeRedirectPath } from '@/lib/auth/validation'
import { countAdmins } from '@/lib/db-auth'
import { isLeagueInvitePath } from '@/lib/leagues/join'
import LoginForm from './LoginForm'

export const runtime = 'edge'

export const metadata: Metadata = { title: 'Connexion' }

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams
  const target = safeRedirectPath(from)
  if (await getCurrentUser()) redirect(target)

  const { env } = getRequestContext<CloudflareEnv>()
  const { data: admins } = await countAdmins(env.DB)

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 space-y-3">
          <div className="w-16 h-16 rounded-full bg-dc-gold/10 border border-dc-gold/30 flex items-center justify-center mx-auto">
            <LogIn className="w-8 h-8 text-dc-gold" />
          </div>
          <h1 className="font-fantasy text-2xl font-bold text-dc-gold">Connexion</h1>
          <p className="text-dc-muted text-sm">Connecte-toi avec le pseudo choisi lors de ton invitation</p>
          {isLeagueInvitePath(target) && (
            <p className="text-dc-text text-sm bg-dc-gold/10 border border-dc-gold/30 rounded-lg px-3 py-2">
              Connecte-toi pour rejoindre la ligue. Pas encore de compte ? Demande une invitation à l&apos;administrateur.
            </p>
          )}
        </div>
        <LoginForm target={target} showBootstrap={admins === 0} />
      </div>
    </div>
  )
}
