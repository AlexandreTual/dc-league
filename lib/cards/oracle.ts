// Texte Oracle (anglais, fait foi) et texte imprimé français d'une carte, lien vers sa fiche Gatherer.
import type { CardRow } from './types'

export type OracleFace = {
  /** Nom anglais (Oracle). */
  name: string
  /** Nom imprimé français, s'il existe. */
  printedName: string | null
  typeLine: string
  oracle: string | null
  printed: string | null
}

/** Une entrée par face : les deux faces d'une carte double, une seule sinon. */
export function oracleFaces(en: CardRow, fr: CardRow | null): OracleFace[] {
  const enFaces = en.faces?.length ? en.faces : null
  if (!enFaces) {
    return [{ name: en.name, printedName: fr?.printed_name ?? null, typeLine: en.type_line, oracle: en.oracle_text, printed: fr?.printed_text ?? null }]
  }
  return enFaces.map((f, i) => {
    const frFace = fr?.faces?.[i] ?? null
    return {
      name: f.name,
      printedName: frFace?.printed_name ?? null,
      typeLine: f.type_line,
      oracle: f.oracle_text,
      printed: frFace?.printed_text ?? null,
    }
  })
}

function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Fiche Gatherer d'une impression (texte, règles) : l'impression française du deck si elle existe, sinon
 * l'anglaise. Carte recto verso (une image par face) : nom de la face avant ; carte double sur une seule
 * face (Fire // Ice) : nom complet.
 */
export function gathererUrl(en: CardRow, fr: CardRow | null = null): string {
  const print = fr ?? en
  const faces = en.faces ?? []
  const doubleSided = faces.length > 1 && faces.every((f) => f.image_normal)
  const name = slug(doubleSided ? faces[0].name : en.name)
  const lang = fr ? 'fr-fr' : 'en-us'
  return `https://gatherer.wizards.com/${encodeURIComponent(print.set_code.toUpperCase())}/${lang}/${encodeURIComponent(print.collector_number)}/${name}`
}
