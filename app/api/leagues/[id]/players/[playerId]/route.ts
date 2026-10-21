import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import { upsertLeaguePlayer, removeLeaguePlayer, isLeagueMember } from '@/lib/db-leagues'
import { getDeck } from '@/lib/db-decks'
import { countMatches, STATUTS_LIGUE } from '@/lib/db'
import { leagueFor, MANAGE_REFUSED } from '@/lib/leagues/route-access'
import { LEAGUE_FINISHED } from '@/lib/leagues/join'

export const runtime = 'edge'

type Params = { params: Promise<{ id: string; playerId: string }> }

const NOT_ENROLLED = "Ce joueur n'est pas inscrit dans cette ligue."

/** L'organisateur, un admin, ou le joueur lui-même, sur une ligue en cours (une ligue terminée garde ses decks). */
async function entryAccess(db: D1Database, id: string, playerId: string, user: Parameters<typeof leagueFor>[2]) {
  const access = await leagueFor(db, id, user, 'view')
  if (access instanceof NextResponse) return access
  if (!access.canManage && access.viewer?.playerId !== playerId) {
    return NextResponse.json({ error: MANAGE_REFUSED }, { status: 403 })
  }
  if (!access.league.is_active) return badRequest(LEAGUE_FINISHED)
  return access
}

/** Deck du joueur pour cette ligue : un de ses propres decks, ou aucun. */
export function PATCH(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'user', async ({ db, body, user }) => {
    const { id, playerId } = await params
    const access = await entryAccess(db, id, playerId, user)
    if (access instanceof NextResponse) return access

    const member = await isLeagueMember(db, id, playerId)
    if (member.error !== null) return resultError(member.error)
    if (!member.data) return NextResponse.json({ error: NOT_ENROLLED }, { status: 404 })

    const deckId = body.deck_id ?? null
    if (deckId !== null && (typeof deckId !== 'string' || deckId.length > 100)) return badRequest('Deck invalide')
    if (deckId) {
      const deck = await getDeck(db, deckId)
      if (deck.error !== null) return resultError(deck.error)
      if (!deck.data || deck.data.player_id !== playerId) return badRequest("Ce deck n'appartient pas à ce joueur.")
    }
    const { data, error } = await upsertLeaguePlayer(db, id, playerId, { deck_id: deckId || null })
    if (error !== null) return resultError(error)
    return NextResponse.json(data)
  })
}

/** Désinscrire un joueur (ou quitter la ligue), avant la génération des matchs. */
export function DELETE(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'user', async ({ db, user }) => {
    const { id, playerId } = await params
    const access = await entryAccess(db, id, playerId, user)
    if (access instanceof NextResponse) return access

    const { data: matchCount, error: countErr } = await countMatches(db, id)
    if (countErr !== null) return resultError(countErr)
    if (matchCount > 0) {
      return badRequest('Les matchs ont déjà été générés. Impossible de désinscrire un joueur.')
    }

    const { error } = await removeLeaguePlayer(db, id, playerId)
    if (error !== null) return resultError(error, STATUTS_LIGUE)
    return NextResponse.json({ ok: true })
  })
}
