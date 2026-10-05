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
 * Chemin de redirection interne uniquement, sinon /profil.
 * Les navigateurs ignorent tabulations et retours à la ligne et lisent `\` comme `/` :
 * on les refuse, puis on vérifie que le chemin reste sur la même origine.
 */
export function safeRedirectPath(from: string | null | undefined): string {
  if (!from || !from.startsWith('/') || from.startsWith('//')) return '/profil'
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(from)) return '/profil'
  try {
    if (new URL(from, REDIRECT_BASE).origin !== REDIRECT_BASE) return '/profil'
  } catch {
    return '/profil'
  }
  return from
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
