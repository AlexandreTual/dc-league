import { NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { requirePlayer } from '@/lib/auth'
import { getTable } from '@/lib/db-games'
import { resultResponse } from '@/lib/games/http'

export const runtime = 'edge'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePlayer()
  if (user instanceof NextResponse) return user
  const { id } = await params
  const result = await getTable(getRequestContext<CloudflareEnv>().env.DB, id)
  if (result.error === null && !result.data) return NextResponse.json({ error: 'Table introuvable' }, { status: 404 })
  return resultResponse(result)
}
