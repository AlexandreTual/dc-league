// Dictionnaire français : la référence. Le type `Messages` en est tiré, l'anglais doit avoir exactement les mêmes clés.
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
import { site } from './site'

export const fr = { common, language, nav, table, menus, online, log, leagues, account, decks, admin, ai, errors, mail, site }

export type Messages = typeof fr
