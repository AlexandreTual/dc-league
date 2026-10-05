// D1 refuse une requête qui lie plus de 100 paramètres : les `IN (…)` se font par paquets.
export const IN_CHUNK = 50

export function chunks<T>(items: T[], size = IN_CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ')
}
