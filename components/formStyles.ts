// Classes Tailwind partagées par les formulaires (reprises de l'ancienne page de connexion admin).
import { isLang } from '@/lib/i18n/lang'
import { messages } from '@/lib/i18n/messages'

export const inputClass =
  'w-full bg-dc-bg border border-dc-border rounded-xl px-4 py-2.5 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 transition-colors text-sm'
export const labelClass = 'block text-dc-muted text-xs mb-1.5'
export const cardClass = 'bg-dc-surface border border-dc-border rounded-2xl p-6 space-y-4'
export const primaryButtonClass =
  'w-full bg-dc-gold/20 hover:bg-dc-gold/30 border border-dc-gold/40 text-dc-gold font-fantasy font-semibold py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed'
export const errorClass = 'text-dc-red-light text-sm text-center bg-dc-red/20 border border-dc-red/30 rounded-lg px-3 py-2'
export const successClass =
  'text-dc-green-light text-sm text-center bg-dc-green/20 border border-dc-green/30 rounded-lg px-3 py-2'

/** Dictionnaire de la langue de la page (`<html lang>`, posé par la mise en page) ; français hors navigateur. */
function pageMessages() {
  const lang = typeof document === 'undefined' ? null : document.documentElement.lang
  return messages(isLang(lang) ? lang : 'fr')
}

/** Envoie du JSON et renvoie le message d'erreur de l'API (déjà traduit par la route), ou null si tout va bien. */
export async function sendJson(url: string, method: string, body?: unknown): Promise<{ error: string | null; data: unknown }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return res.ok ? { error: null, data } : { error: data.error ?? pageMessages().common.genericError, data }
  } catch {
    return { error: pageMessages().common.networkError, data: null }
  }
}
