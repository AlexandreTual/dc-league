// Dictionnaires de l'interface, par langue.
import type { Lang } from './lang'
import { en } from './messages/en'
import { fr, type Messages } from './messages/fr'

export type { Messages }
export { en, fr }

const BY_LANG: Record<Lang, Messages> = { fr, en }

export function messages(lang: Lang): Messages {
  return BY_LANG[lang]
}
