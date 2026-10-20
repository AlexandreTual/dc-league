// Langue de l'interface de la requête en cours (pages serveur, layout, routes API).
import { cookies, headers } from 'next/headers'
import { pickLang, UI_LANG_COOKIE, type Lang } from './lang'
import { messages, type Messages } from './messages'

export async function getLang(): Promise<Lang> {
  const [jar, head] = await Promise.all([cookies(), headers()])
  return pickLang(jar.get(UI_LANG_COOKIE)?.value, head.get('accept-language'))
}

export async function getMessages(): Promise<Messages> {
  return messages(await getLang())
}
