import type { Messages } from '../fr'

export const nav: Messages['nav'] = {
  league: 'League',
  play: 'Play',
  myDecks: 'My decks',
  rules: 'Rules',
  login: 'Log in',
  home: 'Commander League, home',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  profile: 'My profile',
  admin: 'Admin',
  logout: 'Log out',
  logoutFailed: (error: string) => `Could not log out: ${error}`,
  accountMenu: (name: string) => `${name}'s account menu`,
  leagueTabs: 'League pages',
  tabs: { standings: 'Standings', schedule: 'Schedule', playoffs: 'Playoffs', manage: 'Manage' },
}
