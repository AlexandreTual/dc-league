const USERNAME_RE = /^[A-Za-z0-9_.-]{3,32}$/

export function validateUsername(s: string): string | null {
  return USERNAME_RE.test(s) ? null : 'Le pseudo doit faire 3 à 32 caractères (lettres, chiffres, _ . -)'
}

export function validatePassword(s: string): string | null {
  if (s.length < 8) return 'Le mot de passe doit faire au moins 8 caractères'
  if (s.length > 200) return 'Le mot de passe est trop long'
  return null
}

/** Chemin de redirection interne uniquement, sinon /profil. */
export function safeRedirectPath(from: string | null | undefined): string {
  if (!from || !from.startsWith('/') || from.startsWith('//') || from.startsWith('/\\')) return '/profil'
  return from
}
