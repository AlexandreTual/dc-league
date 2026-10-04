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
  image_small: string | null
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
  image_small: string | null
  faces: CardFace[] | null
}

export type CardLookup = { key: string; en_card_id: string | null; fr_card_id: string | null }

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
