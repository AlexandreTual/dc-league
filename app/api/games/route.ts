import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { requirePlayer } from '@/lib/auth'
import { createTable, listTables } from '@/lib/db-games'
import { gameWrite, resultResponse } from '@/lib/games/http'

export const runtime = 'edge'

/** Salon : tables ouvertes et en cours. */
export async function GET() {
  const user = await requirePlayer()
  if (user instanceof NextResponse) return user
  return resultResponse(await listTables(getRequestContext<CloudflareEnv>().env.DB))
}

/** Crée une table ; l'hôte occupe la première place. */
export async function POST(req: NextRequest) {
  return gameWrite(req, async ({ db, user, body }) => {
    const format = body.format === 'duel' ? 'duel' : body.format === 'commander' ? 'commander' : null
    const seats = Number(body.seats)
    if (!format) return NextResponse.json({ error: 'Format inconnu' }, { status: 400 })
    if (format === 'commander' && !(Number.isInteger(seats) && seats >= 2 && seats <= 5)) {
      return NextResponse.json({ error: 'Entre 2 et 5 places' }, { status: 400 })
    }
    return resultResponse(await createTable(db, { hostPlayerId: user.playerId, format, seats, eliminatedSeeAll: body.eliminatedSeeAll === true }))
  })
}
