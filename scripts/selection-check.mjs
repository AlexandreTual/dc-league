// Sélection de plusieurs cartes (issue #178) dans de vrais navigateurs : mode test à la souris,
// mode test sur tablette (1180 × 820, tactile), puis partie en ligne à 2.
// Prérequis : ceux de scripts/online-check.mjs (Worker, site, données de seed-online.mjs).
// Usage : node scripts/selection-check.mjs <url-de-base> <dossier-captures>
import { launch } from './browser.mjs'
import { PLAYERS, tokenOf } from './seed-online.mjs'

const [base = 'http://localhost:8788', outDir = '.'] = process.argv.slice(2)
const [ANA, BASTIEN] = PLAYERS

const browser = await launch()
const errors = []

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

async function openAs(player, viewport = { width: 1280, height: 900 }) {
  const touch = viewport.width < 1200
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch })
  await context.addCookies([{ name: 'dc_session', value: tokenOf(player.id), url: base }])
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`${player.name} : ${page.url()} : ${e.message}`))
  page.on('dialog', (d) => d.accept(d.defaultValue()))
  const cdp = touch ? await context.newCDPSession(page) : null
  return { ...player, page, cdp }
}

let shot = 0
async function capture(page, label) {
  shot++
  await page.waitForTimeout(300)
  const path = `${outDir}/selection-${shot}-${label}.png`
  await page.screenshot({ path })
  console.log(`📸 ${path}`)
}

const until = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 10_000 })
const selected = (page) => page.locator('[data-selected]').count()
const count = (page, zone, player) => page.locator(`[data-zone="${zone}"][data-player="${player}"]`).first().getAttribute('data-count').then(Number)
const cardsIn = (page, zone, player) => page.locator(`[data-zone="${zone}"][data-player="${player}"] [data-card-id]`)
const waitCards = (page, zone, player, n) =>
  until(page, ([z, p, k]) => document.querySelectorAll(`[data-zone="${z}"][data-player="${p}"] [data-card-id]`).length === k, [zone, player, n])
const waitSelected = (page, n) => until(page, (k) => document.querySelectorAll('[data-selected]').length === k, n)

/** Rectangle tracé à la souris entre deux points (coordonnées de la page). */
async function mouseLasso(page, from, to) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10)
  await page.mouse.up()
}

/** Rectangle au doigt : appui long dans le vide, puis glisser ; sans `to`, appui long relâché sur place. */
async function touchLasso(who, from, to) {
  await who.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
  await who.page.waitForTimeout(650)
  if (to) {
    for (let i = 1; i <= 12; i++) {
      const point = { x: from.x + ((to.x - from.x) * i) / 12, y: from.y + ((to.y - from.y) * i) / 12 }
      await who.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] })
      await who.page.waitForTimeout(16)
    }
  }
  await who.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await who.page.waitForTimeout(200)
}

async function longPress(who, locator) {
  const box = await locator.boundingBox()
  await touchLasso(who, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
}

/** Rectangle qui couvre les cartes d'une zone, de son coin haut-gauche (vide) jusqu'au centre de la n-ième. */
async function cornerTo(page, zone, player, n) {
  const area = await page.locator(`[data-zone="${zone}"][data-player="${player}"]`).first().boundingBox()
  const card = await cardsIn(page, zone, player).nth(n - 1).boundingBox()
  return [{ x: area.x + 4, y: area.y + 4 }, { x: card.x + card.width / 2, y: card.y + card.height / 2 }]
}

/** Rectangle autour de toutes les cartes du champ de bataille, en partant du vide. */
async function aroundField(page, player) {
  const boxes = await cardsIn(page, 'battlefield', player).evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect()
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
  }))
  const left = Math.min(...boxes.map((b) => b.left)) - 20
  const top = Math.min(...boxes.map((b) => b.top)) - 20
  const right = Math.max(...boxes.map((b) => b.right)) + 20
  const bottom = Math.max(...boxes.map((b) => b.bottom)) + 20
  return [{ x: left, y: top }, { x: right, y: bottom }]
}

const positionOf = (page, id) => page.locator(`[data-card-id="${id}"]`).evaluate((el) => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) }))

async function playtest(who) {
  await who.page.goto(`${base}/decks/deck-${who.id}`)
  await who.page.evaluate((id) => localStorage.removeItem(`dc-playtest-${id}`), `deck-${who.id}`)
  await who.page.goto(`${base}/decks/deck-${who.id}/test`)
  await who.page.waitForSelector('[data-zone="hand"] [data-card-id]', { timeout: 15_000 })
}

const SOLO = 'solo'

try {
  // ── Mode test, à la souris ──
  const solo = await openAs(ANA)
  const { page } = solo
  await playtest(solo)
  const handBefore = await cardsIn(page, 'hand', SOLO).count()
  await mouseLasso(page, ...(await cornerTo(page, 'hand', SOLO, 3)))
  await waitSelected(page, 3)
  check(true, 'main : rectangle tracé à la souris, 3 cartes sélectionnées (liseré)')
  await capture(page, 'main-selectionnee')

  await page.locator('[data-zone="hand"] [data-selected]').nth(1).click({ button: 'right' })
  const menu = page.getByRole('menu')
  check(await menu.getByText('3 cartes sélectionnées').isVisible(), 'clic droit sur une carte sélectionnée : menu du groupe « 3 cartes sélectionnées »')
  await menu.getByRole('menuitem', { name: 'Champ de bataille' }).click()
  await waitCards(page, 'battlefield', SOLO, 3)
  check(await cardsIn(page, 'hand', SOLO).count() === handBefore - 3, 'les 3 cartes passent en jeu d’un coup, en rangée')
  await waitSelected(page, 0)

  await mouseLasso(page, ...(await aroundField(page, SOLO)))
  await waitSelected(page, 3)
  check(true, 'champ de bataille : rectangle autour des 3 cartes')
  const ids = await cardsIn(page, 'battlefield', SOLO).evaluateAll((els) => els.map((el) => el.dataset.cardId))
  const before = await Promise.all(ids.map((id) => positionOf(page, id)))
  const held = await page.locator(`[data-card-id="${ids[0]}"]`).boundingBox()
  await page.mouse.move(held.x + held.width / 2, held.y + held.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(held.x + held.width / 2 - 15 * i, held.y + held.height / 2 - 8 * i)
  check(await page.getByTestId('drag-count').textContent() === '3', 'glisser une carte du groupe : l’aperçu montre « 3 »')
  await page.mouse.up()
  await until(page, ([id, x]) => parseFloat(document.querySelector(`[data-card-id="${id}"]`).style.left) !== x, [ids[0], before[0].x])
  const after = await Promise.all(ids.map((id) => positionOf(page, id)))
  const dx = after.map((p, i) => Math.round((p.x - before[i].x) * 10) / 10)
  const dy = after.map((p, i) => Math.round((p.y - before[i].y) * 10) / 10)
  check(dx[0] < 0 && dy[0] < 0 && dx.every((d) => Math.abs(d - dx[0]) < 0.5) && dy.every((d) => Math.abs(d - dy[0]) < 0.5),
    `le groupe se déplace ensemble, même décalage pour les 3 cartes (${dx.join(', ')} / ${dy.join(', ')})`)
  check(await selected(page) === 3, 'la sélection reste après le déplacement')

  await page.locator(`[data-card-id="${ids[1]}"]`).click({ modifiers: ['Shift'] })
  await waitSelected(page, 2)
  await page.locator(`[data-card-id="${ids[1]}"]`).click({ modifiers: ['Shift'] })
  await waitSelected(page, 3)
  check(true, 'Maj + clic retire une carte de la sélection, puis la remet')
  const field = await page.locator(`[data-zone="battlefield"][data-player="${SOLO}"]`).boundingBox()
  await page.mouse.click(field.x + field.width - 30, field.y + 30)
  await waitSelected(page, 0)
  check(true, 'clic dans le vide : sélection vidée')

  await mouseLasso(page, ...(await aroundField(page, SOLO)))
  await waitSelected(page, 3)
  await page.locator(`[data-card-id="${ids[2]}"]`).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: 'Engager' }).click()
  await until(page, (list) => list.every((id) => document.querySelector(`[data-card-id="${id}"]`).style.transform.includes('rotate(90deg)')), ids)
  check(true, '« Engager » : les 3 cartes sont engagées')
  await page.keyboard.press('Escape')
  await waitSelected(page, 0)
  check(true, 'Échap vide la sélection')

  const library = await count(page, 'library', SOLO)
  await mouseLasso(page, ...(await aroundField(page, SOLO)))
  await waitSelected(page, 3)
  await page.locator(`[data-card-id="${ids[0]}"]`).click({ button: 'right' })
  await page.getByRole('menu').getByRole('menuitem', { name: 'Dessus de la bibliothèque…' }).click()
  const order = page.getByTestId('order-modal')
  await order.waitFor()
  check(await order.locator('[data-order-card]').count() === 3, 'fenêtre « Ordre des cartes » avec les 3 cartes')
  const first = await order.locator('[data-order-card]').first().getAttribute('data-order-card')
  await order.locator('[data-order-card]').first().getByRole('button', { name: 'Vers le dessous' }).click()
  check(await order.locator('[data-order-card]').nth(1).getAttribute('data-order-card') === first, 'flèche : la première carte descend d’un cran')
  await capture(page, 'ordre')
  await order.getByRole('button', { name: 'Valider cet ordre' }).click()
  await waitCards(page, 'battlefield', SOLO, 0)
  check(await count(page, 'library', SOLO) === library + 3, '« Valider cet ordre » : les 3 cartes sur la bibliothèque')
  await page.getByRole('button', { name: 'Annuler' }).click()
  await waitCards(page, 'battlefield', SOLO, 3)
  check(await count(page, 'library', SOLO) === library, 'une seule annulation ramène les 3 cartes')

  const graveyard = await count(page, 'graveyard', SOLO)
  await mouseLasso(page, ...(await aroundField(page, SOLO)))
  await waitSelected(page, 3)
  const card = await page.locator(`[data-card-id="${ids[1]}"]`).boundingBox()
  const tile = await page.locator(`[data-zone="graveyard"][data-player="${SOLO}"]`).first().boundingBox()
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 15; i++) {
    await page.mouse.move(card.x + card.width / 2 + ((tile.x + tile.width / 2 - card.x - card.width / 2) * i) / 15, card.y + card.height / 2 + ((tile.y + tile.height / 2 - card.y - card.height / 2) * i) / 15)
  }
  await page.mouse.up()
  await order.waitFor()
  check(await order.getByRole('heading').textContent() === 'Cimetière : ordre des cartes', 'groupe lâché sur le cimetière : fenêtre d’ordre')
  await order.getByRole('button', { name: 'Ordre aléatoire' }).click()
  await waitCards(page, 'battlefield', SOLO, 0)
  check(await count(page, 'graveyard', SOLO) === graveyard + 3, '« Ordre aléatoire » : les 3 cartes au cimetière')

  const exile = await count(page, 'exile', SOLO)
  await mouseLasso(page, ...(await cornerTo(page, 'hand', SOLO, 2)))
  await waitSelected(page, 2)
  const handCard = await page.locator('[data-zone="hand"] [data-selected]').first().boundingBox()
  const exileTile = await page.locator(`[data-zone="exile"][data-player="${SOLO}"]`).first().boundingBox()
  await page.mouse.move(handCard.x + handCard.width / 2, handCard.y + handCard.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 15; i++) {
    await page.mouse.move(handCard.x + handCard.width / 2 + ((exileTile.x + exileTile.width / 2 - handCard.x - handCard.width / 2) * i) / 15, handCard.y + handCard.height / 2 + ((exileTile.y + exileTile.height / 2 - handCard.y - handCard.height / 2) * i) / 15)
  }
  await page.mouse.up()
  await until(page, ([p, n]) => Number(document.querySelector(`[data-zone="exile"][data-player="${p}"]`).dataset.count) === n, [SOLO, exile + 2])
  check(true, 'deux cartes de la main lâchées sur l’exil, sans fenêtre d’ordre')
  await page.getByRole('button', { name: 'Journal' }).click()
  check(await page.getByText('2 cartes : main → exil').isVisible(), 'journal : une seule ligne pour le groupe')
  await capture(page, 'mode-test')

  // ── Mode test sur tablette (tactile) ──
  const tab = await openAs(ANA, { width: 1180, height: 820 })
  await playtest(tab)
  const handZone = await tab.page.locator('[data-zone="hand"]').first().boundingBox()
  await touchLasso(tab, { x: handZone.x + 4, y: handZone.y + 4 }, (await cornerTo(tab.page, 'hand', SOLO, 2))[1])
  await waitSelected(tab.page, 2)
  check(true, 'tablette : appui long dans le vide de la main puis glisser, 2 cartes sélectionnées')
  await longPress(tab, tab.page.locator('[data-zone="hand"] [data-selected]').first())
  await tab.page.getByRole('menu').getByText('2 cartes sélectionnées').waitFor()
  await tab.page.getByRole('menu').getByRole('menuitem', { name: 'Champ de bataille' }).tap()
  await waitCards(tab.page, 'battlefield', SOLO, 2)
  check(true, 'tablette : appui long sur une carte sélectionnée, menu du groupe, « Champ de bataille »')
  const [from, to] = await aroundField(tab.page, SOLO)
  await touchLasso(tab, from, to)
  await waitSelected(tab.page, 2)
  check(true, 'tablette : appui long dans le vide du champ de bataille puis glisser, 2 cartes sélectionnées')
  await capture(tab.page, 'tablette')
  await tab.page.touchscreen.tap(from.x - 10, from.y - 10)
  await waitSelected(tab.page, 0)
  check(true, 'tablette : toucher le vide vide la sélection')
  await touchLasso(tab, { x: handZone.x + 6, y: handZone.y + 6 })
  await tab.page.getByRole('menu').getByRole('menuitem', { name: 'Révéler ma main' }).waitFor()
  check(await selected(tab.page) === 0, 'tablette : appui long dans le vide de la main sans glisser, menu de la main')
  await tab.page.getByRole('menu').getByRole('button', { name: 'Fermer' }).tap().catch(() => tab.page.keyboard.press('Escape'))

  // ── En ligne, à 2 ──
  const ana = await openAs(ANA)
  const bastien = await openAs(BASTIEN)
  await ana.page.goto(`${base}/salon`)
  await ana.page.getByRole('combobox').nth(1).selectOption('2')
  await ana.page.getByRole('button', { name: 'Créer la table' }).click()
  await ana.page.waitForURL(/\/tables\//)
  const tableUrl = ana.page.url()
  for (const who of [ana, bastien]) {
    if (who === bastien) {
      await bastien.page.goto(tableUrl)
      await bastien.page.getByRole('button', { name: 'Rejoindre la table' }).click()
    }
    await who.page.getByTestId('deck-select').selectOption(`deck-${who.id}`)
    await who.page.locator(`[data-seat="${who.id}"]`).getByText(`Kenrith de ${who.name}`).waitFor()
  }
  await ana.page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent === 'Démarrer la partie')
    return b && !b.disabled
  }, null, { timeout: 10_000 })
  await ana.page.getByRole('button', { name: 'Démarrer la partie' }).click()
  for (const who of [ana, bastien]) {
    await who.page.getByTestId('game').waitFor({ timeout: 10_000 })
    await who.page.getByTestId('start-draw').waitFor()
    await who.page.keyboard.press('Escape')
    await who.page.getByTestId('start-draw').waitFor({ state: 'detached' })
  }

  await mouseLasso(ana.page, ...(await cornerTo(ana.page, 'hand', ANA.id, 2)))
  await waitSelected(ana.page, 2)
  await ana.page.locator('[data-zone="hand"] [data-selected]').first().click({ button: 'right' })
  await ana.page.getByRole('menu').getByRole('menuitem', { name: 'Champ de bataille' }).click()
  await waitCards(ana.page, 'battlefield', ANA.id, 2)
  const anaField = `[data-zone="battlefield"][data-player="${ANA.id}"] [data-card-id], [data-strip-card]`
  await until(bastien.page, (sel) => document.querySelectorAll(sel).length >= 2, anaField)
  check(true, 'en ligne : Ana pose 2 cartes d’un coup, Bastien les voit')

  // Bastien ne peut pas sélectionner les cartes d'Ana.
  const anaBoard = bastien.page.locator(`[data-zone="battlefield"][data-player="${ANA.id}"]`).first()
  if (await anaBoard.count()) {
    const b = await anaBoard.boundingBox()
    await mouseLasso(bastien.page, { x: b.x + 4, y: b.y + 4 }, { x: b.x + b.width - 4, y: b.y + b.height - 4 })
  }
  check(await selected(bastien.page) === 0, 'en ligne : rien à sélectionner sur le plateau d’un adversaire')

  await mouseLasso(ana.page, ...(await aroundField(ana.page, ANA.id)))
  await waitSelected(ana.page, 2)
  await ana.page.locator('[data-selected]').first().click({ button: 'right' })
  await ana.page.getByRole('menu').getByRole('menuitem', { name: 'Dessus de la bibliothèque…' }).click()
  await ana.page.getByTestId('order-modal').getByRole('button', { name: 'Ordre aléatoire' }).click()
  await waitCards(ana.page, 'battlefield', ANA.id, 0)
  await bastien.page.getByText('2 cartes : champ de bataille → bibliothèque (dessus, ordre aléatoire)').first().waitFor({ timeout: 10_000 })
  check(true, 'en ligne : ordre aléatoire tiré par le serveur, Bastien voit la ligne du journal sans nom de carte')
  await capture(ana.page, 'en-ligne-ana')
  await capture(bastien.page, 'en-ligne-bastien')

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` : ${errors.join(' | ')}` : ''}`)
} finally {
  await browser.close()
}
