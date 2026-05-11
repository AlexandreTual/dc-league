import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { isAdminAuthenticated } from '@/lib/auth'
import { listLeagues, createLeague } from '@/lib/db-leagues'

export const runtime = 'edge'

export async function GET() {
  const { env } = getRequestContext<CloudflareEnv>()
  const { data, error } = await listLeagues(env.DB)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { name } = await req.json() as { name?: string }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Le nom de la saison est requis' }, { status: 400 })
  }
  const { env } = getRequestContext<CloudflareEnv>()
  const { data, error } = await createLeague(env.DB, name.trim())
  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
