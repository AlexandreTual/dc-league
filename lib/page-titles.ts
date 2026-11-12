// Titres d'onglet des pages qui dépendent des données (« Kenrith · Deck », « Classement · Saison 3 »).
// Le modèle « %s · Commander League » est posé par app/layout.tsx.
import type { Metadata } from 'next'
import type { CurrentUser } from '@/lib/auth/types'
import { getDeck } from '@/lib/db-decks'
import { getTable } from '@/lib/db-games'
import { resolveLeagueAccess } from '@/lib/leagues/route-access'

export const SITE_NAME = 'Commander League'
export const SITE_DESCRIPTION = 'Ligue Magic Commander entre amis : classement, decks importés, mode test et parties en ligne de 2 à 5 joueurs.'

/**
 * Titre d'une page de ligue : son nom seulement si la personne qui consulte la voit (une ligue privée
 * ne donne jamais son nom à un non-membre, ni à l'aperçu d'un lien partagé). `section` : onglet affiché.
 */
export async function leagueMetadata(db: D1Database, id: string, user: CurrentUser | null, section?: string): Promise<Metadata> {
  const access = await resolveLeagueAccess(db, id, user)
  const name = typeof access === 'object' && 'league' in access ? access.league.name : null
  if (!name) return { title: section ?? 'Ligue' }
  return { title: section ? `${section} · ${name}` : name }
}

/** Page publique d'un deck : « <nom> · Deck ». */
export async function deckMetadata(db: D1Database, id: string, section = 'Deck'): Promise<Metadata> {
  const { data: deck } = await getDeck(db, id)
  return { title: deck ? `${deck.name} · ${section}` : section }
}

/** Table en ligne : « Table de <hôte> » pour un joueur connecté ; rien de la table pour un visiteur. */
export async function tableMetadata(db: D1Database, id: string, user: CurrentUser | null): Promise<Metadata> {
  if (!user || user.isBootstrap) return { title: 'Partie en ligne' }
  const { data: table } = await getTable(db, id)
  const host = table?.players.find((p) => p.playerId === table.hostPlayerId)?.name
  return { title: host ? `Table de ${host}` : 'Partie en ligne' }
}
