// Vérification du mode test sur téléphone (375 × 812, écran tactile), dans Chromium piloté par playwright-core.
// Usage : node scripts/playtest-mobile-check.mjs <url-de-base> <deckId> <dossier-captures>
import { chromium } from 'playwright-core'

const [base = 'http://localhost:8788', deckId, outDir = '.'] = process.argv.slice(2)
if (!deckId) throw new Error('deckId manquant')

const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const browser = await chromium.launch({ executablePath })
const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })
const page = await context.newPage()
const cdp = await context.newCDPSession(page)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

let shot = 0
async function capture(label) {
  shot++
  await page.waitForTimeout(300) // laisser finir les animations
  const path = `${outDir}/mobile-${shot}-${label}.png`
  await page.screenshot({ path })
  console.log(`📸 ${path}`)
}

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

/** Appui long au doigt au centre d'un élément (événements tactiles réels, donc aussi pointer*). */
async function longPress(locator, ms = 700) {
  const box = await locator.boundingBox()
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
  await page.waitForTimeout(ms)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(150)
}

const hand = page.locator('[data-zone="hand"] [data-card-id]')
const library = page.locator('[data-board] [data-zone="library"]').first()
const libraryCount = async () => Number((await library.innerText()).match(/\((\d+)\)/)[1])
const menu = page.getByRole('menu')

/** Le menu tient dans l'écran (jamais au-dessus du bord haut). */
async function menuInScreen() {
  const box = await menu.boundingBox()
  return box.y >= 0 && box.x >= 0 && box.x + box.width <= 375 && box.y + box.height <= 812
}

try {
  await page.goto(`${base}/decks/${deckId}`)
  await page.evaluate((id) => localStorage.removeItem(`dc-playtest-${id}`), deckId)

  // ── Page du deck : « Oracle et règles » par l'icône d'une ligne, puis par appui long sur la ligne ──
  const oracleDialog = page.getByRole('dialog', { name: 'Oracle et règles' })
  await page.getByRole('button', { name: /^Oracle et règles : / }).first().tap()
  await oracleDialog.getByText(/Règles indisponibles|Aucune règle|\d{4}/).first().waitFor()
  const dialogBox = await oracleDialog.boundingBox()
  check(dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= 375, 'page du deck : l’icône ouvre « Oracle et règles », dans la largeur de l’écran')
  await capture('deck-oracle')
  await oracleDialog.getByRole('button', { name: 'Fermer' }).tap()
  await oracleDialog.waitFor({ state: 'detached' })
  await longPress(page.locator('[data-deck-card] button').first())
  await oracleDialog.waitFor()
  check(true, 'page du deck : l’appui long sur une ligne ouvre « Oracle et règles »')
  await page.waitForTimeout(400) // le clic qui suit de peu un appui long est ignoré (touch.ts)
  await page.touchscreen.tap(5, 5)
  await oracleDialog.waitFor({ state: 'detached' })
  check(true, 'clic à côté : fenêtre fermée')
  await page.goto(`${base}/decks/${deckId}/test`)
  await hand.first().waitFor()
  check(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), 'écran tactile émulé (pointer: coarse)')
  check((await hand.count()) === 7, 'main de départ de 7 cartes')
  await capture('depart')

  // ── Appui long sur la bibliothèque : son menu s'ouvre, comme au clic droit ──
  await longPress(library)
  check(await menu.isVisible(), 'appui long sur la bibliothèque : menu ouvert')
  check(await menu.getByRole('menuitem', { name: 'Mélanger' }).isVisible(), 'menu de la bibliothèque (Mélanger…)')
  check(await menuInScreen(), 'menu entièrement dans l’écran')
  const itemHeight = (await menu.getByRole('menuitem').first().boundingBox()).height
  check(itemHeight >= 32, `entrées du menu d’au moins 32 px au doigt (${Math.round(itemHeight)} px)`)
  await capture('menu-bibliotheque')
  await page.touchscreen.tap(360, 120)
  await page.waitForTimeout(150)
  check(!(await menu.isVisible()), 'toucher à côté ferme le menu')

  // Un appui bref ne déplace rien et n'ouvre pas de menu.
  const libraryBefore = await libraryCount()
  await longPress(hand.first(), 120)
  check(!(await menu.isVisible()) && (await hand.count()) === 7, 'appui bref sur une carte : ni menu ni déplacement')

  // ── Mulligan n°3 : les joueurs choisissent combien de cartes mettre au-dessous (ici deux), une par une ──
  const mulligan = page.getByRole('button', { name: 'Mulligan', exact: true })
  for (let i = 0; i < 3; i++) {
    await mulligan.tap()
    await page.waitForTimeout(400) // deux touchers rapprochés feraient un double toucher
  }
  const banner = page.getByTestId('mulligan-banner')
  check((await banner.innerText()).includes('Mulligan n°3') && (await banner.innerText()).includes('cartes convenues')
    && !/\d carte/.test(await banner.innerText()), 'bandeau : Mulligan n°3, sans nombre de cartes imposé')
  check((await banner.innerText()).includes('Mettre au-dessous'), 'bandeau : indique « Mettre au-dessous »')
  await capture('mulligan-3')
  for (const [n, left] of [[1, 6], [2, 5]]) {
    const bottomed = await hand.first().getAttribute('data-card-id')
    await longPress(hand.first())
    check(await menu.isVisible(), `carte ${n} : appui long sur une carte de la main, menu de la carte`)
    check(await page.getByTestId('drag-overlay').count() === 0, `carte ${n} : pas de glisser en cours`)
    check(await menuInScreen(), `carte ${n} : menu dans l’écran`)
    if (n === 1) await capture('menu-mettre-au-dessous')
    await menu.getByRole('menuitem', { name: 'Mettre au-dessous' }).tap()
    await page.waitForTimeout(400)
    check((await hand.count()) === left && !(await page.locator(`[data-zone="hand"] [data-card-id="${bottomed}"]`).count()),
      `carte ${n} mise au-dessous : ${left} cartes en main`)
    check(await banner.isVisible(), `carte ${n} : main pas encore gardée`)
  }
  check((await libraryCount()) === libraryBefore + 2, `bibliothèque : deux cartes de plus (${libraryBefore + 2})`)
  await longPress(hand.first())
  check(await menu.getByRole('menuitem', { name: 'Mettre au-dessous' }).isVisible(), 'encore « Mettre au-dessous » : le jeu n’impose pas de nombre')
  await page.touchscreen.tap(360, 120)
  await page.waitForTimeout(150)
  await page.getByRole('button', { name: 'Garder' }).tap()
  await page.waitForTimeout(400)
  check(!(await banner.isVisible()), 'mulligan terminé : main gardée')
  await page.getByRole('button', { name: /Journal/ }).tap()
  check((await page.getByTestId('log').innerText()).includes('Garde sa main'), 'journal : « Garde sa main »')
  await page.getByRole('button', { name: 'Fermer le journal' }).tap()
  await capture('main-gardee')

  // ── Aperçu de carte : borné à l'écran, masqué au toucher suivant ──
  // Toucher neutre d'abord : le bouton touché avant (Fermer le journal) a disparu, et React ignore
  // alors l'entrée de la souris émulée sur l'élément suivant.
  await page.touchscreen.tap(360, 120)
  await page.waitForTimeout(600) // deux touchers rapprochés feraient un double toucher
  await hand.nth(2).tap()
  await page.waitForTimeout(200)
  const preview = page.getByTestId('preview')
  check(await preview.isVisible(), 'toucher une carte : aperçu affiché')
  {
    const box = await preview.boundingBox()
    check(box.x >= 0 && box.y >= 0 && box.x + box.width <= 375 && box.y + box.height <= 812, 'aperçu entièrement dans l’écran')
    await capture('apercu')
    await page.touchscreen.tap(360, 120)
    await page.waitForTimeout(150)
    check(!(await preview.isVisible()), 'aperçu masqué au toucher suivant')
  }

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ' : ' + errors.join(' | ') : ''}`)
  console.log('\nTout est OK')
} catch (e) {
  await capture('echec').catch(() => {})
  throw e
} finally {
  await browser.close()
}
