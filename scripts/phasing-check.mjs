// Permanent hors phase, dans de vrais navigateurs : mode test (passer hors phase, retour au début de son tour),
// mode test sur tablette (1180 × 820, tactile), puis partie en ligne à 2.
// Prérequis : ceux de scripts/online-check.mjs (Worker, site, données de seed-online.mjs : Teferi).
// Usage : node scripts/phasing-check.mjs <url-de-base> <dossier-captures>
import { chromium } from 'playwright-core'
import { PLAYERS, tokenOf } from './seed-online.mjs'

const [base = 'http://localhost:8788', outDir = '.'] = process.argv.slice(2)
const executablePath = process.env.CHROME ?? process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [ANA, BASTIEN] = PLAYERS
const TEFERI = 'Teferi, Time Raveler'

const browser = await chromium.launch({ executablePath })
const errors = []

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

async function openAs(player, viewport = { width: 1280, height: 900 }, mobile = false) {
  const context = await browser.newContext({ locale: 'fr-FR', viewport, hasTouch: mobile, isMobile: mobile })
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
  const path = `${outDir}/phasing-${shot}-${label}.png`
  await page.screenshot({ path })
  console.log(`📸 ${path}`)
}

/** Attend que la carte soit (ou ne soit plus) hors phase. */
const waitPhased = (page, selector, phased) =>
  page.waitForFunction(([sel, p]) => !!document.querySelector(sel)?.querySelector('[data-phased]') === p, [selector, phased], { timeout: 10_000 })

/** Teferi du joueur sur son champ de bataille : depuis sa main, sinon en le cherchant dans sa bibliothèque. Renvoie son sélecteur. */
async function teferiOnBattlefield(who, solo = false) {
  const { page } = who
  // Mode test : le joueur a un identifiant local, celui de la seule main affichée.
  const me = solo ? await page.locator('[data-zone="hand"][data-player]').first().getAttribute('data-player') : who.id
  const inHand = page.locator(`[data-zone="hand"][data-player="${me}"] [data-card-id]:has([title="${TEFERI}"])`).first()
  let id
  if (await inHand.count()) {
    id = await inHand.getAttribute('data-card-id')
    await inHand.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Champ de bataille' }).click()
  } else {
    await page.locator(`[data-zone="library"][data-player="${me}"]`).click({ button: 'right' })
    await page.getByRole('menuitem', { name: /Chercher une carte/ }).click()
    const pileCard = page.locator(`[data-pile-card]:has([title="${TEFERI}"])`).first()
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
  await who.page.evaluate((id) => localStorage.removeItem(`dc-playtest-${id}`), `deck-${who.id}`)
  await who.page.goto(`${base}/decks/deck-${who.id}/test`)
  await who.page.waitForSelector('[data-zone="hand"] [data-card-id]', { timeout: 15_000 })
}

try {
  // ── Mode test, à la souris ──
  const solo = await openAs(ANA)
  const { page } = solo
  await playtest(solo)
  const card = await teferiOnBattlefield(solo, true)
  const onField = page.locator(card)
  check(await onField.locator('[data-phased]').count() === 0, 'Teferi en jeu : en phase')
  await onField.dblclick()
  await page.waitForTimeout(250)
  await onField.click({ button: 'right' })
  const menu = page.getByRole('menu')
  await menu.getByRole('menuitem', { name: 'Passer hors phase' }).click()
  await waitPhased(page, card, true)
  check((await onField.textContent()).includes('Hors phase'), 'menu « Passer hors phase » : carte estompée, mention « Hors phase »')
  check((await onField.evaluate((el) => el.style.transform)).includes('rotate(90deg)'), 'hors phase, la carte reste engagée')
  await capture(page, 'hors-phase')

  await onField.click({ button: 'right' })
  check(await menu.getByRole('menuitem', { name: 'Revenir en phase' }).isVisible(), 'menu : « Revenir en phase »')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: /Fin de tour/ }).click()
  await waitPhased(page, card, false)
  check(true, 'tour suivant : Teferi revient en phase')
  check(!(await onField.evaluate((el) => el.style.transform)).includes('rotate(90deg)'), 'tour suivant : revenu en phase, puis dégagé')

  await page.getByRole('button', { name: /Journal/ }).click()
  const log = await page.getByTestId('log').innerText()
  check(log.includes(`${TEFERI} passe hors phase`) && log.includes(`${TEFERI} revient en phase`), `journal : « ${TEFERI} passe hors phase » puis « revient en phase »`)
  await page.getByRole('button', { name: 'Fermer le journal' }).click()

  // ── Mode test, sur tablette (tactile) ──
  const tablet = await openAs(ANA, { width: 1180, height: 820 }, true)
  await playtest(tablet)
  const tabletCard = await teferiOnBattlefield(tablet, true)
  const tabletField = tablet.page.locator(tabletCard)
  await tablet.page.waitForTimeout(400)
  await tabletField.click({ button: 'right' })
  await tablet.page.getByRole('menu').getByRole('menuitem', { name: 'Passer hors phase' }).tap()
  await waitPhased(tablet.page, tabletCard, true)
  check(true, 'tablette : « Passer hors phase » au doigt')
  await capture(tablet.page, 'tablette')

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

  const anaCard = await teferiOnBattlefield(ana)
  const teferiId = await ana.page.locator(anaCard).getAttribute('data-card-id')
  const seenByBastien = `[data-zone="battlefield"][data-player="${ANA.id}"] [data-card-id="${teferiId}"], [data-zone="battlefield"][data-player="${ANA.id}"] [data-strip-card="${teferiId}"]`
  await bastien.page.locator(seenByBastien).waitFor()
  await bastien.page.locator(seenByBastien).click({ button: 'right' })
  await bastien.page.getByRole('menu').getByRole('menuitem', { name: 'Passer hors phase' }).click()
  await waitPhased(ana.page, anaCard, true)
  await waitPhased(bastien.page, seenByBastien, true)
  check(true, 'Bastien fait passer le Teferi d’Ana hors phase : les deux le voient')
  await capture(ana.page, 'en-ligne-ana')
  await capture(bastien.page, 'en-ligne-bastien')
  await ana.page.locator(anaCard).click({ button: 'right' })
  await ana.page.getByRole('menu').getByRole('menuitem', { name: 'Revenir en phase' }).click()
  await waitPhased(bastien.page, seenByBastien, false)
  check(true, 'Ana le fait revenir en phase : Bastien le voit')

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` : ${errors.join(' | ')}` : ''}`)
} finally {
  await browser.close()
}
