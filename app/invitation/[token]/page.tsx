import { getRequestContext } from '@cloudflare/next-on-pages'
import { KeyRound } from 'lucide-react'
import { hashToken } from '@/lib/auth/crypto'
import { getValidInvitation } from '@/lib/db-auth'
import { getMessages } from '@/lib/i18n/server'
import InvitationForm from './InvitationForm'

export const runtime = 'edge'

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { env } = getRequestContext<CloudflareEnv>()
  const [{ data: invitation }, t] = await Promise.all([getValidInvitation(env.DB, await hashToken(token), new Date()), getMessages()])
  const m = t.account.invitation

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 space-y-3">
          <div className="w-16 h-16 rounded-full bg-dc-gold/10 border border-dc-gold/30 flex items-center justify-center mx-auto">
            <KeyRound className="w-8 h-8 text-dc-gold" />
          </div>
          {invitation ? (
            <>
              <h1 className="font-fantasy text-2xl font-bold text-dc-gold">{m.welcome(invitation.player_name)}</h1>
              <p className="text-dc-muted text-sm">
                {invitation.kind === 'signup' ? m.signupIntro : m.resetIntro}
              </p>
            </>
          ) : (
            <>
              <h1 className="font-fantasy text-2xl font-bold text-dc-gold">{m.invalidTitle}</h1>
              <p className="text-dc-muted text-sm">{m.invalidText}</p>
            </>
          )}
        </div>
        {invitation && <InvitationForm token={token} kind={invitation.kind} />}
      </div>
    </div>
  )
}
