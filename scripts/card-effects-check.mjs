// Reflet des permanents légendaires en jeu, dans de vrais navigateurs : mode test à la souris (réglage « Animations
// des cartes »), mouvement réduit, tablette (1180 × 820, tactile), puis partie en ligne à 2.
// Prérequis : ceux de scripts/online-check.mjs (Worker, site, données de seed-online.mjs : Teferi légendaire, Anneau solaire).
// Usage : node scripts/card-effects-check.mjs <url-de-base> <dossier-captures>
import { chromium } from 'playwright-core'
import { PLAYERS, tokenOf } from './seed-online.mjs'

const [base = 'http://localhost:8788', outDir = '.'] = process.argv.slice(2)
const executablePath = process.env.CHROME ?? process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [ANA, BASTIEN] = PLAYERS
const TEFERI = 'Teferi, Time Raveler'
const SOL_RING = 'Anneau solaire'

const browser = await chromium.launch({ executablePath })
const errors = []

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

async function openAs(player, { viewport = { width: 1280, height: 900 }, mobile = false, reducedMotion = 'no-preference' } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile, reducedMotion })
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
  const path = `${outDir}/card-effects-${shot}-${label}.png`
  await page.screenshot({ path })
  console.log(`📸 ${path}`)
}

/** Carte du joueur mise sur son champ de bataille : depuis sa main, sinon en la cherchant dans sa bibliothèque. Renvoie son sélecteur. */
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

/** Reflet d'une carte : présent, et nom de l'animation de sa bande lumineuse (« none » si masquée). */
const sheenOf = (locator) => locator.evaluate((el) => {
  const band = el.querySelector('.card-sheen > i')
  if (!band) return { present: false }
  const style = getComputedStyle(band)
  return { present: true, animation: style.display === 'none' ? 'none' : style.animationName, delay: style.animationDelay }
})

async function setEffects(page, on) {
  await page.getByRole('button', { name: 'Réglages' }).click()
  const box = page.getByRole('dialog', { name: 'Réglages de la table' }).getByLabel('Animations des cartes')
  if (on) await box.check()
  else await box.uncheck()
  await page.getByRole('button', { name: 'Fermer les réglages' }).click()
}

try {
  // ── Mode test, à la souris ──
  const solo = await openAs(ANA)
  const { page } = solo
  await playtest(solo)
  const teferi = page.locator(await onBattlefield(solo, TEFERI, true))
  const sheen = await sheenOf(teferi)
  check(sheen.present && sheen.animation === 'card-sheen', 'Teferi (légendaire) en jeu : liseré doré et reflet animé')
  check(sheen.delay.startsWith('-'), `reflet décalé propre à la carte (${sheen.delay})`)
  check(await page.locator('[data-zone="hand"] .card-sheen, [data-pile] .card-sheen').count() === 0, 'aucun reflet hors du champ de bataille')
  const box = await teferi.boundingBox()
  const sheenBox = await teferi.locator('.card-sheen').boundingBox()
  check(Math.abs(box.width - sheenBox.width) < 2 && Math.abs(box.height - sheenBox.height) < 2, 'reflet aux dimensions de la carte')
  await capture(page, 'mode-test')

  await teferi.dblclick()
  await page.waitForFunction((sel) => document.querySelector(sel)?.style.transform.includes('90deg'), await teferi.evaluate((el) => `[data-card-id="${el.dataset.cardId}"]`))
  check((await sheenOf(teferi)).animation === 'card-sheen', 'Teferi engagé : garde son reflet')
  await capture(page, 'engage')

  // Posé au même endroit que Teferi, l'Anneau solaire le recouvre : à vérifier après le double-clic.
  const sol = page.locator(await onBattlefield(solo, SOL_RING, true))
  check(!(await sheenOf(sol)).present, 'Anneau solaire (non légendaire) : aucun effet')

  await setEffects(page, false)
  check(!(await sheenOf(teferi)).present, 'réglage « Animations des cartes » décoché : plus de reflet')
  await page.reload()
  await page.getByRole('button', { name: /Reprendre la partie/ }).click()
  await page.waitForSelector('[data-zone="hand"] [data-card-id]', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Réglages' }).click()
  const box2 = page.getByRole('dialog', { name: 'Réglages de la table' }).getByLabel('Animations des cartes')
  check(!(await box2.isChecked()), 'réglage mémorisé après rechargement')
  await page.getByRole('button', { name: 'Fermer les réglages' }).click()
  check(!(await sheenOf(teferi)).present, 'partie reprise : Teferi toujours sans reflet')
  await setEffects(page, true)
  check((await sheenOf(teferi)).animation === 'card-sheen', 'recoché : reflet revenu')

  // ── Mouvement réduit (réglage du système) ──
  const calm = await openAs(ANA, { reducedMotion: 'reduce' })
  await playtest(calm)
  const calmTeferi = calm.page.locator(await onBattlefield(calm, TEFERI, true))
  const calmSheen = await sheenOf(calmTeferi)
  check(calmSheen.present && calmSheen.animation === 'none', 'mouvement réduit : liseré doré seul, pas de reflet animé')

  // ── Mode test, sur tablette (tactile) ──
  const tablet = await openAs(ANA, { viewport: { width: 1180, height: 820 }, mobile: true })
  await playtest(tablet)
  const tabletTeferi = tablet.page.locator(await onBattlefield(tablet, TEFERI, true))
  check((await sheenOf(tabletTeferi)).animation === 'card-sheen', 'tablette : reflet sur Teferi')
  await tabletTeferi.locator('[data-loyalty]').tap()
  await tablet.page.getByRole('menu').waitFor()
  check(true, 'tablette : le reflet ne gêne pas le toucher (encart de loyauté)')
  await tablet.page.keyboard.press('Escape')
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

  const anaCard = await onBattlefield(ana, TEFERI)
  check((await sheenOf(ana.page.locator(anaCard))).animation === 'card-sheen', 'en ligne : Ana voit le reflet de son Teferi')
  const teferiId = await ana.page.locator(anaCard).getAttribute('data-card-id')
  const seenByBastien = bastien.page.locator(`[data-zone="battlefield"][data-player="${ANA.id}"] [data-card-id="${teferiId}"], [data-zone="battlefield"][data-player="${ANA.id}"] [data-strip-card="${teferiId}"]`)
  await seenByBastien.waitFor()
  check((await sheenOf(seenByBastien)).animation === 'card-sheen', 'en ligne : Bastien voit le reflet du Teferi d’Ana')
  await capture(ana.page, 'en-ligne-ana')
  await capture(bastien.page, 'en-ligne-bastien')

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` : ${errors.join(' | ')}` : ''}`)
} finally {
  await browser.close()
}
