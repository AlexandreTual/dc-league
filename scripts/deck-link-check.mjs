// Import par lien dans un vrai navigateur : lien refusé, site injoignable, liste récupérée (réponse simulée).
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

const browser = await chromium.launch({ executablePath })
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.addCookies([{ name: 'dc_session', value: tokenOf(ANA.id), url: base }])
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto(`${base}/profil/decks`)
  await page.getByRole('button', { name: 'Importer la liste' }).first().click()
  const input = page.getByLabel('Lien du deck')
  const fetchButton = page.getByRole('button', { name: 'Récupérer' })

  await input.fill('https://example.com/decks/abc')
  await fetchButton.click()
  await page.getByTestId('link-error').getByText('Lien non reconnu (Moxfield ou Archidekt)').waitFor()
  check(true, 'lien d’un autre site : « Lien non reconnu »')

  // Le serveur appelle vraiment Moxfield : sans accès réseau (ou refusé par Moxfield), le repli s'affiche.
  await input.fill('https://www.moxfield.com/decks/AbC12')
  await fetchButton.click()
  const error = page.getByTestId('link-error')
  await error.waitFor({ timeout: 20_000 })
  check(/Moxfield refuse|introuvable/.test(await error.innerText()), `Moxfield injoignable ou refusé : « ${await error.innerText()} »`)

  // Réponse simulée de la route : la liste remplit la zone de texte, l'import reste à lancer.
  const text = ['Commander', '1 Kenrith, the Returned King (eld) 303', '', 'Deck', '1 Sol Ring (c21) 263', '30 Forest (eld) 266'].join('\n')
  await page.route('**/import/link', (route) => route.fulfill({ json: { text, name: 'Kenrith go wide' } }))
  await input.fill('https://archidekt.com/decks/42/kenrith')
  await fetchButton.click()
  await page.getByTestId('link-ok').getByText('« Kenrith go wide »').waitFor()
  check((await page.locator('textarea').inputValue()) === text, 'la liste récupérée remplit la zone de texte')
  check(await page.getByText(/32 cartes · 1 commandant\(s\)/).isVisible(), 'elle est lue par l’import : 32 cartes, 1 commandant')
  await page.screenshot({ path: `${outDir}/deck-link.png`, fullPage: true })
  console.log(`📸 ${outDir}/deck-link.png`)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${outDir}/deck-link-mobile.png` })
  console.log(`📸 ${outDir}/deck-link-mobile.png`)

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ' : ' + errors.join(' | ') : ''}`)
  console.log('\nTout est OK')
} finally {
  await browser.close()
}
