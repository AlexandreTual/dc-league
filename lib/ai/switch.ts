// Interrupteur de l'assistant IA, réglé par les admins (activé par défaut).
import { getSetting, setSetting } from '@/lib/db-settings'
import type { Result } from '@/lib/db'

export const AI_SWITCH_KEY = 'ai_enabled'

/** Ligne absente ou base illisible (table pas encore créée) : activé. */
export async function isAiSwitchedOn(db: D1Database): Promise<boolean> {
  const { data, error } = await getSetting(db, AI_SWITCH_KEY)
  return error !== null || data !== '0'
}

export function setAiSwitch(db: D1Database, enabled: boolean, now: Date): Promise<Result<true>> {
  return setSetting(db, AI_SWITCH_KEY, enabled ? '1' : '0', now)
}
