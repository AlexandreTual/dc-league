import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import { listLeagues, createLeague } from '@/lib/db-leagues'

export async function GET() {
  const { data, error } = listLeagues()
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { name } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Le nom de la saison est requis' }, { status: 400 })
  }
  const { data, error } = createLeague(name.trim())
  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
