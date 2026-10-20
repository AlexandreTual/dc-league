import { describe, expect, it } from 'vitest'
import { en, fr, messages } from './messages'

/** Valeurs identiques permises : noms propres, termes de Magic gardés en anglais, mots pareils dans les deux langues. */
const SAME = new Set([
  'Commander League', 'Interface', 'Language / Langue', 'Français', 'English', 'Playoffs', 'Commander', 'Duel Commander',
  'Mulligan', 'Initiative', 'Poison', 'Oracle', 'Visio', 'Total', 'Points', 'Score', 'Message', 'Format', 'Description',
  'Ok', 'OK', 'Admin', 'Email', 'Moxfield', 'Archidekt', 'Gemini', 'Instant', 'Rad', 'Tickets', 'Bushido', 'Absorption',
  'Annihilator', 'Phasing', 'Champion', '+1/+1', '-1/-1', '…', '',
  'pts', 'Pts', 'Round',
])

type Leaf = { path: string; fr: string; en: string }

/** Feuilles des deux dictionnaires ; une fonction est appelée avec des valeurs d'exemple. */
function leaves(a: unknown, b: unknown, path: string, out: Leaf[]) {
  if (typeof a === 'function' && typeof b === 'function') {
    try {
      const args = Array.from({ length: a.length }, () => 2)
      leaves(a(...args), b(...args), path, out)
    } catch {
      // paramètres d'une autre forme : vérifiés par les tests de la fonction
    }
    return
  }
  if (typeof a === 'string' && typeof b === 'string') {
    out.push({ path, fr: a, en: b })
    return
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const key of Object.keys(a)) leaves((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}.${key}`, out)
  }
}

describe('dictionnaires', () => {
  it('messages() donne le dictionnaire de la langue', () => {
    expect(messages('fr')).toBe(fr)
    expect(messages('en')).toBe(en)
  })

  it('mêmes clés en anglais qu’en français', () => {
    const keys = (o: unknown, path = ''): string[] =>
      o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => [`${path}${k}`, ...keys(v, `${path}${k}.`)]) : []
    expect(keys(en).sort()).toEqual(keys(fr).sort())
  })

  it('aucun texte anglais resté en français par erreur', () => {
    const out: Leaf[] = []
    leaves(fr, en, '', out)
    const same = out.filter((l) => l.fr === l.en && !SAME.has(l.fr) && /[a-zà-ÿ]{3}/i.test(l.fr))
    expect(same.map((l) => `${l.path} : ${l.fr}`)).toEqual([])
  })

  it('aucune lettre accentuée française dans l’anglais', () => {
    const out: Leaf[] = []
    leaves(fr, en, '', out)
    const accented = out.filter((l) => /[àâçéèêëîïôûùüÿœ]/i.test(l.en) && !SAME.has(l.en))
    expect(accented.map((l) => `${l.path} : ${l.en}`)).toEqual([])
  })
})
