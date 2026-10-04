import { NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { assertSameOrigin, requireUser } from '@/lib/auth/session'
import { canEditDeck } from '@/lib/auth/permissions'
import { getDeck, type DbDeck } from '@/lib/db-decks'
import type { CurrentUser } from '@/lib/auth/types'

export const INTERNAL_ERROR = 'Erreur interne, réessaie plus tard'

/** Contrôle commun des routes qui modifient un deck : origine, connexion, existence, propriété. */
export async function loadEditableDeck(
  req: Request,
  params: Promise<{ id: string }>,
): Promise<{ db: D1Database; deck: DbDeck; user: CurrentUser } | NextResponse> {
  const refused = assertSameOrigin(req)
  if (refused) return refused
  const user = await requireUser()
  if (user instanceof NextResponse) return user

  const { env } = getRequestContext<CloudflareEnv>()
  const { id } = await params
  const { data: deck, error } = await getDeck(env.DB, id)
  if (error !== null) return NextResponse.json({ error: INTERNAL_ERROR }, { status: 500 })
  if (!deck) return NextResponse.json({ error: 'Deck introuvable' }, { status: 404 })
  if (!canEditDeck(user, deck)) {
    return NextResponse.json({ error: 'Tu ne peux gérer que tes propres decks' }, { status: 403 })
  }
  return { db: env.DB, deck, user }
}
