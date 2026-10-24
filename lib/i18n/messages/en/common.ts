import type { Messages } from '../fr'

export const common: Messages['common'] = {
  siteName: 'Commander League',
  siteDescription: 'Magic Commander league among friends: standings, decks, playtest and online games',
  close: 'Close',
  share: {
    button: 'Share',
    table: (format, seats, host) => `${format} table${seats ? ` for ${seats}` : ''}${host ? ` hosted by ${host}` : ''}, join me`,
    league: (name) => (name ? `Join the league ${name}` : 'Join my Commander league'),
  },
  cancel: 'Cancel',
  genericError: 'Something went wrong',
  networkError: 'Network error',
  save: 'Save',
  loading: 'Loading…',
}
