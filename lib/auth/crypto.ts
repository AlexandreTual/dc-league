// Hachage des mots de passe (PBKDF2-SHA256) et jetons aléatoires, via WebCrypto (compatible edge).

export const PBKDF2_ITERATIONS = 100_000 // maximum autorisé par Cloudflare Workers
const SALT_BYTES = 16
const KEY_BITS = 256
const TOKEN_BYTES = 32

const encoder = new TextEncoder()

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromBase64(s: string): Uint8Array<ArrayBuffer> | null {
  try {
    const raw = atob(s)
    const bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    KEY_BITS,
  )
  return new Uint8Array(bits)
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derive(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  if (!/^\d+$/.test(parts[1])) return false
  const iterations = Number(parts[1])
  if (iterations < 1 || iterations > PBKDF2_ITERATIONS) return false
  const salt = fromBase64(parts[2])
  const expected = fromBase64(parts[3])
  if (!salt || !expected || salt.length === 0 || expected.length === 0) return false
  const actual = await derive(password, salt, iterations)
  return constantTimeEqual(actual, expected)
}

let dummyHash: Promise<string> | null = null

/** Vérification factice pour un pseudo inconnu : égalise le temps de réponse. */
export async function verifyDummyPassword(password: string): Promise<void> {
  dummyHash ??= hashPassword('mot-de-passe-factice')
  await verifyPassword(password, await dummyHash)
}

export function generateToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)))
}

export async function hashToken(token: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token)))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}
