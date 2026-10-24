// Raccourcis clavier sur la carte survolée et touches choisies, dans de vrais navigateurs :
// mode test (menu d'une carte focalisée au clavier, jouer, engager, jeton copie X, cimetière, annuler, changer une touche, mémorisée), puis en ligne à 2
// (engager la carte d'un adversaire).
// Prérequis : ceux de scripts/online-check.mjs (Worker, site, données de seed-online.mjs).
// Usage : node scripts/shortcuts-check.mjs <url-de-base> <dossier-captures>
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

async function openAs(player) {
  const context = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 900 } })
  await context.addCookies([{ name: 'dc_session', value: tokenOf(player.id), url: base }])
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`${player.name} : ${e.message}`))
  page.on('dialog', (d) => d.accept(d.defaultValue()))
  return { ...player, page }
}

let shot = 0
async function capture(page, label) {
  shot++
  await page.waitForTimeout(300)
  const path = `${outDir}/shortcuts-${shot}-${label}.png`
  await page.screenshot({ path })
  console.log(`📸 ${path}`)
}

const inZone = (page, zone, id) => page.locator(`[data-zone="${zone}"] [data-card-id="${id}"]`)
const count = (page, zone) => page.locator(`[data-zone="${zone}"] [data-card-id]`).count()
/** Libellé « Engager » ou « Dégager » du menu de la carte (puis menu refermé). */
async function tapLabel(page, locator) {
  await locator.click({ button: 'right' })
  const label = (await page.getByRole('menuitem', { name: /^(Engager|Dégager)/ }).locator('span').first().innerText()).trim()
  await page.keyboard.press('Escape')
  return label
}

try {
  // ── Mode test ──
  const solo = await openAs(ANA)
  const { page } = solo
  await page.goto(`${base}/decks/deck-${ANA.id}`)
  await page.evaluate((id) => { localStorage.removeItem(`dc-playtest-${id}`); localStorage.removeItem('dc-shortcuts') }, `deck-${ANA.id}`)
  await page.goto(`${base}/decks/deck-${ANA.id}/test`)
  await page.waitForSelector('[data-zone="hand"] [data-card-id]', { timeout: 15_000 })

  const handCard = page.locator('[data-zone="hand"] [data-card-id]').first()
  const id = await handCard.getAttribute('data-card-id')

  // Clavier : la carte focalisée porte son nom ; Entrée, Maj+F10 et la touche Menu ouvrent son menu ; consigne en français.
  const described = (await page.locator('[id^="DndDescribedBy"]').first().textContent()) ?? ''
  check(described.includes('Entrée') && !/press|space bar|draggable/i.test(described), `consigne du glisser en français (« ${described.slice(0, 40)}… »)`)
  const cardName = await handCard.getAttribute('aria-label')
  check(!!cardName && cardName !== id && await handCard.getAttribute('aria-roledescription') === 'carte', `carte de la main : nom lu (« ${cardName} »)`)
  for (const key of ['Enter', 'Shift+F10', 'ContextMenu']) {
    await handCard.focus()
    await page.keyboard.press(key)
    await page.locator('[role="menu"]').waitFor({ timeout: 3000 })
    check(true, `${key} : la carte focalisée ouvre son menu`)
    await page.keyboard.press('Escape')
    await page.locator('[role="menu"]').waitFor({ state: 'detached' })
  }
  await capture(page, 'clavier')

  await handCard.hover()
  await page.keyboard.press('b')
  await inZone(page, 'battlefield', id).waitFor()
  check(true, 'B : la carte survolée de la main va sur le champ de bataille')

  const onField = inZone(page, 'battlefield', id)
  await onField.hover()
  await page.keyboard.press('t')
  check(await tapLabel(page, onField) === 'Dégager', 'T : la carte survolée est engagée')

  // Touches en grisé dans le menu, comme Moxfield.
  await onField.click({ button: 'right' })
  const hint = (name) => page.getByRole('menuitem', { name }).locator('[data-shortcut-hint]').innerText()
  check(await hint(/^Dégager/) === 'T' && await hint(/^Créer un jeton copie/) === 'X' && await hint(/^Cimetière/) === 'G',
    'menu : touches affichées (T, X, G)')
  await capture(page, 'menu-touches')
  await page.keyboard.press('Escape')

  const before = await count(page, 'battlefield')
  await onField.hover()
  await page.keyboard.press('x')
  await page.waitForFunction((n) => document.querySelectorAll('[data-zone="battlefield"] [data-card-id]').length === n, before + 1)
  check(true, 'X : un jeton copie de la carte survolée arrive en jeu')
  await capture(page, 'jeton-copie')

  await onField.hover()
  await page.keyboard.press('g')
  // Piles à côté de la main : la carte arrive en haut du cimetière en liste (colonne), seule copie glissable.
  await page.locator(`[data-graveyard-list] [data-card-id="${id}"]`).waitFor({ state: 'attached' })
  check(true, 'G : la carte survolée va au cimetière')
  await page.keyboard.press('Control+z')
  await inZone(page, 'battlefield', id).waitFor()
  check(true, 'Ctrl+Z : annulé, la carte revient en jeu')

  // Sélection de plusieurs cartes : les raccourcis agissent sur tout le groupe.
  async function mouseSelect() {
    if (await page.locator('[data-selected]').count() > 0) return
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10)
    await page.mouse.up()
    await page.waitForFunction((n) => document.querySelectorAll('[data-selected]').length === n, fieldIds.length)
  }
  const fieldIds = await page.locator('[data-zone="battlefield"] [data-card-id]').evaluateAll((els) => els.map((el) => el.dataset.cardId))
  const boxes = await page.locator('[data-zone="battlefield"] [data-card-id]').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))
  const from = { x: Math.min(...boxes.map((b) => b.left)) - 20, y: Math.min(...boxes.map((b) => b.top)) - 20 }
  const to = { x: Math.max(...boxes.map((b) => b.right)) + 20, y: Math.max(...boxes.map((b) => b.bottom)) + 20 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10)
  await page.mouse.up()
  await page.waitForFunction((n) => document.querySelectorAll('[data-selected]').length === n, fieldIds.length)
  // Une carte engagée, l'autre non : T engage celle qui ne l'est pas.
  await page.locator('[data-selected]').last().hover()
  await page.keyboard.press('t')
  await page.waitForFunction((list) => list.every((i) => document.querySelector(`[data-card-id="${i}"]`).style.transform.includes('rotate(90deg)')), fieldIds)
  check(true, `sélection de ${fieldIds.length} cartes : T les engage toutes`)
  await page.locator('[data-selected]').first().click({ button: 'right' })
  check(await page.getByRole('menuitem', { name: 'Exil' }).locator('[data-shortcut-hint]').innerText() === 'E', 'menu de la sélection : touches affichées')
  await page.keyboard.press('Escape')
  await mouseSelect()
  // Souris sur une carte du groupe (le jeton copie recouvre en partie l'original).
  await page.locator('[data-selected]').last().hover()
  await page.keyboard.press('e')
  await page.waitForFunction(() => document.querySelectorAll('[data-zone="battlefield"] [data-card-id]').length === 0)
  check(true, 'sélection : E exile tout le groupe')
  await page.keyboard.press('Control+z')
  await page.waitForFunction((n) => document.querySelectorAll('[data-zone="battlefield"] [data-card-id]').length === n, fieldIds.length)
  await page.keyboard.press('Escape')
  check(true, 'Ctrl+Z : le groupe revient en jeu')
  // Le jeton copie quitte le jeu (E sur lui seul) : il ne recouvre plus la carte pour la suite.
  await page.waitForFunction(() => document.querySelectorAll('[data-selected]').length === 0)
  await page.locator(`[data-zone="battlefield"] [data-card-id]:not([data-card-id="${id}"])`).hover()
  await page.keyboard.press('e')
  await page.waitForFunction(() => document.querySelectorAll('[data-zone="battlefield"] [data-card-id]').length === 1)

  // Changer une touche : « Engager / dégager » sur K ; T ne fait plus rien.
  await page.mouse.move(5, 5)
  await page.keyboard.press('?')
  const modal = page.getByRole('dialog', { name: 'Raccourcis clavier' })
  await modal.waitFor()
  check(await modal.locator('[data-shortcut="copy"] kbd').innerText() === 'X', 'fenêtre des raccourcis : X pour le jeton copie')
  await modal.locator('[data-shortcut="tap"]').getByRole('button', { name: 'Changer' }).click()
  await page.keyboard.press('k')
  check(await modal.locator('[data-shortcut="tap"] kbd').innerText() === 'K', 'touche choisie : K pour engager')
  await modal.locator('[data-shortcut="draw"]').getByRole('button', { name: 'Changer' }).click()
  await page.keyboard.press('Shift+F')
  check(await modal.locator('[data-shortcut="faceDown"] kbd').innerText() === '—', 'touche déjà prise : l’ancien raccourci la perd')
  check((await modal.getByRole('status').innerText()).includes('Face cachée'), 'touche déjà prise : la fenêtre le signale')
  await capture(page, 'fenetre')
  await page.keyboard.press('Escape')
  await modal.waitFor({ state: 'detached' })

  await page.reload()
  await page.getByRole('button', { name: /Reprendre la partie/ }).click()
  await inZone(page, 'battlefield', id).waitFor({ timeout: 15_000 })
  const field = inZone(page, 'battlefield', id)
  const wasTapped = await tapLabel(page, field)
  await field.hover()
  await page.keyboard.press('t')
  await page.waitForTimeout(400)
  check(await tapLabel(page, field) === wasTapped, 'T ne fait plus rien')
  await field.hover()
  await page.keyboard.press('k')
  check(await tapLabel(page, field) !== wasTapped, 'K engage ou dégage, mémorisé après rechargement')
  await field.click({ button: 'right' })
  check(await hint(/^(Engager|Dégager)/) === 'K', 'menu : la touche choisie (K) est affichée')
  await page.keyboard.press('Escape')

  // ── En ligne, à 2 : une carte de l'adversaire ──
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

  const bCard = bastien.page.locator('[data-zone="hand"] [data-card-id]').first()
  const bId = await bCard.getAttribute('data-card-id')
  await bCard.hover()
  await bastien.page.keyboard.press('b')
  const seen = ana.page.locator(`[data-card-id="${bId}"]`).first()
  await seen.waitFor({ timeout: 10_000 })
  check(true, 'en ligne : B de Bastien, Ana voit la carte arriver en jeu')
  // Une copie en ligne demande une image Scryfall, absente des données de test : T plutôt que X ici.
  await seen.hover()
  await ana.page.keyboard.press('t')
  const onBastien = bastien.page.locator(`[data-zone="battlefield"] [data-card-id="${bId}"]`)
  await bastien.page.waitForTimeout(800)
  check(await tapLabel(bastien.page, onBastien) === 'Dégager', 'en ligne : T d’Ana engage la carte de Bastien, Bastien la voit engagée')
  await capture(ana.page, 'en-ligne')

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` : ${errors.join(' | ')}` : ''}`)
} finally {
  await browser.close()
}
