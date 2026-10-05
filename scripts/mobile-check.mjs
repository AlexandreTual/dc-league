// Vérifie l'affichage à 375 px de large (téléphone) : pas de défilement horizontal, menu repliable,
// confirmations de l'admin avec texte, bouton « Réinitialiser le score » visible.
// Usage : node scripts/mobile-check.mjs http://localhost:8788 <dossier-captures>
// Prérequis : seed-online.mjs appliqué, u-e2e-1 admin et une saison active avec au moins un match joué.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const [base = 'http://localhost:8788', out = '/tmp/mobile-check'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })
await context.addCookies([{ name: 'dc_session', value: 'jeton-de-test-e2e-1', url: base }])
const page = await context.newPage()

let failures = 0
function check(ok, label) {
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  if (!ok) failures++
}
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

// Accueil connecté
await page.goto(base + '/')
check((await overflow()) <= 0, `accueil : pas de défilement horizontal (${await overflow()} px en trop)`)
await page.screenshot({ path: `${out}/accueil.png`, fullPage: true })
const menuButton = page.getByRole('button', { name: 'Ouvrir le menu' })
check(await menuButton.isVisible(), 'accueil : bouton « Ouvrir le menu » visible')
await menuButton.click()
check(await page.locator('#menu-principal').getByRole('link', { name: 'Calendrier' }).isVisible(), 'menu ouvert : lien Calendrier visible')
check(await page.locator('#menu-principal').getByRole('link', { name: 'Admin' }).isVisible(), 'menu ouvert : lien Admin visible')
check((await overflow()) <= 0, 'menu ouvert : pas de défilement horizontal')
await page.screenshot({ path: `${out}/accueil-menu.png` })
await page.locator('#menu-principal').getByRole('link', { name: 'Admin' }).click()
await page.waitForURL('**/admin')
check(!(await page.locator('#menu-principal').isVisible()), 'le menu se referme après navigation')

// Admin
check((await overflow()) <= 0, `admin : pas de défilement horizontal (${await overflow()} px en trop)`)
await page.screenshot({ path: `${out}/admin.png`, fullPage: true })
const reset = page.getByRole('button', { name: 'Réinitialiser le score' }).first()

// Chromium sans écran se déclare « hover: hover » même en mode mobile : un onglet à part impose l'écran
// tactile (une capture d'écran Playwright annule cette émulation, d'où la mesure sans capture).
{
  const touchPage = await context.newPage()
  const cdp = await context.newCDPSession(touchPage)
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }] })
  await touchPage.goto(base + '/admin')
  const opacity = await touchPage
    .getByRole('button', { name: 'Réinitialiser le score' })
    .first()
    .evaluate((el) => `${getComputedStyle(el).opacity}${matchMedia('(hover: hover)').matches ? ', hover: hover' : ''}`)
  check(opacity === '1', `admin : « Réinitialiser le score » visible sur tactile (opacité ${opacity})`)
  await touchPage.close()
}
let dialog = ''
page.once('dialog', (d) => {
  dialog = d.message()
  d.dismiss()
})
await reset.click()
await page.waitForTimeout(300)
check(dialog === 'Réinitialiser ce score ?', `admin : confirmation demandée (« ${dialog} »)`)

await page.getByRole('button', { name: 'Réinitialiser la ligue' }).click()
check(await page.getByText('Scores perdus !').isVisible(), 'admin : texte « Scores perdus ! » visible')
await page.screenshot({ path: `${out}/admin-confirmation-ligue.png` })
await page.getByRole('button', { name: 'Non' }).first().click()
await page.getByRole('button', { name: 'Supprimer la saison' }).first().click()
check(await page.getByText('Supprimer la saison ?').first().isVisible(), 'admin : texte « Supprimer la saison ? » visible')
check((await overflow()) <= 0, 'admin, confirmation ouverte : pas de défilement horizontal')
await page.screenshot({ path: `${out}/admin-confirmation-saison.png` })

await browser.close()
console.log(failures ? `${failures} échec(s)` : 'Tout est bon')
process.exit(failures ? 1 : 0)
