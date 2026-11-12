// Lancement de Chromium commun aux scripts navigateur (playwright-core).
// Chemin : variable CHROME, sinon CHROMIUM_PATH (ancien nom), sinon le Chromium de l'environnement de dev.
import { chromium } from 'playwright-core'

export const executablePath = process.env.CHROME ?? process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

/**
 * `chromium.launch` avec le chemin ci-dessus ; les autres options passent telles quelles.
 * Les pages et contextes s'ouvrent avec un navigateur en français (la langue du site en est déduite),
 * sauf si le script passe sa propre `locale`.
 */
export async function launch(options = {}) {
  const browser = await chromium.launch({ executablePath, ...options })
  const newContext = browser.newContext.bind(browser)
  const newPage = browser.newPage.bind(browser)
  browser.newContext = (o = {}) => newContext({ locale: 'fr-FR', ...o })
  browser.newPage = (o = {}) => newPage({ locale: 'fr-FR', ...o })
  return browser
}
