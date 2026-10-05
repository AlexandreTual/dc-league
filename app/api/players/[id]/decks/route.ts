import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import { canCreateDeckFor } from '@/lib/auth/permissions'
import { MAX_LENGTH, optionalCardImage, optionalDeckLink, requiredText } from '@/lib/auth/validation'
import { listPlayerDecks, insertDeck } from '@/lib/db-decks'

export const runtime = 'edge'

type Params = { params: Promise<{ id: string }> }

export function GET(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'public', async ({ db }) => {
    const { id } = await params
    const { data, error } = await listPlayerDecks(db, id)
    if (error !== null) return resultError(error)
    return NextResponse.json(data)
  })
}

export function POST(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'user', async ({ db, user, body }) => {
    const { id } = await params
    if (!canCreateDeckFor(user!, id)) {
      return NextResponse.json({ error: 'Tu ne peux gérer que tes propres decks' }, { status: 403 })
    }

    const name = requiredText(body.name, 'Le nom du deck', MAX_LENGTH.deckName)
    if (!name.ok) return badRequest(name.error)
    const link = optionalDeckLink(body.moxfield_url)
    if (!link.ok) return badRequest(link.error)
    const image = optionalCardImage(body.commander_image_url)
    if (!image.ok) return badRequest(image.error)

    const { data, error } = await insertDeck(db, id, {
      name: name.value,
      commander_image_url: image.value ?? null,
      moxfield_url: link.value ?? null,
    })
    if (error !== null) return resultError(error)
    return NextResponse.json(data, { status: 201 })
  })
}
