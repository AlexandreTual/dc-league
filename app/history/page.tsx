import { permanentRedirect } from 'next/navigation'

export const runtime = 'edge'

/** Ancienne adresse : les saisons terminées sont dans la liste des ligues. */
export default function LegacyHistoryPage() {
  permanentRedirect('/ligues')
}
