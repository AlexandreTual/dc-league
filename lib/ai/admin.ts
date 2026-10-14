// État de l'assistant IA pour le tableau de bord admin.
import { getAiUsageOfDay } from '@/lib/db-ai'
import { parisDay } from './quota'
import { isAiSwitchedOn } from './switch'

export type AiAdminStatus = { enabled: boolean; keyPresent: boolean; today: { questions: number; players: number } }

export async function aiAdminStatus(env: CloudflareEnv, now: Date): Promise<AiAdminStatus> {
  const usage = await getAiUsageOfDay(env.DB, parisDay(now))
  return {
    enabled: await isAiSwitchedOn(env.DB),
    keyPresent: Boolean(env.GEMINI_API_KEY),
    today: usage.data ?? { questions: 0, players: 0 },
  }
}
