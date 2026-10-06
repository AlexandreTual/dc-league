import type { DeckToken } from '@/lib/game/types'

export type Section = 'commander' | 'main'

export type ParsedLine = {
  lineNumber: number
  quantity: number
  name: string
  set: string | null
  number: string | null
  section: Section
}

export type CardFace = {
  name: string
  printed_name: string | null
  mana_cost: string | null
  type_line: string
  printed_type_line: string | null
  oracle_text: string | null
  printed_text: string | null
  image_normal: string | null
  /** Image « large » (672 px) ; absente des cartes enregistrées avant son ajout. */
  image_large?: string | null
  image_small: string | null
  /** Illustration de la face (Scryfall `illustration_id`) ; absente des cartes enregistrées avant son ajout. */
  illustration_id?: string | null
}

export type CardRow = {
  id: string
  oracle_id: string
  lang: string
  name: string
  printed_name: string | null
  set_code: string
  collector_number: string
  released_at: string | null
  mana_cost: string | null
  cmc: number
  type_line: string
  printed_type_line: string | null
  oracle_text: string | null
  printed_text: string | null
  colors: string[]
  color_identity: string[]
  image_normal: string | null
  /** Image « large » (672 px) ; absente des catalogues d'un serveur de jeu plus ancien. */
  image_large?: string | null
  image_small: string | null
  /**
   * Numérisation de cette impression chez Scryfall (`highres_scan`, `lowres`, `placeholder`, `missing`).
   * Si elle est floue, les images peuvent venir d'une impression nette de même illustration (issue #20).
   */
  image_status?: string | null
  /** Illustration (Scryfall `illustration_id`) ; celle de la face avant est dans `faces`. */
  illustration_id?: string | null
  faces: CardFace[] | null
}

export type CardLookup = { key: string; en_card_id: string | null; fr_card_id: string | null }

/** Entrée du cache lue en base, avec sa date d'enregistrement (ISO). */
export type StoredCardLookup = CardLookup & { fetched_at: string }

export type DeckCardView = {
  position: number
  quantity: number
  section: Section
  requested_name: string
  en: CardRow | null
  fr: CardRow | null
}

export type ImportSummary = {
  total: number
  commanders: number
  frenchCount: number
  notFound: { lineNumber: number; text: string }[]
  ignored: number
  errors: { lineNumber: number; text: string }[]
}

/** Règle officielle (« ruling ») d'une carte, en anglais. */
export type Ruling = { date: string; source: 'wotc' | 'scryfall'; text: string }

/** Jeton d'un deck tel qu'enregistré : identifiant Scryfall de l'impression retenue en plus. */
export type DeckTokenRow = DeckToken & { id: string }
