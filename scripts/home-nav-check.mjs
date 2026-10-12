// Vérifie la page d'accueil et la navigation sur ordinateur : visiteur, joueur, admin.
// Usage : node scripts/home-nav-check.mjs http://localhost:8788 <dossier-captures>
// Prérequis : seed-online.mjs appliqué, u-e2e-1 admin (e2e-2 reste simple joueur).
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const [base = 'http://localhost:8788', out = '/tmp/home-nav-check'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
let failures = 0
function check(ok, label) {
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  if (!ok) failures++
}
async function pageAs(playerId) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  if (playerId) await context.addCookies([{ name: 'dc_session', value: `jeton-de-test-${playerId}`, url: base }])
  return context.newPage()
}
const barLinks = (page) => page.locator('nav').first().locator('a').allInnerTexts()

// Visiteur
{
  const page = await pageAs(null)
  await page.goto(base + '/')
  check(await page.getByRole('heading', { level: 1, name: 'Commander League' }).isVisible(), 'visiteur : titre de la présentation')
  check(await page.getByRole('heading', { name: 'Sur le site' }).isVisible(), 'visiteur : rubriques du site')
  check((await page.getByText('Se connecter pour y accéder').count()) === 3, 'visiteur : decks, mode test et salon demandent la connexion')
  const links = (await barLinks(page)).map((t) => t.trim()).filter(Boolean)
  check(JSON.stringify(links) === JSON.stringify(['Commander League', 'Ligue', 'Règles', 'Connexion']), `visiteur : barre « ${links.join(' · ')} »`)
  await page.screenshot({ path: `${out}/accueil-visiteur.png`, fullPage: true })
  await page.getByRole('link', { name: /Ouvrir le salon|Les parties en ligne/ }).first().click()
  await page.waitForURL((url) => url.pathname === '/connexion' && url.searchParams.get('from') === '/salon')
  check(true, 'visiteur : la rubrique « parties en ligne » mène à la connexion')
  await page.context().close()
}

// Joueur
{
  const page = await pageAs('e2e-2')
  await page.goto(base + '/')
  const links = (await barLinks(page)).map((t) => t.trim()).filter(Boolean)
  check(JSON.stringify(links) === JSON.stringify(['Commander League', 'Ligue', 'Jouer', 'Mes decks', 'Règles']), `joueur : barre « ${links.join(' · ')} »`)
  check(await page.getByText('Content de te revoir, Bastien.').isVisible(), 'joueur : accueil personnalisé')
  check((await page.getByText('Se connecter pour y accéder').count()) === 0, 'joueur : aucune rubrique verrouillée')
  await page.screenshot({ path: `${out}/accueil-joueur.png`, fullPage: true })

  await page.getByRole('button', { name: /^Menu du compte/ }).click()
  check((await page.getByRole('link', { name: 'Administration' }).count()) === 0, "joueur : pas d'administration dans le menu du compte")
  await page.keyboard.press('Escape')

  await page.locator('nav').first().getByRole('link', { name: 'Ligue' }).click()
  await page.waitForURL('**/ligues')
  check(await page.getByRole('heading', { name: 'Mes ligues' }).isVisible(), 'ligues : section « Mes ligues »')
  await page.getByRole('link', { name: /Saison e2e/ }).first().click()
  await page.waitForURL('**/ligues/*/classement')
  const tabs = page.getByRole('navigation', { name: 'Pages de la ligue' })
  check(await tabs.isVisible(), 'ligue : onglets visibles')
  const tabNames = await tabs.locator('a').allInnerTexts()
  check(JSON.stringify(tabNames) === JSON.stringify(['Classement', 'Calendrier']), `ligue : onglets « ${tabNames.join(' · ')} » (pas de « Gérer » pour un joueur)`)
  check((await tabs.getByRole('link', { name: 'Classement' }).getAttribute('aria-current')) === 'page', 'ligue : onglet Classement actif')
  await tabs.getByRole('link', { name: 'Calendrier' }).click()
  await page.waitForURL('**/ligues/*/calendrier')
  check((await tabs.getByRole('link', { name: 'Calendrier' }).getAttribute('aria-current')) === 'page', 'ligue : onglet Calendrier actif')
  check((await page.locator('nav').first().getByRole('link', { name: 'Ligue' }).getAttribute('aria-current')) === 'page', 'barre : « Ligue » reste actif sur le calendrier')
  await page.waitForTimeout(300) // fin de la transition de couleur des onglets
  await page.screenshot({ path: `${out}/ligue-calendrier.png` })
  await page.context().close()
}

// Admin
{
  const page = await pageAs('e2e-1')
  await page.goto(base + '/')
  check(!(await barLinks(page)).some((t) => /Admin/.test(t)), "admin : pas d'administration dans la barre")
  await page.getByRole('button', { name: /^Menu du compte/ }).click()
  await page.getByRole('link', { name: 'Administration' }).click()
  await page.waitForURL('**/admin')
  check(true, 'admin : administration ouverte depuis le menu du compte')
  await page.context().close()
}

await browser.close()
console.log(failures ? `${failures} échec(s)` : 'Tout est bon')
process.exit(failures ? 1 : 0)
