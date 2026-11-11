import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, conflict, dbFailure } from '@/lib/auth/api'
import { deleteDeck, updateDeck } from '@/lib/db-decks'
import { editableDeck } from '@/lib/cards/deck-access'
import { MAX_LENGTH, optionalCardImage, optionalDeckLink, optionalText } from '@/lib/auth/validation'

export const runtime = 'edge'

type Params = { params: Promise<{ id: string }> }

export function PATCH(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'user', editableDeck(params, async ({ db, deck, body }) => {
    const name = optionalText(body.name, 'Le nom du deck', MAX_LENGTH.deckName)
    if (!name.ok) return badRequest(name.error)
    const link = optionalDeckLink(body.moxfield_url)
    if (!link.ok) return badRequest(link.error)
    const image = optionalCardImage(body.commander_image_url)
    if (!image.ok) return badRequest(image.error)

    const { data, error } = await updateDeck(db, deck.id, {
      name: name.value,
      moxfield_url: link.value,
      commander_image_url: image.value,
    })
    if (error !== null) return dbFailure(error)
    return NextResponse.json(data)
  }))
}

export function DELETE(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'user', editableDeck(params, async ({ db, deck }) => {
    const { error } = await deleteDeck(db, deck.id)
    if (error === 'DECK_IN_USE') return conflict('Ce deck a été utilisé dans une ligue : renomme-le plutôt que de le supprimer')
    if (error !== null) return dbFailure(error)
    return NextResponse.json({ ok: true })
  }))
}
