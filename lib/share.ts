/** Partage d'un lien (table, ligue) : texte prêt et choix entre partage natif et copie. */

export type ShareData = { title: string; text: string; url: string }

/** Ce dont le partage a besoin dans `navigator` (simulable dans les tests). */
export type ShareNavigator = {
  share?: (data: ShareData) => Promise<void>
  clipboard?: { writeText?: (text: string) => Promise<void> }
}

export type ShareResult = 'shared' | 'cancelled' | 'copied' | 'failed'

const FORMAT_LABELS: Record<string, string> = { commander: 'Commander', duel: 'Duel Commander' }

/** « Table Commander à 4 de Ana, rejoins-moi » ; chaque champ peut manquer. */
export function tableShareText({ format, seats, hostName }: { format?: string; seats?: number; hostName?: string | null }): string {
  const label = (format && FORMAT_LABELS[format]) || 'Commander'
  const places = typeof seats === 'number' && seats > 0 ? ` à ${seats}` : ''
  const host = hostName?.trim() ? ` de ${hostName.trim()}` : ''
  return `Table ${label}${places}${host}, rejoins-moi`
}

/** « Rejoins la ligue <nom> ». */
export function leagueShareText(name: string | null | undefined): string {
  return name?.trim() ? `Rejoins la ligue ${name.trim()}` : 'Rejoins ma ligue Commander'
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
