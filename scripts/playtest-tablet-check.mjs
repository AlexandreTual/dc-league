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
    /** Glisser au doigt : appui de 350 ms, petit déplacement (le glisser démarre), puis jusqu'au point donné par `to()`. */
    async drag(locator, to) {
      const box = await locator.boundingBox()
      let point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      const move = async (target, steps) => {
        const start = point
        for (let i = 1; i <= steps; i++) {
          point = { x: start.x + ((target.x - start.x) * i) / steps, y: start.y + ((target.y - start.y) * i) / steps }
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] })
          await page.waitForTimeout(16)
        }
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
      await page.waitForTimeout(350)
      await move({ x: point.x, y: point.y - 40 }, 5)
      await page.waitForTimeout(100)
      await move(await to(), 15)
      await page.waitForTimeout(100)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await page.waitForTimeout(400)
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

/** La table en paysage : zones tactiles, piles rangées dans un menu, aperçu dans le menu d'une carte, mulligan, ancienne disposition. */
async function table(tools, { width, height }) {
  const { page, capture, longPress, drag } = tools
  const size = `${width} × ${height}`
  const hand = page.locator('[data-zone="hand"] [data-card-id]')
  const column = page.locator('[data-board] [data-column]').first()
  const library = page.locator('[data-board] [data-zone="library"]').first()
  const tiles = page.locator('[data-board] [data-pile-tiles]').first()
  const pilesMenu = tiles.getByTestId('piles-menu')
  const toggle = tiles.getByTestId('piles-toggle')
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
  check(!(await page.getByTestId('rotate').isVisible()), 'paysage : pas de message « Tourne l’écran »')

  // ── Colonne resserrée et zones tactiles ──
  const columnWidth = (await column.boundingBox()).width
  check(Math.round(columnWidth) === 188, `colonne de 188 px (${Math.round(columnWidth)} px)`)
  for (const name of ['moins : points de vie', 'plus : points de vie', /^Compteurs de /]) {
    const button = column.getByRole('button', { name })
    check((await button.count()) === 1, `un seul bouton « ${name} » affiché`)
    const box = await button.boundingBox()
    check(box.height >= TOUCH && box.width >= TOUCH, `« ${name} » : au moins ${TOUCH} px (${Math.round(box.width)} × ${Math.round(box.height)})`)
  }
  // ── Disposition par défaut : la bibliothèque seule à côté de la main, les autres piles dans un menu juste au-dessus ──
  check(!(await column.locator('[data-zone]').count()), 'colonne : la ligne portrait seule')
  const libraryBox = await library.boundingBox()
  check(libraryBox.height >= TOUCH && libraryBox.width >= TOUCH, `bibliothèque à côté de la main, d’au moins ${TOUCH} px`)
  check(!(await pilesMenu.isVisible()), 'cimetière, exil et commandement rangés (menu fermé)')
  const toggleBox = await toggle.boundingBox()
  check(toggleBox.height >= TOUCH && toggleBox.y + toggleBox.height <= libraryBox.y + 1, `bouton des piles juste au-dessus de la bibliothèque, ${TOUCH} px`)
  check(/Cim\. 0 · Exil 0 · Cmd 1/.test(await toggle.innerText()), 'bouton : nombres des piles (Cim. 0 · Exil 0 · Cmd 1)')
  const handWidth = (await page.locator('[data-board] [data-zone="hand"]').first().boundingBox()).width
  check(handWidth >= width * 0.55, `main sur presque toute la largeur (${Math.round(handWidth)} px)`)
  const barHeights = await page.getByTestId('top-bar').locator('a, button').evaluateAll((els) => els.filter((e) => e.checkVisibility()).map((e) => e.getBoundingClientRect().height))
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

  // ── Menu des piles : par le bouton, puis ouvert de lui-même pendant un glisser vers le cimetière ──
  await toggle.tap()
  await page.waitForTimeout(200)
  check(await pilesMenu.isVisible(), 'bouton : menu des piles ouvert')
  for (const [zone, name] of [['graveyard', 'Cim.'], ['exile', 'Exil'], ['command', 'Cmd']]) {
    const box = await pilesMenu.locator(`[data-zone="${zone}"]`).boundingBox()
    check(box.height >= TOUCH && box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height,
      `menu des piles : ${name} dans l’écran, d’au moins ${TOUCH} px`)
  }
  await capture('menu-piles')
  await tapAside()
  check(!(await pilesMenu.isVisible()), 'toucher à côté ferme le menu des piles')
  const graveyard = pilesMenu.locator('[data-zone="graveyard"]')
  const graveyardBefore = Number(await graveyard.getAttribute('data-count'))
  let openedDuringDrag = false
  await drag(hand.first(), async () => {
    openedDuringDrag = await pilesMenu.isVisible()
    const box = await graveyard.boundingBox()
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  })
  check(openedDuringDrag, 'glisser : le menu des piles s’ouvre de lui-même')
  check(Number(await graveyard.getAttribute('data-count')) === graveyardBefore + 1, 'carte déposée au cimetière')
  check(!(await pilesMenu.isVisible()), 'après le glisser : menu des piles refermé')
  check(/Cim\. 1 /.test(await toggle.innerText()), 'bouton : Cim. 1')

  // ── Ancienne disposition (réglage « Piles dans la colonne ») : cases sur deux colonnes ──
  await page.evaluate(() => localStorage.setItem('dc-table-settings', JSON.stringify({ grid: true, background: null, cardScale: 1, pilesBesideHand: false })))
  await page.reload()
  await page.getByRole('button', { name: /Reprendre la partie/ }).tap()
  await hand.first().waitFor()
  const cases = {
    main: await column.getByTestId('hand-count').locator('..').boundingBox(),
    bib: await column.locator('[data-zone="library"]').boundingBox(),
    exil: await column.locator('[data-zone="exile"]').boundingBox(),
  }
  check(Object.values(cases).every((b) => b.height >= TOUCH), `ancienne disposition : cases Main, Bib., Exil d’au moins ${TOUCH} px de haut`)
  check(Math.abs(cases.main.y - cases.bib.y) < 2 && cases.bib.x > cases.main.x && Math.abs(cases.exil.x - cases.bib.x) < 2 && cases.exil.y > cases.bib.y,
    'ancienne disposition : cases sur deux colonnes (Main, Bib. / Cim., Exil)')
  check(!(await tiles.count()), 'ancienne disposition : pas de vignettes à côté de la main')
  await capture('ancienne-disposition')
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
  check((await rotate.innerText()).includes('Tourne l’écran en paysage'), 'portrait : « Tourne l’écran en paysage pour jouer. »')
  const box = await rotate.boundingBox()
  check(box.x === 0 && box.y === 0 && box.width === 820 && box.height === 1180, 'portrait : le message couvre tout l’écran')
  await tools.capture('portrait')
  await tools.context.close()

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ' : ' + errors.join(' | ') : ''}`)
  console.log('\nTout est OK')
} finally {
  await browser.close()
}
