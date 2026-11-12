// Barre du site et menu du compte.
export const nav = {
  league: 'Ligue',
  play: 'Jouer',
  myDecks: 'Mes decks',
  rules: 'Règles',
  login: 'Connexion',
  home: 'Commander League, accueil',
  openMenu: 'Ouvrir le menu',
  closeMenu: 'Fermer le menu',
  profile: 'Mon profil',
  admin: 'Administration',
  logout: 'Déconnexion',
  logoutFailed: (error: string) => `Déconnexion impossible : ${error}`,
  accountMenu: (name: string) => `Menu du compte de ${name}`,
  leagueTabs: 'Pages de la ligue',
  tabs: { standings: 'Classement', schedule: 'Calendrier', playoffs: 'Playoffs', manage: 'Gérer' },
}
