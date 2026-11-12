/** Vrai plein écran du navigateur (API Fullscreen), comme F11 : la page entière, onglets et barre d'adresse masqués. */
import type { Messages } from '@/lib/i18n/messages'

/** Le strict nécessaire de `document` (testable sans navigateur). */
export interface FullscreenDoc {
  fullscreenElement: unknown
  exitFullscreen: () => Promise<void>
  documentElement: { requestFullscreen?: () => Promise<void> }
}

export const isFullscreen = (doc: FullscreenDoc) => !!doc.fullscreenElement

/** Entre ou sort du plein écran ; renvoie un message d'erreur dans la langue de `t`, ou `null`. */
export async function toggleFullscreen(doc: FullscreenDoc, t: Messages): Promise<string | null> {
  const refused = t.table.bar.fullscreenRefused
  try {
    if (isFullscreen(doc)) await doc.exitFullscreen()
    else if (doc.documentElement.requestFullscreen) await doc.documentElement.requestFullscreen()
    else return refused // iPhone : pas d'API Fullscreen hors vidéo
    return null
  } catch {
    return refused
  }
}
