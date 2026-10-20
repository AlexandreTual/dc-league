// Force et endurance « jusqu'à la fin du tour » et fenêtre « Effet » (Finale of Devastation : +X/+X et Célérité à toutes
// mes créatures) dans de vrais navigateurs : mode test à la souris (encart, menu, toutes mes créatures, sélection,
// fin du tour), tablette (appui long, 1180 × 820), puis partie en ligne à 2 (un adversaire modifie pour ce tour).
// Prérequis : ceux de scripts/online-check.mjs (Worker, site, données de seed-online.mjs : Llanowar Elves, Ange de Serra).
// Usage : node scripts/effect-check.mjs <url-de-base> <dossier-captures>
import { chromium } from 'playwright-core'
import { PLAYERS, tokenOf } from './seed-online.mjs'

const [base = 'http://localhost:8788', outDir = '.'] = process.argv.slice(2)
const executablePath = process.env.CHROME ?? process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [ANA, BASTIEN] = PLAYERS
const ELVES = 'Llanowar Elves'
const ANGEL = 'Ange de Serra'

const browser = await chromium.launch({ executablePath })
const errors = []

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

async function openAs(player, { viewport = { width: 1280, height: 900 }, mobile = false } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile })
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
  const path = `${outDir}/effect-${shot}-${label}.png`
  await page.screenshot({ path })
  console.log(`📸 ${path}`)
}

/** Carte du joueur mise sur son champ de bataille, à la position donnée (en %) : depuis sa main, sinon sa bibliothèque. */
async function onBattlefield(who, name, solo = false) {
  const { page } = who
  const me = solo ? await page.locator('[data-zone="hand"][data-player]').first().getAttribute('data-player') : who.id
  const inHand = page.locator(`[data-zone="hand"][data-player="${me}"] [data-card-id]:has([title="${name}"])`).first()
  let id
  if (await inHand.count()) {
    id = await inHand.getAttribute('data-card-id')
    await inHand.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Champ de bataille' }).click()
  } else {
    await page.locator(`[data-zone="library"][data-player="${me}"]`).click({ button: 'right' })
    await page.getByRole('menuitem', { name: /Chercher une carte/ }).click()
    const pileCard = page.locator(`[data-pile-card]:has([title="${name}"])`).first()
    id = await pileCard.getAttribute('data-pile-card')
    await pileCard.getByRole('button', { name: 'Champ', exact: true }).click()
    await page.getByRole('button', { name: 'Fermer', exact: true }).click()
  }
  const card = `[data-zone="battlefield"][data-player="${me}"] [data-card-id="${id}"]`
  await page.locator(card).waitFor()
  return card
}

async function playtest(who) {
  await who.page.goto(`${base}/decks/deck-${who.id}`)
  await who.page.evaluate((id) => {
    localStorage.removeItem(`dc-playtest-${id}`)
    localStorage.removeItem('dc-table-settings')
  }, `deck-${who.id}`)
  await who.page.goto(`${base}/decks/deck-${who.id}/test`)
  await who.page.waitForSelector('[data-zone="hand"] [data-card-id]', { timeout: 15_000 })
}

/** Force/endurance affichées et écart « ce tour » (null sans écart) d'une carte. */
const ptOf = (page, card) => page.locator(card).locator('[data-pt]').first().evaluate((el) => [el.getAttribute('data-pt'), el.getAttribute('data-pt-turn')])
const waitPt = (page, card, text) =>
  page.waitForFunction(([sel, t]) => document.querySelector(sel)?.querySelector('[data-pt]')?.getAttribute('data-pt') === t, [card, text], { timeout: 10_000 })
const badgesOf = (page, card) => page.locator(card).evaluate((el) =>
  [...el.querySelectorAll('[data-ability]')].map((b) => [b.getAttribute('data-ability'), b.getAttribute('data-ability-state')]))

/** Glisse une carte de (dx, dy) pixels à la souris. */
async function dragBy(page, card, dx, dy) {
  const box = await page.locator(card).boundingBox()
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(from.x + (dx * i) / 10, from.y + (dy * i) / 10)
  await page.mouse.up()
  await page.waitForTimeout(300)
}

async function logText(page) {
  await page.getByRole('button', { name: /Journal/ }).click()
  const text = await page.getByTestId('log').innerText()
  await page.getByRole('button', { name: 'Fermer le journal' }).click()
  return text
}

/** Remplit la fenêtre « Effet » et valide. */
async function applyEffect(dialog, { power = 0, toughness = 0, abilities = [], always = false }) {
  await dialog.getByRole('textbox', { name: 'Force', exact: true }).fill(String(power))
  await dialog.getByRole('textbox', { name: 'Endurance', exact: true }).fill(String(toughness))
  for (const label of abilities) await dialog.getByRole('checkbox', { name: new RegExp(`^${label}`) }).check()
  if (always) await dialog.getByRole('radio', { name: 'Tout le temps' }).check()
  await dialog.getByRole('button', { name: 'Valider' }).click()
  await dialog.waitFor({ state: 'detached' })
}

try {
  // ── Mode test, à la souris ──
  const solo = await openAs(ANA)
  const { page } = solo
  await playtest(solo)
  const elves = await onBattlefield(solo, ELVES, true)
  await dragBy(page, elves, -260, 0)
  const angel = await onBattlefield(solo, ANGEL, true)
  check(JSON.stringify(await ptOf(page, elves)) === '["1/1",null]' && JSON.stringify(await ptOf(page, angel)) === '["4/4",null]', 'Elfes 1/1 et Ange 4/4 en jeu')

  await page.locator(elves).locator('[data-pt]').click()
  const menu = page.getByRole('menu')
  await menu.waitFor()
  check(await menu.getByText('Force ce tour').isVisible() && await menu.getByText('Endurance ce tour').isVisible(), 'encart : lignes « Force ce tour » et « Endurance ce tour »')
  await menu.getByRole('button', { name: 'Force ce tour plus' }).click()
  await menu.getByRole('button', { name: 'Force ce tour plus' }).click()
  await waitPt(page, elves, '3/1')
  check((await ptOf(page, elves))[1] === '+2/+0', 'deux fois « + » sur « Force ce tour » : 3/1, écart du tour +2/+0')
  const dashed = await page.locator(elves).locator('[data-pt]').evaluate((el) => getComputedStyle(el).borderStyle)
  check(dashed === 'dashed', 'encart en pointillés tant qu’une modification du tour reste')
  await capture(page, 'encart-ce-tour')
  await page.keyboard.press('Escape')

  await page.locator(angel).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Effet sur toutes mes créatures…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Effet : toutes mes créatures (2)' })
  await dialog.waitFor()
  check(await dialog.getByRole('radio', { name: 'Jusqu’à la fin du tour' }).isChecked(), 'fenêtre « Effet » : durée « Jusqu’à la fin du tour » par défaut')
  check(await dialog.getByRole('button', { name: 'Valider' }).isDisabled(), 'fenêtre « Effet » : « Valider » grisé tant que rien n’est choisi')
  await dialog.getByRole('button', { name: 'Force +1' }).click()
  check(await dialog.getByRole('textbox', { name: 'Force', exact: true }).inputValue() === '1', 'bouton « + » de la force : 1')
  await capture(page, 'fenetre-effet')
  await applyEffect(dialog, { power: 10, toughness: 10, abilities: ['Célérité'] })
  await waitPt(page, elves, '13/11')
  await waitPt(page, angel, '14/14')
  check(true, 'Finale of Devastation (X = 10) : Elfes 13/11, Ange 14/14')
  check(JSON.stringify(await badgesOf(page, elves)) === '[["Haste","eot"]]', 'Célérité donnée jusqu’à la fin du tour (symbole en pointillés)')
  check((await logText(page)).includes('donne +10/+10 et Célérité à Llanowar Elves et Ange de Serra (jusqu’à la fin du tour)'), 'journal : une seule ligne pour l’effet')
  await capture(page, 'effet-applique')

  await page.getByRole('button', { name: /Fin de tour/ }).click()
  await waitPt(page, elves, '1/1')
  await waitPt(page, angel, '4/4')
  check((await badgesOf(page, elves)).length === 0, 'fin du tour : force, endurance et Célérité reviennent comme avant')

  await page.locator(elves).click({ modifiers: ['Shift'] })
  await page.locator(angel).click({ modifiers: ['Shift'] })
  await page.locator(angel).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Effet sur la sélection…' }).click()
  const selDialog = page.getByRole('dialog', { name: 'Effet : 2 cartes sélectionnées (2)' })
  await selDialog.waitFor()
  await applyEffect(selDialog, { power: 2, toughness: 0, always: true })
  await waitPt(page, elves, '3/1')
  check((await ptOf(page, elves))[1] === null, 'effet « Tout le temps » sur la sélection : +2/+0 permanent')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /Fin de tour/ }).click()
  await page.waitForTimeout(500)
  check((await ptOf(page, angel))[0] === '6/4', 'fin du tour : la modification permanente reste (Ange 6/4)')

  // ── Tablette : appui long, fenêtre « Effet » dans l'écran ──
  const tablet = await openAs(ANA, { viewport: { width: 1180, height: 820 }, mobile: true })
  await playtest(tablet)
  const tabletElves = await onBattlefield(tablet, ELVES, true)
  const cdp = await tablet.page.context().newCDPSession(tablet.page)
  const box = await tablet.page.locator(tabletElves).boundingBox()
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 3 }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
  await tablet.page.waitForTimeout(700)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await tablet.page.getByRole('menuitem', { name: 'Effet sur toutes mes créatures…' }).tap()
  const tabletDialog = tablet.page.getByRole('dialog', { name: /^Effet : / })
  await tabletDialog.waitFor()
  const dialogBox = await tabletDialog.boundingBox()
  check(dialogBox.y >= 0 && dialogBox.y + dialogBox.height <= 820, `tablette : fenêtre dans l’écran (${Math.round(dialogBox.height)} px de haut)`)
  const plus = await tabletDialog.getByRole('button', { name: 'Force +1' }).boundingBox()
  check(plus.height >= 44, `tablette : boutons − / + de 44 px (${Math.round(plus.height)} px)`)
  await tabletDialog.getByRole('button', { name: 'Force +1' }).tap()
  await tabletDialog.getByRole('button', { name: 'Endurance +1' }).tap()
  await tabletDialog.getByRole('button', { name: 'Valider' }).tap()
  await waitPt(tablet.page, tabletElves, '2/2')
  check(true, 'tablette : +1/+1 jusqu’à la fin du tour au doigt')
  await capture(tablet.page, 'tablette')

  // ── En ligne, à 2 : Bastien modifie pour ce tour le commandant d'Ana ──
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
  const anaCommander = ana.page.locator(`[data-zone="command"][data-player="${ANA.id}"] [data-card-id]`).first()
  const commanderId = await anaCommander.getAttribute('data-card-id')
  await anaCommander.click({ button: 'right' })
  await ana.page.getByRole('menuitem', { name: 'Champ de bataille' }).click()
  const seenByBastien = `[data-zone="battlefield"][data-player="${ANA.id}"] [data-card-id="${commanderId}"], [data-zone="battlefield"][data-player="${ANA.id}"] [data-strip-card="${commanderId}"]`
  await waitPt(bastien.page, seenByBastien, '5/5')
  await bastien.page.locator(seenByBastien).locator('[data-pt]').click()
  await bastien.page.getByRole('menu').getByLabel('Force ce tour : nombre').fill('3')
  await bastien.page.getByRole('menu').getByLabel('Force ce tour : nombre').press('Enter')
  const seenByAna = `[data-zone="battlefield"] [data-card-id="${commanderId}"]`
  await waitPt(ana.page, seenByAna, '8/5')
  check((await ptOf(ana.page, seenByAna))[1] === '+3/+0', 'en ligne : Bastien donne +3/+0 pour ce tour au commandant d’Ana, Ana voit 8/5')
  await bastien.page.keyboard.press('Escape')
  await capture(ana.page, 'en-ligne-ana')
  await ana.page.getByRole('button', { name: /Fin de tour/ }).click()
  await waitPt(ana.page, seenByAna, '5/5')
  await waitPt(bastien.page, seenByBastien, '5/5')
  check(true, 'en ligne : fin du tour d’Ana, 5/5 chez les deux joueurs')

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` : ${errors.join(' | ')}` : ''}`)
} finally {
  await browser.close()
}
