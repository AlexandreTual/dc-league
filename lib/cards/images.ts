// Images de cartes Scryfall : « normal » (488 × 680) partout, « large » (672 × 936) pour les grands affichages.

/**
 * srcset proposant les deux tailles : avec `sizes`, le navigateur prend la plus petite qui reste nette
 * pour la taille affichée et la densité de l'écran (issue #20). Sans image large : pas de srcset.
 */
export function cardSrcSet(normal: string, large: string | null | undefined): string | undefined {
  return large ? `${normal} 488w, ${large} 672w` : undefined
}
