// Ligne du journal dans la langue du lecteur (spec 2026-10-19-english-interface-design, « Journal de partie structuré »).
// Pur : la table l'appelle avec le dictionnaire de l'interface et la langue des cartes du lecteur.
import type { Lang } from '@/lib/i18n/lang'
import { dungeonText, isDungeonId, roomOf, roomText } from './dungeons'
import type { Messages } from '@/lib/i18n/messages'
import type { Catalog, LogCard, LogMessage, LogParam } from './types'

/** Ce qu'il faut de la vue pour nommer les joueurs. */
export type LogView = { players: Record<string, { name: string }> }

type Resolved = string | number | number[] | string[] | { label: string; param: string }[]
  | { name: string; the: string; short: string } | { name: string; text: string }
type Line = string | ((vars: Record<string, Resolved>) => string)

/** Nom d'une carte comme le moteur l'écrit : français imprimé s'il existe (cartes en français), sinon anglais. */
function cardName(card: LogCard, catalogs: Record<string, Catalog | undefined>, lang: Lang, t: Messages): string {
  if (card.token !== undefined) return card.token
  const entry = card.ref === null ? undefined : catalogs[card.owner]?.entries.find((e) => e.ref === card.ref)
  if (!entry) return t.log.aCard
  return (lang === 'fr' ? entry.fr?.printed_name : null) ?? entry.en.name
}

/**
 * La ligne dans la langue de `t`, noms des cartes dans la langue `cardLang`. Sans `msg` (serveur de jeu plus ancien),
 * ou si la ligne ne peut pas être lue (clé inconnue, joueur absent), la phrase française `text`.
 */
export function formatLog(
  entry: { text: string; msg?: LogMessage },
  t: Messages,
  cardLang: Lang,
  view: LogView,
  catalogs: Record<string, Catalog | undefined>,
): string {
  const msg = entry.msg
  if (!msg || typeof msg !== 'object') return entry.text
  const lines = t.log.lines as unknown as Record<string, Line>
  // Clé inconnue (serveur de jeu plus récent que la page) : la phrase française.
  if (typeof msg.key !== 'string' || !Object.hasOwn(lines, msg.key)) return entry.text
  const line = lines[msg.key]
  if (typeof line === 'string') return line

  const player = (id: string) => {
    const name = view.players[id]?.name
    if (name === undefined) throw new Error('joueur inconnu')
    return name
  }
  const resolve = (p: LogParam): Resolved => {
    if (typeof p === 'string' || typeof p === 'number' || Array.isArray(p)) return p
    if ('card' in p) return cardName(p.card, catalogs, cardLang, t)
    if ('cards' in p) return p.cards.map((c) => (c ? cardName(c, catalogs, cardLang, t) : t.log.faceDownCard))
    if ('player' in p) return player(p.player)
    if ('players' in p) return p.players.map(player)
    if ('zone' in p) return t.log.zone(t.log.zones[p.zone], p.of === undefined ? undefined : player(p.of))
    if ('abilities' in p) return p.abilities.map((a) => t.log.ability(a))
    if ('changed' in p) return p.changed.map((a) => ({ label: t.log.keyword(a.keyword), param: t.log.abilityParam(a) }))
    if ('keywords' in p) return p.keywords.map((k) => t.log.keyword(k))
    // Donjons et salles : cartes officielles, dans la langue des cartes comme les noms de cartes.
    if ('dungeon' in p && isDungeonId(p.dungeon)) return dungeonText(p.dungeon, cardLang)
    if ('room' in p && isDungeonId(p.room?.dungeon)) {
      const room = roomOf(p.room.dungeon, p.room.room)
      if (room) return roomText(room, cardLang)
    }
    throw new Error('valeur inconnue')
  }
  try {
    const vars: Record<string, Resolved> = {}
    for (const [k, v] of Object.entries(msg.params ?? {})) vars[k] = resolve(v)
    return line(vars)
  } catch {
    return entry.text
  }
}
