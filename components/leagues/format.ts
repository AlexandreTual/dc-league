import type { DbLeague } from '@/lib/db-leagues'

export function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** « Organisée par Ana », ou « Ligue du site » pour une ligue gérée par les admins. */
export function organizerLabel(league: Pick<DbLeague, 'owner_name'>): string {
  return league.owner_name ? `Organisée par ${league.owner_name}` : 'Ligue du site'
}

/** « En cours » ou « Terminée le 3 mai 2026 ». */
export function statusLabel(league: Pick<DbLeague, 'is_active' | 'ended_at'>): string {
  if (league.is_active) return 'En cours'
  return league.ended_at ? `Terminée le ${formatDate(league.ended_at)}` : 'Terminée'
}
