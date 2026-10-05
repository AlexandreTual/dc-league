import { ScryfallUnavailableError } from '@/lib/cards/scryfall'
import type { TokenData } from './types'

type ScryfallToken = {
  name: string
  type_line?: string
  power?: string
  toughness?: string
  colors?: string[]
  image_uris?: { small?: string; normal?: string }
  card_faces?: { image_uris?: { small?: string; normal?: string } }[]
}

/** Recherche de jetons depuis le navigateur (Scryfall autorise les appels directs). */
export async function searchTokens(fetchFn: typeof fetch, text: string): Promise<TokenData[]> {
  const params = new URLSearchParams({ q: `t:token ${text.trim()}`, unique: 'cards' })
  let res: Response
  try {
    res = await fetchFn(`https://api.scryfall.com/cards/search?${params}`, { headers: { Accept: 'application/json' } })
  } catch (e) {
    throw new ScryfallUnavailableError((e as Error).message)
  }
  if (res.status === 404) return []
  if (!res.ok) throw new ScryfallUnavailableError(`HTTP ${res.status}`)
  const body = (await res.json()) as { data?: ScryfallToken[] }
  return (body.data ?? []).map((t) => {
    const images = t.image_uris ?? t.card_faces?.[0]?.image_uris
    return {
      name: t.name,
      typeLine: t.type_line ?? 'Token',
      power: t.power ?? null,
      toughness: t.toughness ?? null,
      colors: t.colors ?? [],
      image: images?.normal ?? images?.small ?? null,
    }
  })
}

/** Jeton saisi à la main : créature s'il a une force et une endurance. */
export function customToken(input: { name: string; power: string; toughness: string; colors: string[] }): TokenData {
  const name = input.name.trim() || 'Jeton'
  const isCreature = input.power.trim() !== '' && input.toughness.trim() !== ''
  return {
    name,
    typeLine: isCreature ? `Token Creature — ${name}` : `Token — ${name}`,
    power: isCreature ? input.power.trim() : null,
    toughness: isCreature ? input.toughness.trim() : null,
    colors: input.colors,
    image: null,
  }
}
