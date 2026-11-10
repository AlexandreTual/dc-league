import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import { MAX_LENGTH, requiredId, requiredText } from '@/lib/auth/validation'
import { listPlayers, insertPlayer, PLAYER_ERR } from '@/lib/db'
import { destroyGame } from '@/lib/games/binding'
import { GAME_SERVER_ERROR } from '@/lib/games/remove'
import { removePlayer } from '@/lib/games/remove-player'

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

    return NextResponse.json(player, { status: 201 })
  })
}

export function DELETE(req: NextRequest) {
  return apiRoute(req, 'admin', async ({ db, env, body }) => {
    const id = requiredId(body.id, "L'identifiant du joueur")
    if (!id.ok) return badRequest(id.error)

    // Les parties des tables dont il est l'hôte sont supprimées du serveur de jeu avant lui.
    const { error } = await removePlayer(db, destroyGame(env), id.value)
    if (error !== null) return resultError(error, { [PLAYER_ERR.LAST_ADMIN]: 409, [PLAYER_ERR.HAS_HISTORY]: 409, [GAME_SERVER_ERROR]: 502 })
    return NextResponse.json({ ok: true })
  })
}
