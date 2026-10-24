import type { Metadata } from 'next'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { KeyRound } from 'lucide-react'
import { hashToken } from '@/lib/auth/crypto'
import { afterInvitationPath } from '@/lib/auth/validation'
import { getValidInvitation } from '@/lib/db-auth'
import { isLeagueInvitePath } from '@/lib/leagues/join'
import InvitationForm from './InvitationForm'

export const runtime = 'edge'

export const metadata: Metadata = { title: 'Créer mon compte' }

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { token } = await params
  const target = afterInvitationPath((await searchParams).from)
  const { env } = getRequestContext<CloudflareEnv>()
  const { data: invitation } = await getValidInvitation(env.DB, await hashToken(token), new Date())

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 space-y-3">
          <div className="w-16 h-16 rounded-full bg-dc-gold/10 border border-dc-gold/30 flex items-center justify-center mx-auto">
            <KeyRound className="w-8 h-8 text-dc-gold" />
          </div>
          {invitation ? (
            <>
              <h1 className="font-fantasy text-2xl font-bold text-dc-gold">Bienvenue {invitation.player_name}</h1>
              <p className="text-dc-muted text-sm">
                {invitation.kind === 'signup' ? 'Choisis ton pseudo et ton mot de passe' : 'Choisis ton nouveau mot de passe'}
              </p>
              {isLeagueInvitePath(target) && (
                <p className="text-dc-text text-sm bg-dc-gold/10 border border-dc-gold/30 rounded-lg px-3 py-2">
                  Une fois ton compte créé, tu arriveras sur la page pour rejoindre la ligue.
                </p>
              )}
            </>
          ) : (
            <>
              <h1 className="font-fantasy text-2xl font-bold text-dc-gold">Lien invalide</h1>
              <p className="text-dc-muted text-sm">Ce lien n&apos;est plus valide, demande un nouveau lien à l&apos;admin.</p>
            </>
          )}
        </div>
        {invitation && <InvitationForm token={token} kind={invitation.kind} target={target} />}
      </div>
    </div>
  )
}
