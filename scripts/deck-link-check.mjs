// Import en un clic dans un vrai navigateur : création (nom + lien) → import Scryfall direct, erreurs, repli par liste collée.
// Les routes d'import sont simulées (pas d'appel réseau à Moxfield, Archidekt ni Scryfall).
// Prérequis : site lancé (`wrangler pages dev --port 8788`), données de scripts/seed-online.mjs chargées.
// Usage : node scripts/deck-link-check.mjs <url-de-base> <dossier-captures>
import { chromium } from 'playwright-core'
import { PLAYERS, tokenOf } from './seed-online.mjs'

const [base = 'http://localhost:8788', outDir = '.'] = process.argv.slice(2)
const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [ANA] = PLAYERS

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

const text = ['Commander', '1 Kenrith, the Returned King (eld) 303', '', 'Deck', '1 Sol Ring (c21) 263', '30 Forest (eld) 266'].join('\n')
const summary = { total: 32, commanders: 1, frenchCount: 31, notFound: [], ignored: 0, errors: [] }
const slow = (json, status = 200) => (route) => setTimeout(() => route.fulfill({ status, json }), 300)

const browser = await chromium.launch({ executablePath })
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  await context.addCookies([{ name: 'dc_session', value: tokenOf(ANA.id), url: base }])
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())

  const calls = []
  await page.route('**/import/link', (route) => { calls.push('link'); slow({ text, name: 'Kenrith go wide' })(route) })
  await page.route('**/import/resolve', (route) => { calls.push('resolve'); slow({ ok: true })(route) })
  await page.route('**/import/commit', (route) => { calls.push('commit'); slow(summary)(route) })

  await page.goto(`${base}/profil/decks`)

  // 1. Création : nom + lien, un seul bouton, et l'import part tout seul.
  await page.getByPlaceholder('Kenrith').fill('Kenrith à importer')
  await page.getByPlaceholder('https://moxfield.com/decks/…').last().fill('https://archidekt.com/decks/42/kenrith')
  const create = page.getByRole('button', { name: 'Créer et importer' })
  check(await create.isVisible(), 'avec un lien, le bouton devient « Créer et importer »')
  await create.click()
  const row = page.locator('li', { hasText: 'Kenrith à importer' })
  await row.getByTestId('import-progress').waitFor()
  check(true, 'la progression s’affiche sous le deck')
  await page.screenshot({ path: `${outDir}/deck-import-progress.png` })
  await row.getByTestId('import-done').getByText('32 cartes').waitFor()
  check(calls.join(',') === 'link,resolve,commit', `lien → Scryfall → enregistrement, sans autre clic (${calls.join(', ')})`)
  check(await row.getByText('97 % en français').isVisible(), 'résumé : 97 % en français')
  check(await row.getByRole('link', { name: 'Voir le deck →' }).isVisible(), 'lien « Voir le deck »')
  await page.screenshot({ path: `${outDir}/deck-import-done.png`, fullPage: true })
  console.log(`📸 ${outDir}/deck-import-done.png`)

  // 1 bis. Page du deck : « Réimporter » relance l'import sur place, sans renvoyer vers la liste des decks.
  const deckHref = await row.getByRole('link', { name: 'Voir le deck →' }).getAttribute('href')
  await page.goto(`${base}${deckHref}`)
  check(await page.getByRole('link', { name: 'Archidekt' }).isVisible(), 'page du deck : le lien affiche « Archidekt » (et non « Moxfield »)')
  calls.length = 0
  await page.getByRole('button', { name: /^(Réimporter|Importer)$/ }).click()
  await page.getByTestId('reimport-done').getByText('32 cartes importées · 97 % en français').waitFor()
  check(new URL(page.url()).pathname === deckHref, 'page du deck : on reste sur la page')
  check(calls.join(',') === 'link,resolve,commit', `page du deck : réimport direct (${calls.join(', ')})`)
  await page.screenshot({ path: `${outDir}/deck-reimport.png` })

  // 2. Le site refuse la lecture : message sur la page du deck, puis repli par liste collée.
  await page.unroute('**/import/link')
  await page.route('**/import/link', slow({ error: 'Moxfield refuse la lecture de ce deck' }, 502))
  calls.length = 0
  await page.getByRole('button', { name: /^(Réimporter|Importer)$/ }).click()
  await page.getByText('Moxfield refuse la lecture de ce deck').waitFor()
  check(!calls.includes('resolve'), 'erreur du lien : pas d’appel à Scryfall, message affiché')
  await page.getByRole('button', { name: 'Coller la liste à la place' }).click()
  check(await page.getByLabel('Liste du deck').isVisible(), 'repli : zone pour coller la liste')
  await page.screenshot({ path: `${outDir}/deck-import-error.png` })

  // 3. Liste des decks : plus de bouton d'import, le nom mène à la page du deck.
  await page.goto(`${base}/profil/decks`)
  check(await page.getByRole('button', { name: /^Importer/ }).count() === 0, 'Mes decks : plus de bouton « Importer »')
  await page.screenshot({ path: `${outDir}/deck-list.png`, fullPage: true })
  const seeded = page.locator('li', { hasText: `Kenrith de ${ANA.name}` })

  // 4. Deck sans lien : « Réimporter » sur sa page ouvre la zone de collage.
  await seeded.getByRole('link', { name: `Kenrith de ${ANA.name}` }).click()
  await page.waitForURL(/\/decks\/deck-/)
  await page.getByRole('button', { name: /^(Réimporter|Importer)$/ }).click()
  check(await page.getByLabel('Liste du deck').isVisible(), 'deck sans lien : la zone de collage s’ouvre sur sa page')
  await page.getByLabel('Liste du deck').fill(text)
  check(await page.getByText(/32 cartes · 1 commandant\(s\)/).isVisible(), 'la liste collée est lue : 32 cartes, 1 commandant')

  await page.goto(`${base}/profil/decks`)
  // Ménage : supprime le deck créé.
  while (await row.count()) {
    const before = await row.count()
    await row.first().getByRole('button', { name: 'Supprimer Kenrith à importer' }).click()
    await page.waitForFunction((n) => document.querySelectorAll('li').length < n, await page.locator('li').count())
    if ((await row.count()) >= before) break
  }

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ' : ' + errors.join(' | ') : ''}`)
  console.log('\nTout est OK')
} finally {
  await browser.close()
}
