/** « ana@gmail.com » → « a…@gmail.com » : assez pour reconnaître l'adresse sans l'afficher en entier. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at <= 0) return '…'
  return `${email[0]}…${email.slice(at)}`
}
