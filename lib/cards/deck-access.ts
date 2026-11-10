import { NextResponse } from 'next/server'
import { dbFailure, type ApiContext } from '@/lib/auth/api-core'
import { canEditDeck } from '@/lib/auth/permissions'
import { getDeck, type DbDeck } from '@/lib/db-decks'
import type { CurrentUser } from '@/lib/auth/types'

export type DeckContext = ApiContext & { deck: DbDeck; user: CurrentUser }

/**
 * Suite d'une route `apiRoute(req, 'user', …)` qui modifie un deck : existence et propriété contrôlées
 * (origine, connexion, corps JSON et journal des erreurs viennent d'apiRoute), puis `run` avec le deck.
 */
export function editableDeck(
  params: Promise<{ id: string }>,
  run: (ctx: DeckContext) => Promise<NextResponse>,
): (ctx: ApiContext) => Promise<NextResponse> {
  return async (ctx) => {
    const user = ctx.user
    if (!user) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 })
    const { id } = await params
    const { data: deck, error } = await getDeck(ctx.db, id)
    if (error !== null) return dbFailure(error)
    if (!deck) return NextResponse.json({ error: 'Deck introuvable' }, { status: 404 })
    if (!canEditDeck(user, deck)) {
      return NextResponse.json({ error: 'Tu ne peux gérer que tes propres decks' }, { status: 403 })
    }
    return run({ ...ctx, user, deck })
  }
}
