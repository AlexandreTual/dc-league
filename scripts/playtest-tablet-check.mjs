// Vérification du mode test sur tablette en paysage (1180 × 820 puis 1024 × 768, écran tactile),
// puis du message en portrait, dans Chromium piloté par playwright-core.
// Usage : node scripts/playtest-tablet-check.mjs <url-de-base> <deckId> <dossier-captures>
import { chromium } from 'playwright-core'

const [base = 'http://localhost:8788', deckId, outDir = '.'] = process.argv.slice(2)
if (!deckId) throw new Error('deckId manquant')

const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const browser = await chromium.launch({ executablePath })
const errors = []
/** Taille minimale d'une zone tactile. */
const TOUCH = 44

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

/** Page tactile à la taille donnée, avec ses outils (captures, appui long). */
async function open({ width, height }) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  page.on('pageerror', (e) => errors.push(e.message))
  let shot = 0
  return {
    page,
    context,
    async capture(label) {
      shot++
      await page.waitForTimeout(300) // laisser finir les animations
      const path = `${outDir}/tablette-${width}x${height}-${shot}-${label}.png`
      await page.screenshot({ path })
      console.log(`📸 ${path}`)
    },
    /** Appui long au doigt au centre d'un élément (événements tactiles réels, donc aussi pointer*). */
    async longPress(locator, ms = 700) {
      const box = await locator.boundingBox()
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
      await page.waitForTimeout(ms)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await page.waitForTimeout(150)
    },
  }
}

/** Page du deck : « Oracle et règles » par l'icône d'une ligne, puis par appui long sur la ligne. */
async function deckPage({ page, capture, longPress }, width) {
  await page.goto(`${base}/decks/${deckId}`)
  // Visuels par défaut : les vérifications portent sur la liste.
  await page.getByRole('button', { name: 'Liste' }).tap()
  const oracleDialog = page.getByRole('dialog', { name: 'Oracle et règles' })
  await page.getByRole('button', { name: /^Oracle et règles : / }).first().tap()
  await oracleDialog.getByText(/Règles indisponibles|Aucune règle|\d{4}/).first().waitFor()
  const dialogBox = await oracleDialog.boundingBox()
  check(dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= width, 'page du deck : l’icône ouvre « Oracle et règles », dans la largeur de l’écran')
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
}

/** La table en paysage : zones tactiles, aperçu dans le menu, mulligan. */
async function table(tools, { width, height }) {
  const { page, capture, longPress } = tools
  const size = `${width} × ${height}`
  const hand = page.locator('[data-zone="hand"] [data-card-id]')
  const column = page.locator('[data-board] [data-column]').first()
  const library = column.locator('[data-zone="library"]')
  const libraryCount = async () => Number(await library.getAttribute('data-count'))
  const menu = page.getByRole('menu')
  const menuInScreen = async () => {
    const box = await menu.boundingBox()
    return box.y >= 0 && box.x >= 0 && box.x + box.width <= width && box.y + box.height <= height
  }
  /** Toucher neutre (au-dessus du champ de bataille, loin des cartes) pour fermer un menu. */
  const tapAside = async () => {
    const box = await page.locator('[data-board] [data-zone="battlefield"]').first().boundingBox()
    await page.touchscreen.tap(box.x + box.width - 10, box.y + 10)
    await page.waitForTimeout(400) // deux touchers rapprochés feraient un double toucher
  }

  await page.goto(`${base}/decks/${deckId}`)
  await page.evaluate((id) => localStorage.removeItem(`dc-playtest-${id}`), deckId)
  await page.goto(`${base}/decks/${deckId}/test`)
  await hand.first().waitFor()
  check(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), `${size} : écran tactile émulé (pointer: coarse)`)
  check((await hand.count()) === 7, 'main de départ de 7 cartes')
  check(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), 'pas de défilement horizontal')
  check(!(await page.getByTestId('rotate').isVisible()), 'paysage : pas de message « Tourne ta tablette »')

  // ── Colonne resserrée et zones tactiles ──
  const columnWidth = (await column.boundingBox()).width
  check(Math.round(columnWidth) === 188, `colonne de 188 px (${Math.round(columnWidth)} px)`)
  for (const name of ['moins : points de vie', 'plus : points de vie', /^Compteurs de /]) {
    const button = column.getByRole('button', { name })
    check((await button.count()) === 1, `un seul bouton « ${name} » affiché`)
    const box = await button.boundingBox()
    check(box.height >= TOUCH && box.width >= TOUCH, `« ${name} » : au moins ${TOUCH} px (${Math.round(box.width)} × ${Math.round(box.height)})`)
  }
  const cases = {
    main: await column.getByTestId('hand-count').locator('..').boundingBox(),
    bib: await library.boundingBox(),
    exil: await column.locator('[data-zone="exile"]').boundingBox(),
  }
  check(Object.values(cases).every((b) => b.height >= TOUCH), `cases Main, Bib., Exil d’au moins ${TOUCH} px de haut`)
  check(Math.abs(cases.main.y - cases.bib.y) < 2 && cases.bib.x > cases.main.x && Math.abs(cases.exil.x - cases.bib.x) < 2 && cases.exil.y > cases.bib.y,
    'cases sur deux colonnes (Main, Bib. / Cim., Exil)')
  const barHeights = await page.getByTestId('top-bar').locator('a, button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))
  check(barHeights.length > 0 && barHeights.every((h) => h >= TOUCH), `boutons de la barre d’au moins ${TOUCH} px (${Math.round(Math.min(...barHeights))} px)`)
  await capture('depart')

  // ── Mulligan : une carte mise au-dessous par le menu, puis Garder ──
  const libraryBefore = await libraryCount()
  await page.getByRole('button', { name: 'Mulligan', exact: true }).tap()
  await page.waitForTimeout(400)
  const banner = page.getByTestId('mulligan-banner')
  check((await banner.innerText()).includes('Mulligan n°1'), 'bandeau : Mulligan n°1')
  await longPress(hand.first())
  await menu.getByRole('menuitem', { name: 'Mettre au-dessous' }).tap()
  await page.waitForTimeout(400)
  check((await hand.count()) === 6 && (await libraryCount()) === libraryBefore + 1, 'carte mise au-dessous : 6 cartes en main')
  await page.getByRole('button', { name: 'Garder' }).tap()
  await page.waitForTimeout(400)
  check(!(await banner.isVisible()), 'main gardée')
  await capture('main-gardee')

  // ── + de la vie au doigt ──
  const life = column.getByTestId('player-life')
  const lifeBefore = Number(await life.innerText())
  await column.getByRole('button', { name: 'plus : points de vie' }).tap()
  await page.waitForTimeout(300)
  check(Number(await life.innerText()) === lifeBefore + 1, `+ : ${lifeBefore + 1} points de vie`)
  await column.getByRole('button', { name: 'moins : points de vie' }).tap()
  await page.waitForTimeout(400)

  // ── Pas d'aperçu au toucher : il est dans le menu ouvert par l'appui long ──
  await tapAside()
  await hand.nth(2).tap()
  await page.waitForTimeout(200)
  check(!(await page.getByTestId('preview').isVisible()), 'toucher une carte : pas d’aperçu flottant')
  await longPress(hand.nth(2))
  check(await menu.isVisible(), 'appui long sur une carte de la main : menu ouvert')
  check(await page.getByTestId('drag-overlay').count() === 0, 'pas de glisser en cours')
  const preview = menu.getByTestId('menu-preview')
  check(await preview.isVisible(), 'menu : image de la carte')
  check(Math.round((await preview.boundingBox()).width) === 224, 'image de 224 px de large')
  check(await menu.getByRole('menuitem', { name: 'Cimetière' }).first().isVisible(), 'menu : entrées de la carte à côté de l’image')
  {
    const image = await preview.boundingBox()
    const item = await menu.getByRole('menuitem').first().boundingBox()
    check(item.x >= image.x + image.width, 'entrées à droite de l’image')
  }
  const close = menu.getByRole('button', { name: 'Fermer' })
  check((await close.boundingBox()).height >= TOUCH, `bouton « Fermer » d’au moins ${TOUCH} px`)
  check(await menuInScreen(), 'menu entièrement dans l’écran')
  await capture('menu-apercu')
  await page.waitForTimeout(400) // le clic qui suit de peu un appui long est ignoré (touch.ts)
  await close.tap()
  await page.waitForTimeout(200)
  check(!(await menu.isVisible()), '« Fermer » ferme le menu et l’aperçu')

  // ── Appui long sur la bibliothèque : son menu, sans image ──
  await longPress(library)
  check(await menu.getByRole('menuitem', { name: 'Mélanger' }).isVisible(), 'appui long sur la bibliothèque : son menu (Mélanger…)')
  check(!(await menu.getByTestId('menu-preview').count()), 'menu de la bibliothèque, carte du dessus cachée : pas d’image')
  check(await menuInScreen(), 'menu de la bibliothèque dans l’écran')
  await tapAside()
  check(!(await menu.isVisible()), 'toucher à côté ferme le menu')

}

try {
  for (const [i, viewport] of [{ width: 1180, height: 820 }, { width: 1024, height: 768 }].entries()) {
    const tools = await open(viewport)
    if (i === 0) await deckPage(tools, viewport.width)
    await table(tools, viewport)
    await tools.context.close()
  }

  // ── Tablette en portrait : message à la place de la table ──
  const tools = await open({ width: 820, height: 1180 })
  await tools.page.goto(`${base}/decks/${deckId}/test`)
  const rotate = tools.page.getByTestId('rotate')
  await rotate.waitFor()
  check((await rotate.innerText()).includes('Tourne ta tablette en paysage'), 'portrait : « Tourne ta tablette en paysage pour jouer. »')
  const box = await rotate.boundingBox()
  check(box.x === 0 && box.y === 0 && box.width === 820 && box.height === 1180, 'portrait : le message couvre tout l’écran')
  await tools.capture('portrait')
  await tools.context.close()

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ' : ' + errors.join(' | ') : ''}`)
  console.log('\nTout est OK')
} finally {
  await browser.close()
}
