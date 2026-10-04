import { NextResponse } from 'next/server'

/** Refuse (403) une requête mutante venant d'un autre site : protection CSRF. */
export function assertSameOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get('origin')
  if (!origin) return null
  try {
    if (new URL(origin).host === new URL(req.url).host) return null
  } catch {
    // origine illisible : refusée
  }
  return NextResponse.json({ error: 'Origine refusée' }, { status: 403 })
}
