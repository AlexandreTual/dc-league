// Anciennes adresses de la ligue unique (/classement, /calendar, /playoffs) : liens partagés et favoris.

const PAGES = { classement: 'classement', calendar: 'calendrier', playoffs: 'playoffs' } as const

export type LegacyPage = keyof typeof PAGES

/** Page équivalente de la ligue mise en avant, ou la liste des ligues s'il n'y en a pas. */
export function legacyTarget(page: LegacyPage, featuredId: string | null): string {
  return featuredId ? `/ligues/${featuredId}/${PAGES[page]}` : '/ligues'
}
