import type { Checked } from '@/lib/auth/validation'
import type { LeagueVisibility } from '@/lib/db-leagues'

export const VISIBILITY_INVALID = 'Visibilité invalide : publique ou privée.'

export function parseVisibility(v: unknown): Checked<LeagueVisibility> {
  return v === 'public' || v === 'private' ? { ok: true, value: v } : { ok: false, error: VISIBILITY_INVALID }
}
