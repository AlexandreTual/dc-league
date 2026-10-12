import { redirect } from 'next/navigation'

export const runtime = 'edge'

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/ligues/${id}/classement`)
}
