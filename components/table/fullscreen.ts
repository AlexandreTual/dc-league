/** Vrai plein écran du navigateur (API Fullscreen), comme F11 : la page entière, onglets et barre d'adresse masqués. */

export const FULLSCREEN_REFUSED = 'Le navigateur a refusé le plein écran.'

/** Le strict nécessaire de `document` (testable sans navigateur). */
export interface FullscreenDoc {
  fullscreenElement: unknown
  exitFullscreen: () => Promise<void>
  documentElement: { requestFullscreen?: () => Promise<void> }
}

export const isFullscreen = (doc: FullscreenDoc) => !!doc.fullscreenElement

/** Entre ou sort du plein écran ; renvoie un message d'erreur en français, ou `null`. */
export async function toggleFullscreen(doc: FullscreenDoc): Promise<string | null> {
  try {
    if (isFullscreen(doc)) await doc.exitFullscreen()
    else if (doc.documentElement.requestFullscreen) await doc.documentElement.requestFullscreen()
    else return FULLSCREEN_REFUSED // iPhone : pas d'API Fullscreen hors vidéo
    return null
  } catch {
    return FULLSCREEN_REFUSED
  }
}
