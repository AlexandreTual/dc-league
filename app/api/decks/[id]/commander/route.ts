import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, dbFailure } from '@/lib/auth/api'
import { editableDeck } from '@/lib/cards/deck-access'
import { setCommander, setDeckCommanderImage, unsetCommander } from '@/lib/db-cards'

export const runtime = 'edge'

const notInDeck = () => NextResponse.json({ error: 'Carte introuvable dans ce deck' }, { status: 404 })

/** Corps : `{ position, commander? }`. `commander: false` remet la carte dans le deck ; absent ou `true`, elle devient commandant. */
export function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, 'user', editableDeck(params, async ({ db, deck, body }) => {
    if (!Number.isInteger(body.position) || (body.commander !== undefined && typeof body.commander !== 'boolean')) {
      return badRequest('Requête invalide')
    }
    const position = body.position as number

    if (body.commander === false) {
      const { data: image, error } = await unsetCommander(db, deck.id, position)
      if (error === 'NOT_FOUND') return notInDeck()
      if (error !== null) return dbFailure(error)
      const saved = await setDeckCommanderImage(db, deck.id, image)
      if (saved.error !== null) return dbFailure(saved.error)
      return NextResponse.json({ ok: true })
    }

    const { data: card, error } = await setCommander(db, deck.id, position)
    if (error === 'NOT_FOUND') return notInDeck()
    if (error === 'NOT_LEGENDARY') return badRequest('Seule une carte légendaire peut être commandant')
    if (error !== null) return dbFailure(error)

    if (card.image_normal) await setDeckCommanderImage(db, deck.id, card.image_normal)
    return NextResponse.json({ ok: true })
  }))
}
