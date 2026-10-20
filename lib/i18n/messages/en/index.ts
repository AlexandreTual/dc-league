// Dictionnaire anglais : mêmes clés que le français (vérifié par TypeScript).
import type { Messages } from '../fr'
import { common } from './common'
import { language } from './language'
import { nav } from './nav'
import { table } from './table'
import { menus } from './menus'
import { online } from './online'
import { log } from './log'
import { leagues } from './leagues'
import { account } from './account'
import { decks } from './decks'
import { admin } from './admin'
import { ai } from './ai'
import { errors } from './errors'
import { mail } from './mail'

export const en: Messages = { common, language, nav, table, menus, online, log, leagues, account, decks, admin, ai, errors, mail }
