// Textes communs à tout le site (français, la référence).
export const common = {
  siteName: 'Commander League',
  siteDescription: 'Ligue Magic Commander entre amis : classement, decks, mode test et parties en ligne',
  close: 'Fermer',
  /** Partage natif d'un lien (lib/share.ts, components/ShareButton.tsx). */
  share: {
    button: 'Partager',
    /** « Table Commander à 4 de Ana, rejoins-moi » ; places et hôte peuvent manquer. */
    table: (format: string, seats: number | null, host: string | null) =>
      `Table ${format}${seats ? ` à ${seats}` : ''}${host ? ` de ${host}` : ''}, rejoins-moi`,
    league: (name: string | null) => (name ? `Rejoins la ligue ${name}` : 'Rejoins ma ligue Commander'),
  },
  cancel: 'Annuler',
  genericError: 'Une erreur est survenue',
  networkError: 'Erreur réseau',
  save: 'Enregistrer',
  loading: 'Chargement…',
}
