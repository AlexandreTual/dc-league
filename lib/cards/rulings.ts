// Règles officielles (« rulings ») d'une carte : cache D1 par oracle_id, rafraîchi depuis Scryfall.
import { findCardIdByOracle, getStoredRulings, saveRulings } from '@/lib/db-cards'
import { ScryfallUnavailableError, type ScryfallClient } from './scryfall'
import type { Ruling } from './types'

/** Au-delà, les règles en cache sont redemandées à Scryfall. */
export const RULINGS_MAX_AGE_MS = 7 * 24 * 3600 * 1000

export const RULINGS_UNAVAILABLE = 'Règles indisponibles pour le moment'

export type RulingsResult =
  | { status: 'ok'; rulings: Ruling[] }
  /** Carte absente du cache : la route ne sert que les cartes déjà importées. */
  | { status: 'unknown' }
  | { status: 'unavailable' }

/** Forme d'un identifiant Oracle (UUID Scryfall ; les données de test en utilisent de plus courts). */
export function isOracleId(value: string): boolean {
  return /^[0-9a-z-]{1,64}$/.test(value)
}

/**
 * Règles d'une carte. En cache et récentes : servies telles quelles. Sinon demandées à Scryfall ;
 * si Scryfall ne répond pas, une version périmée vaut mieux que rien.
 */
export async function loadRulings(
  db: D1Database,
  client: Pick<ScryfallClient, 'fetchRulings'>,
  oracleId: string,
  now: Date,
): Promise<RulingsResult> {
  // Cache illisible (table pas encore créée, juste après un déploiement) : on fait comme s'il était vide.
  const stored = await getStoredRulings(db, oracleId)
  const cached = stored.error === null ? stored.data : null
  if (cached && now.getTime() - Date.parse(cached.fetched_at) < RULINGS_MAX_AGE_MS) return { status: 'ok', rulings: cached.rulings }

  const card = await findCardIdByOracle(db, oracleId)
  if (card.error !== null) return cached ? { status: 'ok', rulings: cached.rulings } : { status: 'unavailable' }
  if (!card.data) return { status: 'unknown' }

  try {
    const rulings = await client.fetchRulings(card.data)
    await saveRulings(db, oracleId, rulings, now) // échec sans conséquence : redemandées la prochaine fois
    return { status: 'ok', rulings }
  } catch (e) {
    if (!(e instanceof ScryfallUnavailableError)) throw e
    console.warn('[rulings]', oracleId, e.message)
    return cached ? { status: 'ok', rulings: cached.rulings } : { status: 'unavailable' }
  }
}
