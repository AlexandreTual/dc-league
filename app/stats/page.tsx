import { permanentRedirect } from 'next/navigation'

export const runtime = 'edge'

/** Ancienne adresse des statistiques. */
export default function LegacyStatsPage() {
  permanentRedirect('/ligues/statistiques')
}
