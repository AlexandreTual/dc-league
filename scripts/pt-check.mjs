// Force et endurance modifiables sur la carte (issue #110) dans de vrais navigateurs :
// mode test à la souris, mode test sur téléphone (375 × 812, tactile), puis partie en ligne à 2.
// Prérequis : ceux de scripts/online-check.mjs (Worker, site, données de seed-online.mjs).
// Usage : node scripts/pt-check.mjs <url-de-base> <dossier-captures>
import { chromium } from 'playwright-core'
import { PLAYERS, tokenOf } from './seed-online.mjs'

const [base = 'http://localhost:8788', outDir = '.'] = process.argv.slice(2)
const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [ANA, BASTIEN] = PLAYERS

const browser = await chromium.launch({ executablePath })
const errors = []

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

async function openAs(player, viewport = { width: 1280, height: 900 }) {
  const mobile = viewport.width < 500
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
  const path = `${outDir}/pt-${shot}-${label}.png`
  await page.screenshot({ path })
  console.log(`📸 ${path}`)
}

const ptText = (locator) => locator.locator('[data-pt]').getAttribute('data-pt')
const waitPt = (page, selector, text) =>
  page.waitForFunction(([sel, t]) => document.querySelector(sel)?.querySelector('[data-pt]')?.getAttribute('data-pt') === t, [selector, text], { timeout: 10_000 })

/** Mode test, sauvegarde effacée, commandant lancé sur le champ de bataille par son menu. */
async function playtestWithCommander(who) {
  await who.page.goto(`${base}/decks/deck-${who.id}`)
  await who.page.evaluate((id) => localStorage.removeItem(`dc-playtest-${id}`), `deck-${who.id}`)
  await who.page.goto(`${base}/decks/deck-${who.id}/test`)
  await who.page.waitForSelector('[data-zone="hand"] [data-card-id]', { timeout: 15_000 })
  const commander = who.page.locator('[data-zone="command"] [data-card-id]:visible').first()
  const id = await commander.getAttribute('data-card-id')
  await commander.click({ button: 'right' })
  await who.page.getByRole('menuitem', { name: 'Champ de bataille' }).click()
  const card = `[data-zone="battlefield"] [data-card-id="${id}"]`
  await who.page.locator(card).waitFor()
  return card
}

try {
  // ── Mode test, à la souris ──
  const solo = await openAs(ANA)
  const { page } = solo
  const card = await playtestWithCommander(solo)
  const onField = page.locator(card)
  check((await ptText(onField)) === '5/5', 'commandant en jeu : encart 5/5 (force et endurance imprimées)')
  check(await page.locator('[data-zone="hand"] [data-pt]').count() === 0, 'pas d’encart sur les cartes en main')

  await onField.locator('[data-pt]').click()
  const menu = page.getByRole('menu')
  await menu.waitFor()
  check(!(await menu.getByRole('menuitem', { name: 'Engager' }).isVisible()), 'toucher l’encart : menu force/endurance seul (pas le menu de la carte)')
  await menu.getByRole('button', { name: 'Force plus' }).click()
  await menu.getByRole('button', { name: 'Force plus' }).click()
  await waitPt(page, card, '7/5')
  check(true, 'deux fois « + » sur la force : 7/5')
  await menu.getByLabel('Endurance : nombre').fill('-1')
  await menu.getByLabel('Endurance : nombre').press('Enter')
  await waitPt(page, card, '7/-1')
  check(true, 'endurance tapée directement, négative possible : 7/-1')
  const colors = await onField.locator('[data-pt] span').evaluateAll((s) => s.map((x) => x.className))
  check(colors[0].includes('green') && colors[1].includes('red'), 'force augmentée en vert, endurance diminuée en rouge')
  check(await menu.getByRole('menuitem', { name: 'Réinitialiser force/endurance' }).isVisible(), '« Réinitialiser » proposé une fois modifiée')
  await capture(page, 'menu-encart')
  await page.keyboard.press('Escape')
  const rotation = await onField.evaluate((el) => el.style.transform)
  check(!rotation.includes('90deg'), 'cliquer l’encart n’engage pas la carte')

  await onField.click({ button: 'right' })
  await menu.getByRole('button', { name: '+1/+1 plus' }).click()
  await waitPt(page, card, '8/0')
  check(true, 'marqueur +1/+1 compté dans l’encart : 8/0')
  await menu.getByRole('menuitem', { name: 'Réinitialiser force/endurance' }).click()
  await waitPt(page, card, '6/6')
  check(true, 'réinitialiser : marqueur gardé, modification retirée (6/6)')

  await page.getByRole('button', { name: /Journal/ }).click()
  const log = await page.getByTestId('log').innerText()
  check(log.includes('Kenrith, the Returned King : 7/5 (+2/+0)') && log.includes('Kenrith, the Returned King : 6/6'), 'journal : « Kenrith, the Returned King : 7/5 (+2/+0) »')
  await page.getByRole('button', { name: 'Fermer le journal' }).click()
  await capture(page, 'mode-test')

  // ── Mode test, sur téléphone : jeton Plante (0/1) du deck ──
  const phone = await openAs(ANA, { width: 375, height: 812 })
  await phone.page.goto(`${base}/decks/deck-${ANA.id}`)
  await phone.page.evaluate((id) => localStorage.removeItem(`dc-playtest-${id}`), `deck-${ANA.id}`)
  await phone.page.goto(`${base}/decks/deck-${ANA.id}/test`)
  await phone.page.waitForSelector('[data-zone="hand"] [data-card-id]', { timeout: 15_000 })
  // Téléphone en vertical : « Jeton » est dans le menu « ⋯ » de la barre.
  await phone.page.getByTestId('bar-more').tap()
  await phone.page.getByRole('button', { name: 'Jeton', exact: true }).tap()
  await phone.page.getByRole('dialog', { name: 'Créer un jeton' }).getByRole('button', { name: /Plante/ }).tap()
  const phoneCard = '[data-zone="battlefield"] [data-card-id="t1"]'
  const phoneField = phone.page.locator(phoneCard)
  await phoneField.waitFor()
  check((await ptText(phoneField)) === '0/1', 'téléphone : jeton Plante en jeu, encart 0/1')
  const box = await phoneField.locator('[data-pt]').boundingBox()
  check(box.width >= 30 && box.height >= 22, `téléphone : encart assez grand pour le doigt (${Math.round(box.width)} × ${Math.round(box.height)} px)`)
  await phone.page.waitForTimeout(400)
  await phoneField.locator('[data-pt]').tap()
  const phoneMenu = phone.page.getByRole('menu')
  await phoneMenu.waitFor()
  await phoneMenu.getByRole('button', { name: 'Force plus' }).tap()
  await waitPt(phone.page, phoneCard, '1/1')
  check(true, 'téléphone : toucher l’encart puis « + » : 1/1')
  const menuBox = await phoneMenu.boundingBox()
  check(menuBox.x >= 0 && menuBox.x + menuBox.width <= 375 && menuBox.y >= 0, 'téléphone : menu dans l’écran')
  await capture(phone.page, 'telephone')
  await phone.page.touchscreen.tap(360, 120)

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

  const anaCommander = ana.page.locator(`[data-zone="command"][data-player="${ANA.id}"] [data-card-id]`).first()
  const commanderId = await anaCommander.getAttribute('data-card-id')
  await anaCommander.click({ button: 'right' })
  await ana.page.getByRole('menuitem', { name: 'Champ de bataille' }).click()
  const seenByBastien = `[data-zone="battlefield"][data-player="${ANA.id}"] [data-card-id="${commanderId}"], [data-zone="battlefield"][data-player="${ANA.id}"] [data-strip-card="${commanderId}"]`
  await waitPt(bastien.page, seenByBastien, '5/5')
  check(true, 'Bastien voit l’encart 5/5 du commandant d’Ana')
  await bastien.page.locator(seenByBastien).locator('[data-pt]').click()
  await bastien.page.getByRole('menu').getByLabel('Force : nombre').fill('9')
  await bastien.page.getByRole('menu').getByLabel('Force : nombre').press('Enter')
  const seenByAna = `[data-zone="battlefield"] [data-card-id="${commanderId}"]`
  await waitPt(ana.page, seenByAna, '9/5')
  check(true, 'Bastien modifie la force du commandant d’Ana : Ana voit 9/5')
  await bastien.page.keyboard.press('Escape')
  await capture(ana.page, 'en-ligne-ana')
  await capture(bastien.page, 'en-ligne-bastien')

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` : ${errors.join(' | ')}` : ''}`)
} finally {
  await browser.close()
}
