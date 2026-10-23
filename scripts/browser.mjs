// Lancement de Chromium commun aux scripts navigateur (playwright-core).
// Chemin : variable CHROME, sinon CHROMIUM_PATH (ancien nom), sinon le Chromium de l'environnement de dev.
import { chromium } from 'playwright-core'

export const executablePath = process.env.CHROME ?? process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

/** `chromium.launch` avec le chemin ci-dessus ; les autres options passent telles quelles. */
export function launch(options = {}) {
  return chromium.launch({ executablePath, ...options })
}
