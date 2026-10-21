// Accessibilité de la table : nom lu d'une carte, touches qui ouvrent son menu, annonces du glisser-déposer en français.
import type { Announcements, ScreenReaderInstructions } from '@dnd-kit/core'
import { cardInfo, ZONE_LABELS } from '@/lib/game/apply'
import type { CardInstance, Catalog, PlayerZone } from '@/lib/game/types'

const FACE_DOWN = 'Carte face cachée'
const LIBRARY_TOP = 'Carte du dessus de la bibliothèque'

/** Nom lu d'une carte ; une carte face cachée (ou inconnue) n'est pas nommée, comme à l'écran. */
export function cardLabel(catalog: Catalog | undefined, card: Pick<CardInstance, 'ref' | 'token' | 'flipped' | 'faceDown'>, lang: 'fr' | 'en'): string {
  const info = cardInfo(catalog, card, lang)
  return info.hidden ? FACE_DOWN : info.name
}

/** Entrée, Maj+F10 ou la touche Menu : ouvrent le menu de la carte qui a le focus. */
export function isMenuKey(e: { key: string; shiftKey: boolean }): boolean {
  return e.key === 'Enter' || e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)
}

/** Consigne lue sur une carte (pas de glisser au clavier : le menu de la carte la déplace). */
export const dragInstructions: ScreenReaderInstructions = {
  draggable: 'Entrée, Maj+F10 ou la touche Menu ouvrent le menu de la carte, qui permet de la déplacer. À la souris ou au doigt, glisser la carte vers une zone.',
}

type Data = { current?: Record<string, unknown> } | undefined

/** Annonces du glisser : le nom de la carte et la zone survolée, jamais l'identifiant interne. */
export function dragAnnouncements({ me, cardName, playerName }: {
  me: string | null
  cardName: (id: string) => string | undefined
  playerName: (id: string) => string | undefined
}): Announcements {
  const nameOf = (active: { id: string | number; data: Data }) => {
    const id = String(active.data?.current?.card ?? active.id)
    return id.startsWith('top:') ? LIBRARY_TOP : cardName(id) ?? FACE_DOWN
  }
  const zoneOf = (over: { data: Data } | null): string | null => {
    const data = over?.data?.current
    if (!data) return null
    if (data.panel) return 'la fenêtre de la pile'
    if (data.slot) return 'une place de la pile'
    const zone = ZONE_LABELS[data.zone as PlayerZone]
    if (!zone) return 'une zone'
    const player = String(data.player)
    return player === me ? zone : `${zone} de ${playerName(player) ?? 'un joueur'}`
  }
  return {
    onDragStart: ({ active }) => `Carte « ${nameOf(active)} » saisie.`,
    onDragOver: ({ active, over }) => {
      const zone = zoneOf(over)
      return zone ? `« ${nameOf(active)} » au-dessus de : ${zone}.` : `« ${nameOf(active)} » hors d’une zone.`
    },
    onDragEnd: ({ active, over }) => {
      const zone = zoneOf(over)
      return zone ? `« ${nameOf(active)} » déposée : ${zone}.` : `« ${nameOf(active)} » relâchée hors d’une zone.`
    },
    onDragCancel: ({ active }) => `Déplacement de « ${nameOf(active)} » annulé.`,
  }
}
