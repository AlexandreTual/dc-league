import { redirectLegacy } from '@/lib/leagues/legacy-redirect'

export const runtime = 'edge'

/** Ancienne adresse de la ligue unique. */
export default function LegacyPage() {
  return redirectLegacy('classement')
}
