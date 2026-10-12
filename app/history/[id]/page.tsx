import { permanentRedirect } from 'next/navigation'

export const runtime = 'edge'

/** Ancienne adresse d'une saison archivée. */
export default async function LegacyHistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  permanentRedirect(`/ligues/${encodeURIComponent(id)}`)
}
