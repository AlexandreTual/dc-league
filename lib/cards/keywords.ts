// Capacités imprimées d'une carte (vol, contact mortel…), lues dans la liste de mots-clés de Scryfall.
//
// Scryfall donne une seule liste pour toute la carte, faces comprises, avec les mots-clés seulement cités
// (« Creatures you control have flying » compte « Flying »). On ne garde que ceux écrits sur une ligne de mots-clés
// du texte de la face : « Flying, vigilance », « Flying (rappel…) », « Ward {2} », « Protection from red ».

/** Le morceau de ligne est ce mot-clé, seul ou suivi de son paramètre ({2}, 3, —…, from…). */
function isKeyword(item: string, keyword: string): boolean {
  if (!item.startsWith(keyword)) return false
  const rest = item.slice(keyword.length)
  return rest === '' || /^\s*(—|\{|\d|x\b|from\b)/.test(rest)
}

/** Mots-clés de `keywords` (Scryfall) écrits sur une ligne de mots-clés de `text`, dans l'ordre de Scryfall. */
export function printedKeywords(keywords: string[], text: string | null): string[] {
  if (!text || keywords.length === 0) return []
  const found = new Set<string>()
  for (const line of text.split('\n')) {
    const items = line.replace(/\([^)]*\)/g, '').split(/[,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean)
    if (items.length === 0) continue
    const matched = items.map((item) => keywords.find((k) => isKeyword(item, k.toLowerCase())))
    // Ligne de mots-clés seulement : une phrase ordinaire (« Creatures you control have flying. ») ne compte pas.
    if (matched.every(Boolean)) for (const k of matched) found.add(k!)
  }
  return keywords.filter((k) => found.has(k))
}
