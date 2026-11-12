// Accessibilité de la table : nom lu d'une carte, touches qui ouvrent son menu, annonces du glisser-déposer
// dans la langue de l'interface (dictionnaire `t`, français par défaut).
import type { Announcements, ScreenReaderInstructions } from '@dnd-kit/core'
import { cardInfo } from '@/lib/game/apply'
import type { CardInstance, Catalog, PlayerZone } from '@/lib/game/types'
import { fr, type Messages } from '@/lib/i18n/messages'

/** Nom lu d'une carte ; une carte face cachée (ou inconnue) n'est pas nommée, comme à l'écran. */
export function cardLabel(
  catalog: Catalog | undefined,
  card: Pick<CardInstance, 'ref' | 'token' | 'flipped' | 'faceDown'>,
  lang: 'fr' | 'en',
  t: Messages = fr,
): string {
  const info = cardInfo(catalog, card, lang)
  return info.hidden ? t.table.a11y.faceDown : info.name
}

/** Entrée, Maj+F10 ou la touche Menu : ouvrent le menu de la carte qui a le focus. */
export function isMenuKey(e: { key: string; shiftKey: boolean }): boolean {
  return e.key === 'Enter' || e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)
}

/** Consigne lue sur une carte (pas de glisser au clavier : le menu de la carte la déplace). */
export function dragInstructions(t: Messages = fr): ScreenReaderInstructions {
  return { draggable: t.table.a11y.instructions }
}

type Data = { current?: Record<string, unknown> } | undefined

/** Annonces du glisser : le nom de la carte et la zone survolée, jamais l'identifiant interne. */
export function dragAnnouncements({ me, cardName, playerName, t = fr }: {
  me: string | null
  cardName: (id: string) => string | undefined
  playerName: (id: string) => string | undefined
  t?: Messages
}): Announcements {
  const a = t.table.a11y
  const nameOf = (active: { id: string | number; data: Data }) => {
    const id = String(active.data?.current?.card ?? active.id)
    return id.startsWith('top:') ? a.libraryTop : cardName(id) ?? a.faceDown
  }
  const zoneOf = (over: { data: Data } | null): string | null => {
    const data = over?.data?.current
    if (!data) return null
    if (data.panel) return a.pilePanel
    if (data.slot) return a.pileSlot
    const zone = t.log.zones[data.zone as PlayerZone] as string | undefined
    if (!zone) return a.aZone
    const player = String(data.player)
    return player === me ? zone : t.log.zone(zone, playerName(player) ?? a.aPlayer)
  }
  return {
    onDragStart: ({ active }) => a.picked(nameOf(active)),
    onDragOver: ({ active, over }) => {
      const zone = zoneOf(over)
      return zone ? a.over(nameOf(active), zone) : a.outside(nameOf(active))
    },
    onDragEnd: ({ active, over }) => {
      const zone = zoneOf(over)
      return zone ? a.dropped(nameOf(active), zone) : a.released(nameOf(active))
    },
    onDragCancel: ({ active }) => a.cancelled(nameOf(active)),
  }
}
