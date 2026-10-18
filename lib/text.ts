/**
 * Texte comparable pour une recherche : minuscules, sans accents, « œ » = « oe », « æ » = « ae »,
 * apostrophes typographiques (’ ‘ ʼ) ramenées à l'apostrophe droite.
 */
export function foldText(text: string): string {
  return text
    .replace(/[’‘ʼ]/g, "'") // avant les accents : « ʼ » compte parmi les diacritiques
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
}
