// Serveurs ICE de la visio : STUN publics par défaut ; relais TURN de Cloudflare si le site en a les clés (docs/visio.md).

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] },
]

const isUrls = (v: unknown): v is string | string[] =>
  typeof v === 'string' || (Array.isArray(v) && v.length > 0 && v.every((u) => typeof u === 'string'))

/** Serveurs renvoyés par l'API TURN de Cloudflare (`iceServers` : objet ou liste), ou null si la réponse est inattendue. */
export function parseTurnResponse(json: unknown): RTCIceServer[] | null {
  const raw = json && typeof json === 'object' ? (json as { iceServers?: unknown }).iceServers : undefined
  const list = Array.isArray(raw) ? raw : raw ? [raw] : []
  const out: RTCIceServer[] = []
  for (const s of list) {
    if (!s || typeof s !== 'object' || !isUrls((s as RTCIceServer).urls)) continue
    const { username, credential } = s as RTCIceServer
    // Le port 53 fait patienter certains navigateurs jusqu'à l'expiration (conseil de Cloudflare) : écarté.
    const urls = ([] as string[]).concat((s as RTCIceServer).urls).filter((u) => !/:53(\?|$)/.test(u))
    if (urls.length === 0) continue
    out.push({ urls, ...(typeof username === 'string' ? { username } : {}), ...(typeof credential === 'string' ? { credential } : {}) })
  }
  return out.length > 0 ? out : null
}

export const TURN_TTL_SECONDS = 6 * 3600

/**
 * Serveurs ICE pour un joueur : identifiants TURN temporaires demandés à Cloudflare si `TURN_KEY_ID` et
 * `TURN_KEY_API_TOKEN` sont posés, toujours complétés des STUN publics ; STUN seuls sinon ou en cas d'échec.
 */
export async function iceServersFor(
  env: { TURN_KEY_ID?: string; TURN_KEY_API_TOKEN?: string }, fetcher: typeof fetch = fetch,
): Promise<RTCIceServer[]> {
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return DEFAULT_ICE_SERVERS
  try {
    const res = await fetcher(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: TURN_TTL_SECONDS }),
    })
    if (!res.ok) return DEFAULT_ICE_SERVERS
    const turn = parseTurnResponse(await res.json())
    return turn ? [...DEFAULT_ICE_SERVERS, ...turn] : DEFAULT_ICE_SERVERS
  } catch {
    return DEFAULT_ICE_SERVERS
  }
}
