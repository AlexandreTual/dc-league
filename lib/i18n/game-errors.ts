// Erreurs du moteur et du serveur de jeu : envoyées en français (un serveur plus ancien aussi), traduites ici.
import { fr, type Messages } from './messages'

type Table = Record<string, string | ((value: string) => string)>

/** Tables traduites : erreurs du moteur et du serveur de jeu, messages de la connexion. */
const TABLES = ['gameErrors', 'socket'] as const

const MARK = '\u0000'
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Texte français exact → clé ; messages à valeur : motif tiré du gabarit français. */
const EXACT = new Map<string, { table: (typeof TABLES)[number]; key: string }>()
const PATTERNS: { table: (typeof TABLES)[number]; key: string; regex: RegExp }[] = []
for (const table of TABLES) {
  for (const [key, value] of Object.entries(fr.online[table] as Table)) {
    if (typeof value === 'string') {
      if (!EXACT.has(value)) EXACT.set(value, { table, key })
    } else {
      const [before, after] = value(MARK).split(MARK)
      PATTERNS.push({ table, key, regex: new RegExp(`^${escape(before)}([\\s\\S]*)${escape(after)}$`) })
    }
  }
}

/** Message français du moteur ou du serveur de jeu dans la langue de `t` ; un message inconnu est rendu tel quel. */
export function translateGameError(message: string, t: Messages): string {
  const exact = EXACT.get(message)
  if (exact) return (t.online[exact.table] as Table)[exact.key] as string
  for (const { table, key, regex } of PATTERNS) {
    const match = regex.exec(message)
    if (match) return ((t.online[table] as Table)[key] as (value: string) => string)(match[1])
  }
  return message
}
