// Vérifie la page d'accueil et la navigation sur ordinateur : visiteur, joueur, admin.
// Usage : node scripts/home-nav-check.mjs http://localhost:8788 <dossier-captures>
// Prérequis : seed-online.mjs appliqué, u-e2e-1 admin (e2e-2 reste simple joueur), serveur de jeu lancé (npm run game:dev).
import { launch } from './browser.mjs'
import { mkdirSync } from 'node:fs'

const [base = 'http://localhost:8788', out = '/tmp/home-nav-check'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })

const browser = await launch()
let failures = 0
let tableToDelete = null
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
  const myLeagues = page.getByTestId('my-leagues')
  check(await page.getByRole('heading', { name: 'À toi de jouer' }).isVisible(), 'joueur : bloc « À toi de jouer » en haut')
  check(await myLeagues.getByText('Saison e2e').isVisible(), 'joueur : sa ligue en cours dans « Mes ligues en cours »')
  const blockY = (await page.getByRole('heading', { name: 'À toi de jouer' }).boundingBox()).y
  const titleY = (await page.getByRole('heading', { level: 1, name: 'Commander League' }).boundingBox()).y
  check(blockY < titleY, 'joueur : la présentation passe sous « À toi de jouer »')

  // Une table ouverte, puis une partie démarrée : « Retourner à la table », puis « Reprendre ».
  const chloe = await pageAs('e2e-3')
  const api = (who, path, data) => who.request.post(base + path, { headers: { Origin: base }, data: data ?? {} })
  const created = await (await api(page, '/api/games', { format: 'commander', seats: 2, eliminatedSeeAll: false })).json()
  await page.reload()
  const myTables = page.getByTestId('my-tables')
  check(await myTables.getByRole('link', { name: 'Retourner à la table' }).isVisible(), 'joueur : table ouverte → « Retourner à la table »')
  await api(page, `/api/games/${created.id}/deck`, { deckId: 'deck-e2e-2' })
  await api(chloe, `/api/games/${created.id}/join`)
  await api(chloe, `/api/games/${created.id}/deck`, { deckId: 'deck-e2e-3' })
  const started = await api(page, `/api/games/${created.id}/start`)
  check(started.ok(), `joueur : partie démarrée (${started.status()})`)
  await page.reload()
  const resume = myTables.getByRole('link', { name: 'Reprendre' })
  check(await resume.isVisible(), 'joueur : partie en cours → « Reprendre » sur l’accueil')
  check(await myTables.getByText('Avec Chloé').isVisible(), 'joueur : on voit avec qui il joue')
  await page.screenshot({ path: `${out}/accueil-joueur.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${out}/accueil-joueur-390.png`, fullPage: true })
  check(await page.evaluate(() => document.documentElement.scrollWidth <= 390), 'joueur 390 px : pas de défilement horizontal')
  await page.setViewportSize({ width: 1280, height: 900 })
  await resume.click()
  await page.waitForURL(`**/tables/${created.id}`)
  check(true, '« Reprendre » ouvre la table')
  await page.goto(base + '/')

  // Damien n'est pas assis : la table de Bastien n'apparaît pas dans son bloc.
  const damien = await pageAs('e2e-4')
  await damien.goto(base + '/')
  check((await damien.getByTestId('my-tables').count()) === 0, 'autre joueur : la table de Bastien n’est pas dans son bloc')
  await damien.context().close()
  await chloe.context().close()
  tableToDelete = created.id

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
  if (tableToDelete) {
    const res = await page.request.delete(`${base}/api/admin/games/${tableToDelete}`, { headers: { Origin: base } })
    check(res.ok(), 'admin : la partie de vérification est supprimée')
  }
  await page.context().close()
}

await browser.close()
console.log(failures ? `${failures} échec(s)` : 'Tout est bon')
process.exit(failures ? 1 : 0)
