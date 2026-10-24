import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { Trophy, UserPlus } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/session'
import { countMatches } from '@/lib/db'
import { getLeagueByInviteToken, isLeagueMember, listLeaguePlayers } from '@/lib/db-leagues'
import { joinBlock } from '@/lib/leagues/join'
import { getMessages } from '@/lib/i18n/server'
import { loadFailed } from '@/lib/load'
import LoadError from '@/components/LoadError'
import { organizerLabel } from '@/components/leagues/format'
import JoinButton from './JoinButton'

export const runtime = 'edge'
export const revalidate = 0

function Box({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-md mx-auto bg-dc-surface border border-dc-border rounded-2xl p-6 space-y-4 text-center">
      <Trophy className="w-10 h-10 mx-auto text-dc-gold" />
      {children}
    </div>
  )
}

/** Rejoindre une ligue par son lien d'invitation (il faut déjà un compte). */
export default async function JoinLeaguePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [user, t] = await Promise.all([getCurrentUser(), getMessages()])
  const j = t.leagues.join
  if (!user) redirect(`/connexion?from=${encodeURIComponent(`/ligues/rejoindre/${token}`)}`)
  if (user.isBootstrap) {
    return <Box><p className="text-dc-muted text-sm">{j.createPlayerFirst}</p></Box>
  }

  const db = getRequestContext<CloudflareEnv>().env.DB
  const found = await getLeagueByInviteToken(db, token)
  if (found.error !== null) return <LoadError what={j.loadWhat} />
  const league = found.data
  if (!league) {
    return (
      <Box>
        <p className="text-dc-text">{j.inviteInvalid}</p>
        <Link href="/ligues" className="text-dc-gold text-sm hover:underline">{j.seeLeagues}</Link>
      </Box>
    )
  }

  const results = await Promise.all([isLeagueMember(db, league.id, user.playerId), countMatches(db, league.id), listLeaguePlayers(db, league.id)])
  if (loadFailed(...results)) return <LoadError what={j.loadWhat} />
  const [member, matches, players] = results
  const block = joinBlock(league, matches.data ?? 0)
  const count = players.data?.length ?? 0

  return (
    <Box>
      <div className="space-y-1">
        <p className="text-dc-muted text-sm">{j.invitation}</p>
        <h1 data-user-content className="font-fantasy text-2xl font-bold text-dc-gold">{league.name}</h1>
        <p className="text-dc-muted text-sm">
          {organizerLabel(league, t)} · {t.leagues.enrolled(count)}
        </p>
      </div>
      {member.data ? (
        <>
          <p className="text-dc-text text-sm">{j.alreadyIn}</p>
          <Link href={`/ligues/${league.id}/classement`} className="inline-flex items-center gap-1.5 text-dc-gold hover:underline text-sm">
            {j.seeLeague}
          </Link>
        </>
      ) : block ? (
        <p className="text-dc-text text-sm">{j[block]}</p>
      ) : (
        <JoinButton token={token}>
          <UserPlus className="w-4 h-4" /> {j.join}
        </JoinButton>
      )}
    </Box>
  )
}
