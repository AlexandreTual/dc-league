import { listDeckCards } from '@/lib/db-cards'
import type { ScryfallClient } from '@/lib/cards/scryfall'
import { fillCardStats } from '@/lib/cards/stats'
import { INTERNAL_ERROR, claimStart, getTable, markPlaying, releaseStart, startCheck, type GameTable } from '@/lib/db-games'
import type { Result } from '@/lib/db'
import { buildCatalog } from '@/lib/game/catalog'
import type { GameSetup } from '@/lib/game/types'
import type { DestroyGame } from './remove'

export { INTERNAL_ERROR }

/** Crée la partie dans le Durable Object de la table. */
export type GameInit = (tableId: string, body: { setup: GameSetup; hostId: string; firstPlayer?: string }) => Promise<{ ok: boolean; status: number }>

/**
 * Démarre la partie : l'hôte seulement, conditions remplies ; catalogues construits depuis les decks choisis.
 * La table est d'abord réservée (`starting`) : plus personne ne rejoint, ne part ni ne change de deck pendant
 * la création de la partie, et deux démarrages simultanés n'en créent qu'un. En cas d'échec, elle redevient ouverte.
 * `firstPlayer` : joueur de la table choisi par l'hôte pour commencer ; absent : tirage au sort.
 * `scryfall` : pour rattraper la force et l'endurance des cartes importées avant leur ajout (voir fillCardStats).
 * `destroy` : défait une partie restée dans le serveur de jeu (table supprimée pendant le démarrage, essai précédent interrompu).
 */
export async function startTable(
  db: D1Database, init: GameInit, destroy: DestroyGame, tableId: string, playerId: string, firstPlayer?: string, scryfall?: ScryfallClient,
): Promise<Result<GameTable>> {
  const { data: table, error } = await getTable(db, tableId)
  if (error !== null) return { data: null, error: INTERNAL_ERROR }
  if (!table) return { data: null, error: 'Table introuvable' }
  if (table.hostPlayerId !== playerId) return { data: null, error: "Seul l'hôte peut faire ça" }
  const reason = startCheck(table)
  if (reason) return { data: null, error: reason }
  if (firstPlayer !== undefined && !table.players.some((p) => p.playerId === firstPlayer)) {
    return { data: null, error: "Ce joueur n'est pas à cette table" }
  }

  const { data: claimed, error: claimError } = await claimStart(db, tableId, playerId)
  if (claimError !== null) return { data: null, error: INTERNAL_ERROR }
  if (!claimed) return { data: null, error: 'La partie a déjà commencé' }

  let started = false
  try {
    const result = await createGame(db, init, destroy, tableId, firstPlayer, scryfall)
    started = result.error === null
    return result
  } finally {
    // Échec, même par exception (serveur de jeu injoignable…) : la table redevient ouverte.
    if (!started && (await releaseStart(db, tableId)).error !== null) console.error(`Table ${tableId} restée en démarrage`)
  }
}

/** Table réservée : relue (places désormais figées), partie créée, table passée en cours. */
async function createGame(
  db: D1Database, init: GameInit, destroy: DestroyGame, tableId: string, firstPlayer?: string, scryfall?: ScryfallClient,
): Promise<Result<GameTable>> {
  const { data: table, error } = await getTable(db, tableId)
  if (error !== null || !table) return { data: null, error: INTERNAL_ERROR }
  const reason = startCheck({ ...table, status: 'open' })
  if (reason) return { data: null, error: reason }

  const players: GameSetup['players'] = []
  for (const p of table.players) {
    const { data: listed, error: cardsError } = await listDeckCards(db, p.deckId!)
    if (cardsError !== null) return { data: null, error: INTERNAL_ERROR }
    const cards = scryfall ? await fillCardStats(db, scryfall, listed) : listed
    players.push({ id: p.playerId, name: p.name, catalog: buildCatalog(p.deckId!, cards).catalog })
  }
  const setup: GameSetup = { format: table.format, players, options: { eliminatedSeeAll: table.eliminatedSeeAll } }

  // Places relues après la réservation : un premier joueur parti entre-temps est ignoré (tirage au sort).
  const first = firstPlayer !== undefined && table.players.some((p) => p.playerId === firstPlayer) ? { firstPlayer } : {}
  const body = { setup, hostId: table.hostPlayerId, ...first }
  let res = await init(tableId, body)
  // 409 : partie restée d'un essai précédent interrompu, alors que la table a été rouverte (places peut-être changées
  // depuis) : elle est défaite puis recréée avec les places actuelles.
  if (res.status === 409) {
    if (!(await destroyQuietly(destroy, tableId))) return { data: null, error: INTERNAL_ERROR }
    res = await init(tableId, body)
  }
  if (!res.ok) return { data: null, error: INTERNAL_ERROR }
  const { data: marked, error: markError } = await markPlaying(db, tableId)
  if (markError !== null) return { data: null, error: INTERNAL_ERROR }
  if (!marked) {
    // Table supprimée (par l'admin) pendant la création : la partie ne doit pas rester orpheline.
    if (!(await destroyQuietly(destroy, tableId))) console.error(`Partie ${tableId} orpheline : suppression impossible`)
    return { data: null, error: 'Table introuvable' }
  }
  const { data: started } = await getTable(db, tableId)
  return started ? { data: started, error: null } : { data: null, error: INTERNAL_ERROR }
}

/** Supprime la partie du serveur de jeu ; false en cas de refus ou d'exception (journalisée). */
async function destroyQuietly(destroy: DestroyGame, tableId: string): Promise<boolean> {
  try {
    return await destroy(tableId)
  } catch (e) {
    console.error(`Suppression de la partie ${tableId} impossible`, e)
    return false
  }
}
