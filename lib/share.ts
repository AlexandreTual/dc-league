/** Partage d'un lien (table, ligue) : texte prêt et choix entre partage natif et copie. */
import { fr, type Messages } from './i18n/messages'

export type ShareData = { title: string; text: string; url: string }

/** Ce dont le partage a besoin dans `navigator` (simulable dans les tests). */
export type ShareNavigator = {
  share?: (data: ShareData) => Promise<void>
  clipboard?: { writeText?: (text: string) => Promise<void> }
}

export type ShareResult = 'shared' | 'cancelled' | 'copied' | 'failed'

/** « Table Commander à 4 de Ana, rejoins-moi » ; chaque champ peut manquer. Dictionnaire `t` : langue de l'interface. */
export function tableShareText(
  { format, seats, hostName }: { format?: string; seats?: number; hostName?: string | null },
  t: Messages = fr,
): string {
  const label = (format && t.online.formats[format as keyof Messages['online']['formats']]) || 'Commander'
  const places = typeof seats === 'number' && seats > 0 ? seats : null
  return t.common.share.table(label, places, hostName?.trim() || null)
}

/** « Rejoins la ligue <nom> ». */
export function leagueShareText(name: string | null | undefined, t: Messages = fr): string {
  return t.common.share.league(name?.trim() || null)
}

/** Le navigateur propose-t-il le partage natif (téléphone, tablette) ? */
export function canShare(nav: ShareNavigator | undefined): boolean {
  return typeof nav?.share === 'function'
}

/**
 * Partage natif s'il existe (annulé ou refusé : rien ne se passe), sinon copie du lien.
 */
export async function shareOrCopy(nav: ShareNavigator | undefined, data: ShareData): Promise<ShareResult> {
  if (nav && canShare(nav)) {
    try {
      await nav.share!(data)
      return 'shared'
    } catch {
      return 'cancelled'
    }
  }
  try {
    if (typeof nav?.clipboard?.writeText !== 'function') return 'failed'
    await nav.clipboard.writeText(data.url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
