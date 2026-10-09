// Vérification du mode test sur téléphone tenu en vertical (375 × 812 puis 390 × 844, écran tactile),
// dans Chromium piloté par playwright-core.
// Usage : node scripts/playtest-phone-check.mjs <url-de-base> <deckId> <dossier-captures>
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

async function open({ width, height }) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => d.accept())
  let shot = 0
  return {
    page,
    context,
    async capture(label) {
      shot++
      await page.waitForTimeout(300) // laisser finir les animations
      const path = `${outDir}/telephone-${width}x${height}-${shot}-${label}.png`
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

async function table(tools, { width, height }) {
  const { page, capture, longPress, drag } = tools
  const size = `${width} × ${height}`
  const inScreen = (b) => b.x >= 0 && b.y >= 0 && b.x + b.width <= width + 0.5 && b.y + b.height <= height + 0.5
  const hand = page.locator('[data-zone="hand"] [data-card-id]')
  const column = page.locator('[data-board] [data-column]').first()
  const library = page.locator('[data-board] [data-zone="library"]').first()
  const tiles = page.locator('[data-board] [data-pile-tiles]').first()
  const pilesMenu = tiles.getByTestId('piles-menu')
  const toggle = tiles.getByTestId('piles-toggle')
  const bar = page.getByTestId('top-bar')
  const barMenu = page.getByTestId('bar-menu')
  const more = page.getByTestId('bar-more')
  const menu = page.getByRole('menu')
  /**
   * Toucher neutre sur le champ de bataille, loin des cartes, pour fermer un menu : en haut à droite par défaut,
   * en bas à gauche (`low`) quand le menu « ⋯ » couvre le haut à droite.
   */
  const tapAside = async (low = false) => {
    const box = await page.locator('[data-board] [data-zone="battlefield"]').first().boundingBox()
    await page.touchscreen.tap(low ? box.x + 10 : box.x + box.width - 10, low ? box.y + box.height - 10 : box.y + 10)
    await page.waitForTimeout(400) // deux touchers rapprochés feraient un double toucher
  }

  await page.goto(`${base}/decks/${deckId}`)
  await page.evaluate((id) => {
    localStorage.removeItem(`dc-playtest-${id}`)
    localStorage.removeItem('dc-table-settings')
  }, deckId)
  await page.goto(`${base}/decks/${deckId}/test`)
  await hand.first().waitFor()
  check(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), `${size} : écran tactile émulé (pointer: coarse)`)
  check(!(await page.getByTestId('rotate').isVisible()), 'mode test : pas de message « Tourne l’écran »')
  check((await hand.count()) === 7, 'main de départ de 7 cartes')
  check(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), 'pas de défilement horizontal')

  // ── Barre du haut sur une ligne : retour, tour, « Fin de tour », « ⋯ » ──
  const barBox = await bar.boundingBox()
  check(barBox.height <= TOUCH + 20, `barre du haut sur une ligne (${Math.round(barBox.height)} px)`)
  check(!(await barMenu.isVisible()), 'commandes secondaires rangées (menu « ⋯ » fermé)')
  for (const [name, locator] of [['retour', bar.getByRole('link').first()], ['Fin de tour', bar.getByRole('button', { name: 'Fin de tour' })], ['⋯', more]]) {
    const box = await locator.boundingBox()
    check(box && box.height >= TOUCH && inScreen(box), `barre : « ${name} » visible, d’au moins ${TOUCH} px`)
  }
  check((await bar.getByTestId('turn').innerText()) === 'Tour 1', 'barre : Tour 1')

  // ── Ligne vie fine : portrait, vie, −, + et « ⋯ » sur une ligne ──
  const life = column.getByTestId('player-life')
  const lifeBox = await life.boundingBox()
  for (const name of ['moins : points de vie', 'plus : points de vie', /^Compteurs de /]) {
    const box = await column.getByRole('button', { name }).boundingBox()
    check(box.height >= TOUCH && box.width >= TOUCH && Math.abs(box.y + box.height / 2 - (lifeBox.y + lifeBox.height / 2)) < 8 && box.x > lifeBox.x,
      `ligne vie : « ${name} » à droite de la vie, sur la même ligne, ${TOUCH} px`)
  }
  check((await column.boundingBox()).height <= 80, `ligne vie fine (${Math.round((await column.boundingBox()).height)} px)`)

  // ── Champ de bataille, puis bibliothèque et bouton des piles côte à côte, puis la main ──
  await page.getByRole('button', { name: 'Garder' }).tap()
  await page.waitForTimeout(400)
  const field = await page.locator('[data-board] [data-zone="battlefield"]').first().boundingBox()
  check(field.height >= height * 0.45, `champ de bataille sur presque la moitié de l’écran (${Math.round(field.height)} px)`)
  const libraryBox = await library.boundingBox()
  const toggleBox = await toggle.boundingBox()
  const handBox = await page.locator('[data-board] [data-zone="hand"]').first().boundingBox()
  check(libraryBox.height >= 70 && libraryBox.width >= TOUCH, `bibliothèque lisible (${Math.round(libraryBox.width)} × ${Math.round(libraryBox.height)} px)`)
  check(toggleBox.height >= TOUCH && toggleBox.x + toggleBox.width <= libraryBox.x && toggleBox.y >= libraryBox.y && toggleBox.y + toggleBox.height <= libraryBox.y + libraryBox.height,
    'bouton des piles à gauche de la bibliothèque, sur la même rangée')
  check(libraryBox.y >= field.y + field.height && handBox.y >= libraryBox.y + libraryBox.height, 'ordre : champ de bataille, piles, main')
  check(handBox.y + handBox.height <= height, 'main en bas, dans l’écran')
  check(/Cim\. 0 · Exil 0 · Cmd 1/.test(await toggle.innerText()), 'bouton : Cim. 0 · Exil 0 · Cmd 1')
  await capture('depart')

  // ── Menu « ⋯ » de la barre ──
  await more.tap()
  await page.waitForTimeout(200)
  check(await barMenu.isVisible(), '« ⋯ » : menu ouvert')
  check(inScreen(await barMenu.boundingBox()), 'menu « ⋯ » dans l’écran')
  for (const name of ['Annuler', 'Jeton', 'Dés', 'Journal', 'Réglages', 'Plein écran', 'Nouvelle partie', 'Langue des cartes']) {
    const box = await barMenu.getByRole('button', { name, exact: name !== 'Langue des cartes' }).boundingBox()
    check(box && box.height >= TOUCH && inScreen(box), `menu « ⋯ » : « ${name} », ${TOUCH} px`)
  }
  await capture('menu-barre')
  await barMenu.getByRole('button', { name: 'Jeton', exact: true }).tap()
  const tokenDialog = page.getByRole('dialog', { name: 'Créer un jeton' })
  await tokenDialog.waitFor()
  check(!(await barMenu.isVisible()), 'Jeton : fenêtre ouverte, menu « ⋯ » refermé')
  await page.keyboard.press('Escape')
  await tokenDialog.waitFor({ state: 'detached' })
  await more.tap()
  await page.waitForTimeout(200)
  await tapAside(true)
  check(!(await barMenu.isVisible()), 'toucher à côté ferme le menu « ⋯ »')

  // ── Réserve de mana : détail dans l’écran ──
  await bar.getByRole('button', { name: 'Réserve de mana' }).tap()
  const mana = page.getByRole('dialog', { name: 'Réserve de mana' })
  await mana.waitFor()
  check(inScreen(await mana.boundingBox()), 'réserve de mana : détail dans l’écran')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  // ── Appui long sur une carte : image au-dessus des entrées, menu dans l’écran ──
  await longPress(hand.nth(2))
  check(await menu.isVisible(), 'appui long sur une carte de la main : menu ouvert')
  const image = await menu.getByTestId('menu-preview').boundingBox()
  const item = await menu.getByRole('menuitem').first().boundingBox()
  check(item.y >= image.y + image.height, 'menu : image de la carte au-dessus des entrées')
  check(inScreen(await menu.boundingBox()), 'menu entièrement dans l’écran')
  await capture('menu-carte')
  await page.waitForTimeout(400) // le clic qui suit de peu un appui long est ignoré (touch.ts)
  await menu.getByRole('button', { name: 'Fermer' }).tap()
  await page.waitForTimeout(200)
  check(!(await menu.isVisible()), '« Fermer » ferme le menu')

  // ── Menu des piles au-dessus, et ouvert de lui-même pendant un glisser vers le cimetière ──
  await toggle.tap()
  await page.waitForTimeout(200)
  check(await pilesMenu.isVisible(), 'bouton : menu des piles ouvert')
  const pilesBox = await pilesMenu.boundingBox()
  check(inScreen(pilesBox) && pilesBox.y + pilesBox.height <= toggleBox.y, 'menu des piles au-dessus du bouton, dans l’écran')
  for (const [zone, name] of [['graveyard', 'Cim.'], ['exile', 'Exil'], ['command', 'Cmd']]) {
    const box = await pilesMenu.locator(`[data-zone="${zone}"]`).boundingBox()
    check(box.height >= TOUCH && inScreen(box), `menu des piles : ${name} dans l’écran, d’au moins ${TOUCH} px`)
  }
  await capture('menu-piles')
  await tapAside()
  check(!(await pilesMenu.isVisible()), 'toucher à côté ferme le menu des piles')
  const graveyard = pilesMenu.locator('[data-zone="graveyard"]')
  let openedDuringDrag = false
  await drag(hand.first(), async () => {
    openedDuringDrag = await pilesMenu.isVisible()
    const box = await graveyard.boundingBox()
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  })
  check(openedDuringDrag, 'glisser : le menu des piles s’ouvre de lui-même')
  check(Number(await graveyard.getAttribute('data-count')) === 1, 'carte déposée au cimetière')
  check(/Cim\. 1 /.test(await toggle.innerText()), 'bouton : Cim. 1')

  // ── Glisser une carte de la main sur le champ de bataille ──
  const before = await page.locator('[data-board] [data-zone="battlefield"] [data-card-id]').count()
  await drag(hand.first(), async () => ({ x: field.x + field.width / 2, y: field.y + field.height / 2 }))
  check((await page.locator('[data-board] [data-zone="battlefield"] [data-card-id]').count()) === before + 1, 'carte glissée sur le champ de bataille')
  check(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), 'toujours pas de défilement horizontal')
  await capture('en-jeu')
}

try {
  for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }]) {
    const tools = await open(viewport)
    await table(tools, viewport)
    await tools.context.close()
  }
  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ' : ' + errors.join(' | ') : ''}`)
  console.log('\nTout est OK')
} finally {
  await browser.close()
}
