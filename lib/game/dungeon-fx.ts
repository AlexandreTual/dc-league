// Animation du jeton de donjon : ce qui a changé entre deux affichages, et où placer le jeton.
import { roomOf, rowsOf, type DungeonPosition } from './dungeons'

export type DungeonSnapshot = { position?: DungeonPosition; done: number }
/** `glide` : le jeton glisse depuis la salle d'avant (même donjon, étage plus bas) ; `finish` : donjon terminé. */
export type DungeonFx = { glide: boolean; finish: boolean; room: string }

const rowOf = (p: DungeonPosition) => roomOf(p.id, p.room)?.row ?? 0

/** Animation à jouer entre deux états du joueur ; null sans changement (jamais au premier affichage). */
export function dungeonFx(before: DungeonSnapshot, after: DungeonSnapshot): DungeonFx | null {
  const a = before.position
  const b = after.position
  if (!b || (a && a.id === b.id && a.room === b.room && before.done === after.done)) return null
  return { glide: !!a && a.id === b.id && rowOf(b) > rowOf(a), finish: after.done > before.done, room: b.room }
}

/** Place du jeton sur la piste du portrait, en % (0 : entrée, 100 : dernier étage). */
export function trackPoint(p: DungeonPosition): number {
  const rows = rowsOf(p.id)
  return rows > 1 ? Math.round((rowOf(p) / (rows - 1)) * 100) : 0
}

/** Centre de la salle sur le plan, en % de sa largeur et de sa hauteur. */
export function mapPoint(p: DungeonPosition): { x: number; y: number } {
  const room = roomOf(p.id, p.room)
  return { x: Math.round((room?.x ?? 0.5) * 100), y: ((rowOf(p) + 0.5) / rowsOf(p.id)) * 100 }
}
