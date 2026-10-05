import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import { MAX_LENGTH, requiredId, requiredText } from '@/lib/auth/validation'
import { listPlayers, insertPlayer, deletePlayer, countMatches, PLAYER_ERR } from '@/lib/db'
import { getActiveLeague, enrollLeaguePlayer } from '@/lib/db-leagues'

export const runtime = 'edge'

export function GET(req: NextRequest) {
  return apiRoute(req, 'public', async ({ db }) => {
    const { data, error } = await listPlayers(db)
    if (error !== null) return resultError(error)
    return NextResponse.json(data)
  })
}

export function POST(req: NextRequest) {
  return apiRoute(req, 'admin', async ({ db, body }) => {
    const name = requiredText(body.name, 'Le nom', MAX_LENGTH.playerName)
    if (!name.ok) return badRequest(name.error)

    const { data: player, error: playerErr } = await insertPlayer(db, { name: name.value })
    if (playerErr !== null) return resultError(playerErr)

    const { data: league, error: leagueErr } = await getActiveLeague(db)
    if (leagueErr !== null) return resultError(leagueErr)
    if (league) {
      const { data: count, error: countErr } = await countMatches(db, league.id)
      if (countErr !== null) return resultError(countErr)
      if (count === 0) {
        const { error: enrollErr } = await enrollLeaguePlayer(db, league.id, player.id)
        if (enrollErr !== null) return resultError(enrollErr)
      }
    }

    return NextResponse.json(player, { status: 201 })
  })
}

export function DELETE(req: NextRequest) {
  return apiRoute(req, 'admin', async ({ db, body }) => {
    const id = requiredId(body.id, "L'identifiant du joueur")
    if (!id.ok) return badRequest(id.error)

    const { error } = await deletePlayer(db, id.value)
    if (error !== null) return resultError(error, { [PLAYER_ERR.LAST_ADMIN]: 409, [PLAYER_ERR.HAS_HISTORY]: 409 })
    return NextResponse.json({ ok: true })
  })
}
