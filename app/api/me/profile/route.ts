import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import { MAX_LENGTH, optionalAvatar, optionalText } from '@/lib/auth/validation'
import { updatePlayerProfile } from '@/lib/db'

export const runtime = 'edge'

export function PATCH(req: NextRequest) {
  return apiRoute(req, 'player', async ({ db, user, body }) => {
    const name = optionalText(body.name, 'Le nom', MAX_LENGTH.playerName)
    if (!name.ok) return badRequest(name.error)
    const avatar = optionalAvatar(body.avatar_url)
    if (!avatar.ok) return badRequest(avatar.error)

    const { data, error } = await updatePlayerProfile(db, user!.playerId, { name: name.value, avatar_url: avatar.value })
    if (error !== null) return resultError(error, { 'Le nom est requis': 400 })
    return NextResponse.json(data)
  })
}
