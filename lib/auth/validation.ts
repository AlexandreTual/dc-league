const USERNAME_RE = /^[A-Za-z0-9_.-]{3,32}$/

export function validateUsername(s: string): string | null {
  return USERNAME_RE.test(s) ? null : 'Le pseudo doit faire 3 à 32 caractères (lettres, chiffres, _ . -)'
}

export function validatePassword(s: string): string | null {
  if (s.length < 8) return 'Le mot de passe doit faire au moins 8 caractères'
  if (s.length > 200) return 'Le mot de passe est trop long'
  return null
}

const REDIRECT_BASE = 'https://dc-league.invalid'

/**
 * Chemin de redirection interne uniquement, sinon le salon.
 * Les navigateurs ignorent tabulations et retours à la ligne et lisent `\` comme `/` :
 * on les refuse, puis on vérifie que le chemin reste sur la même origine.
 */
export function safeRedirectPath(from: string | null | undefined): string {
  const fallback = '/salon'
  if (!from || !from.startsWith('/') || from.startsWith('//')) return fallback
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(from)) return fallback
  try {
    if (new URL(from, REDIRECT_BASE).origin !== REDIRECT_BASE) return fallback
  } catch {
    return fallback
  }
  return from
}

/** Pages d'où l'on ne revient pas après connexion (on y est déjà connecté ou elles n'ont plus de sens). */
const NO_RETURN = ['/connexion', '/invitation', '/mot-de-passe-oublie']

/** Lien « Connexion » qui ramène sur la page en cours une fois connecté. */
export function loginHref(pathname: string | null | undefined): string {
  if (!pathname || NO_RETURN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return '/connexion'
  return `/connexion?from=${encodeURIComponent(pathname)}`
}

/** Adresse saisie sans les espaces autour ; vide → null. */
export function normalizeEmail(s: string | null | undefined): string | null {
  const v = (s ?? '').trim()
  return v ? v : null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(s: string): string | null {
  return s.length <= 254 && EMAIL_RE.test(s) ? null : 'Adresse mail invalide'
}

// ── Champs saisis dans les routes API ─────────────────────────────────────────

export const MAX_LENGTH = { playerName: 50, deckName: 100, leagueName: 80, url: 500 } as const

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string }

const okValue = <T>(value: T): Checked<T> => ({ ok: true, value })
const invalid = <T>(error: string): Checked<T> => ({ ok: false, error })

/** Texte obligatoire : chaîne non vide une fois les espaces retirés, longueur bornée. */
export function requiredText(value: unknown, label: string, max: number): Checked<string> {
  if (typeof value !== 'string' || !value.trim()) return invalid(`${label} est requis`)
  const v = value.trim()
  if (v.length > max) return invalid(`${label} ne doit pas dépasser ${max} caractères`)
  return okValue(v)
}

/** Texte facultatif (undefined = inchangé), sinon mêmes règles que requiredText. */
export function optionalText(value: unknown, label: string, max: number): Checked<string | undefined> {
  return value === undefined ? okValue(undefined) : requiredText(value, label, max)
}

/** Identifiant transmis par le client : chaîne non vide et courte. */
export function requiredId(value: unknown, label: string): Checked<string> {
  if (typeof value !== 'string' || !value.trim() || value.length > 100) return invalid(`${label} est requis`)
  return okValue(value.trim())
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

/**
 * URL facultative (undefined = inchangée, vide ou null = effacée) : https uniquement,
 * sur l'un des domaines autorisés, longueur bornée.
 */
function optionalUrl(value: unknown, domains: readonly string[], error: string): Checked<string | null | undefined> {
  if (value === undefined) return okValue(undefined)
  if (value === null) return okValue(null)
  if (typeof value !== 'string') return invalid(error)
  const v = value.trim()
  if (!v) return okValue(null)
  if (v.length > MAX_LENGTH.url) return invalid(error)
  let url: URL
  try {
    url = new URL(v)
  } catch {
    return invalid(error)
  }
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || url.username || url.password || !domains.some((d) => hostMatches(host, d))) {
    return invalid(error)
  }
  return okValue(v)
}

export const DECK_LINK_ERROR = 'Le lien du deck doit être une adresse https Moxfield ou Archidekt'
export const CARD_IMAGE_ERROR = "L'image du commandant doit être une adresse https Scryfall"
export const AVATAR_ERROR = "L'avatar doit être une URL https"

/** Lien de deck : Moxfield ou Archidekt. */
export function optionalDeckLink(value: unknown): Checked<string | null | undefined> {
  return optionalUrl(value, ['moxfield.com', 'archidekt.com'], DECK_LINK_ERROR)
}

/** Image du commandant : Scryfall. */
export function optionalCardImage(value: unknown): Checked<string | null | undefined> {
  return optionalUrl(value, ['scryfall.io', 'scryfall.com'], CARD_IMAGE_ERROR)
}

/** Avatar : toute adresse https (le joueur choisit son hébergeur), longueur bornée. */
export function optionalAvatar(value: unknown): Checked<string | null | undefined> {
  if (value === undefined) return okValue(undefined)
  if (value === null) return okValue(null)
  if (typeof value !== 'string') return invalid(AVATAR_ERROR)
  const v = value.trim()
  if (!v) return okValue(null)
  if (v.length > MAX_LENGTH.url || !v.startsWith('https://')) return invalid(AVATAR_ERROR)
  return okValue(v)
}
