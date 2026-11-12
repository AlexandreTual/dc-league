// Loyauté modifiable sur un planeswalker en jeu, dans de vrais navigateurs :
// mode test à la souris, mode test sur tablette (1180 × 820, tactile), puis partie en ligne à 2.
// Prérequis : ceux de scripts/online-check.mjs (Worker, site, données de seed-online.mjs : Teferi, loyauté 4).
// Usage : node scripts/loyalty-check.mjs <url-de-base> <dossier-captures>
import { launch } from './browser.mjs'
import { PLAYERS, tokenOf } from './seed-online.mjs'

const [base = 'http://localhost:8788', outDir = '.'] = process.argv.slice(2)
const [ANA, BASTIEN] = PLAYERS
const TEFERI = 'Teferi, Time Raveler'

const browser = await launch()
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
  const path = `${outDir}/loyalty-${shot}-${label}.png`
  await page.screenshot({ path })
  console.log(`📸 ${path}`)
}

const loyaltyOf = (locator) => locator.locator('[data-loyalty]').getAttribute('data-loyalty')
const waitLoyalty = (page, selector, text) =>
  page.waitForFunction(([sel, t]) => document.querySelector(sel)?.querySelector('[data-loyalty]')?.getAttribute('data-loyalty') === t, [selector, text], { timeout: 10_000 })

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
  check((await loyaltyOf(onField)) === '4', 'Teferi en jeu : encart de loyauté 4 (loyauté imprimée)')
  check(await onField.locator('[data-pt]').count() === 0, 'pas d’encart force/endurance sur un planeswalker')
  check(await page.locator('[data-zone="hand"] [data-loyalty]').count() === 0, 'pas d’encart sur les cartes en main')

  await onField.locator('[data-loyalty]').click()
  const menu = page.getByRole('menu')
  await menu.waitFor()
  check(!(await menu.getByRole('menuitem', { name: 'Engager' }).isVisible()), 'toucher l’encart : menu de loyauté seul (pas le menu de la carte)')
  check(!(await menu.getByRole('button', { name: 'Force plus' }).isVisible()), 'menu de l’encart : ni force ni endurance')
  await menu.getByRole('button', { name: 'Loyauté plus' }).click()
  await waitLoyalty(page, card, '5')
  check(true, '« + » : loyauté 5')
  const color = await onField.locator('[data-loyalty] span').getAttribute('class')
  check(color.includes('green'), 'loyauté augmentée en vert')
  await menu.getByLabel('Loyauté : nombre').fill('1')
  await menu.getByLabel('Loyauté : nombre').press('Enter')
  await waitLoyalty(page, card, '1')
  check((await onField.locator('[data-loyalty] span').getAttribute('class')).includes('red'), 'loyauté tapée directement (1), diminuée en rouge')
  await menu.getByRole('button', { name: 'Loyauté moins' }).click()
  await waitLoyalty(page, card, '0')
  await menu.getByRole('button', { name: 'Loyauté moins' }).click()
  await page.waitForTimeout(300)
  check((await loyaltyOf(onField)) === '0', 'jamais sous 0')
  check(await menu.getByRole('menuitem', { name: 'Réinitialiser la loyauté' }).isVisible(), '« Réinitialiser » proposé une fois modifiée')
  await capture(page, 'menu-encart')
  await page.keyboard.press('Escape')
  const rotation = await onField.evaluate((el) => el.style.transform)
  check(!rotation.includes('90deg'), 'cliquer l’encart n’engage pas la carte')

  await onField.click({ button: 'right' })
  check(await menu.getByRole('button', { name: 'Loyauté plus' }).isVisible(), 'menu de la carte : réglage « Loyauté »')
  await menu.getByRole('menuitem', { name: 'Réinitialiser la loyauté' }).click()
  await waitLoyalty(page, card, '4')
  check(true, 'réinitialiser : loyauté imprimée (4)')

  await page.getByRole('button', { name: /Journal/ }).click()
  const log = await page.getByTestId('log').innerText()
  check(log.includes(`${TEFERI} : loyauté 5`) && log.includes(`${TEFERI} : loyauté 0`), `journal : « ${TEFERI} : loyauté 5 »`)
  await page.getByRole('button', { name: 'Fermer le journal' }).click()

  await onField.click({ button: 'right' })
  await menu.getByRole('button', { name: 'Loyauté plus' }).click()
  await waitLoyalty(page, card, '5')
  await menu.getByRole('menuitem', { name: 'Main' }).click()
  const back = await teferiOnBattlefield(solo, true)
  check((await loyaltyOf(page.locator(back))) === '4', 'renvoyé en main puis rejoué : loyauté imprimée (4)')
  await capture(page, 'mode-test')

  // ── Mode test, sur tablette (tactile) ──
  const tablet = await openAs(ANA, { width: 1180, height: 820 }, true)
  await playtest(tablet)
  const tabletCard = await teferiOnBattlefield(tablet, true)
  const tabletField = tablet.page.locator(tabletCard)
  const box = await tabletField.locator('[data-loyalty]').boundingBox()
  check(box.width >= 30 && box.height >= 22, `tablette : encart assez grand pour le doigt (${Math.round(box.width)} × ${Math.round(box.height)} px)`)
  await tablet.page.waitForTimeout(400)
  await tabletField.locator('[data-loyalty]').tap()
  const tabletMenu = tablet.page.getByRole('menu')
  await tabletMenu.waitFor()
  await tabletMenu.getByRole('button', { name: 'Loyauté moins' }).tap()
  await waitLoyalty(tablet.page, tabletCard, '3')
  check(true, 'tablette : toucher l’encart puis « − » : loyauté 3')
  const menuBox = await tabletMenu.boundingBox()
  check(menuBox.x >= 0 && menuBox.x + menuBox.width <= 1180 && menuBox.y >= 0 && menuBox.y + menuBox.height <= 820, 'tablette : menu dans l’écran')
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
  await waitLoyalty(bastien.page, seenByBastien, '4')
  check(true, 'Bastien voit l’encart de loyauté 4 du Teferi d’Ana')
  await bastien.page.locator(seenByBastien).locator('[data-loyalty]').click()
  await bastien.page.getByRole('menu').getByLabel('Loyauté : nombre').fill('7')
  await bastien.page.getByRole('menu').getByLabel('Loyauté : nombre').press('Enter')
  await waitLoyalty(ana.page, anaCard, '7')
  check(true, 'Bastien modifie la loyauté du Teferi d’Ana : Ana voit 7')
  await bastien.page.keyboard.press('Escape')
  await capture(ana.page, 'en-ligne-ana')
  await capture(bastien.page, 'en-ligne-bastien')

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` : ${errors.join(' | ')}` : ''}`)
} finally {
  await browser.close()
}
