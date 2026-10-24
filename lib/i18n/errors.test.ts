import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { localizeError, translateError } from './errors'
import { fr } from './messages'

const ROOT = join(__dirname, '..', '..')

function routes(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) routes(p, out)
    else if (f === 'route.ts') out.push(p)
  }
  return out
}

/** Services dont les messages d'erreur partent dans les réponses des routes. */
const SERVICES = [
  'lib/auth/api-core.ts', 'lib/auth/session.ts', 'lib/auth/origin.ts', 'lib/auth/service.ts', 'lib/auth/validation.ts',
  'lib/ai/ask.ts', 'lib/ai/messages.ts', 'lib/cards/deck-access.ts', 'lib/cards/deck-link.ts', 'lib/cards/rulings.ts',
  'lib/cards/tokens.ts', 'lib/db-games.ts', 'lib/db-leagues.ts', 'lib/db.ts', 'lib/games/http.ts', 'lib/games/remove.ts',
  'lib/games/start.ts', 'lib/games/tokens.ts', 'lib/leagues/join.ts', 'lib/leagues/route-access.ts', 'lib/leagues/validation.ts',
]

/** Phrases des sources qui ne sont pas des messages d'erreur envoyés au navigateur. */
const NOT_ERRORS = new Set([
  'CommanderLeague/1.0 (import de deck)', // en-tête User-Agent
  'Scryfall indisponible (${reason})', // erreur interne, journalisée
  'HTTP ${res.status}',
  'Bearer ${env.TURN_KEY_API_TOKEN}',
])

/** Phrases françaises (majuscule, espace) écrites entre guillemets dans les routes et leurs services. */
function phrases(): { file: string; text: string }[] {
  const files = [...routes(join(ROOT, 'app/api')), ...SERVICES.map((f) => join(ROOT, f))]
  const out: { file: string; text: string }[] = []
  const literal = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/console\.|^import /.test(l))
      .join('\n')
    for (const m of src.matchAll(literal)) {
      const text = (m[1] ?? m[2] ?? m[3]).replace(/\\'/g, "'")
      if (/^[A-ZÀ-Ý][^]*\s/.test(text) && !/SELECT|INSERT|UPDATE|DELETE FROM/.test(text) && !NOT_ERRORS.has(text)) {
        out.push({ file: file.slice(ROOT.length + 1), text })
      }
    }
  }
  return out
}

describe('messages d’erreur des routes', () => {
  it('chaque message des routes et des services a sa traduction anglaise', () => {
    const labels = new Set(Object.values(fr.errors.labels))
    const found = phrases()
    expect(found.length).toBeGreaterThan(80)
    const missing = found.filter(({ text }) => {
      if (labels.has(text)) return false
      const example = text.replace(/\$\{[^}]*\}/g, '2')
      return translateError(example, 'en') === example
    })
    expect(missing.map((m) => `${m.file} : ${m.text}`)).toEqual([])
  })

  it('français inchangé, anglais traduit, inconnu tel quel', () => {
    expect(translateError('Requête invalide', 'fr')).toBe('Requête invalide')
    expect(translateError('Requête invalide', 'en')).toBe('Invalid request')
    expect(translateError('Message venu d’ailleurs', 'en')).toBe('Message venu d’ailleurs')
  })

  it('messages à valeurs', () => {
    expect(translateError('Il reste 3 match(s) de ligue à jouer.', 'en')).toBe('3 league match(es) left to play.')
    expect(translateError('Question trop longue (1000 caractères au plus)', 'en')).toBe('Question too long (1000 characters max)')
    expect(translateError('Le nom du deck est requis', 'en')).toBe('The deck name is required')
    expect(translateError('Le nom de la ligue ne doit pas dépasser 80 caractères', 'en')).toBe('The league name must be at most 80 characters')
    expect(translateError('Deck introuvable ou privé sur Moxfield', 'en')).toBe('Deck not found or private on Moxfield')
    expect(translateError('Champ inconnu est requis', 'en')).toBe('Champ inconnu is required')
  })
})

describe('localizeError', () => {
  it('traduit le corps d’une réponse d’erreur JSON en gardant statut et autres champs', async () => {
    const res = await localizeError(NextResponse.json({ error: 'Plus de questions pour aujourd’hui, à demain !', remaining: 0 }, { status: 429 }), 'en')
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'No more questions today, see you tomorrow!', remaining: 0 })
  })

  it('laisse le français, les succès et les messages inconnus', async () => {
    const fr = NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
    expect(await localizeError(fr, 'fr')).toBe(fr)
    const ok = NextResponse.json({ error: 'Requête invalide' })
    expect(await localizeError(ok, 'en')).toBe(ok)
    const unknown = NextResponse.json({ error: 'Autre chose' }, { status: 400 })
    expect(await localizeError(unknown, 'en')).toBe(unknown)
  })
})
