// Lancer de dés (issue #99) dans de vrais navigateurs : mode test, puis partie en ligne à 2.
// Prérequis : ceux de scripts/online-check.mjs (Worker, site, données de seed-online.mjs).
// Usage : node scripts/dice-check.mjs <url-de-base> <dossier-captures>
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
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 500 })
  await context.addCookies([{ name: 'dc_session', value: tokenOf(player.id), url: base }])
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`${player.name} : ${e.message}`))
  page.on('dialog', (d) => d.accept(d.defaultValue()))
  return { ...player, page }
}

let shot = 0
async function capture(page, label) {
  shot++
  const path = `${outDir}/dice-${shot}-${label}.png`
  await page.screenshot({ path })
  console.log(`📸 ${path}`)
}

const rollLine = (page) => page.getByTestId('activity-roll').last()

try {
  // ── Mode test, sur téléphone ──
  const solo = await openAs(ANA, { width: 375, height: 812 })
  // Effacer une éventuelle sauvegarde avant d'ouvrir la page de test (même origine).
  await solo.page.goto(`${base}/decks/deck-${ANA.id}`)
  await solo.page.evaluate((id) => localStorage.removeItem(`dc-playtest-${id}`), `deck-${ANA.id}`)
  await solo.page.goto(`${base}/decks/deck-${ANA.id}/test`)
  await solo.page.waitForSelector('[data-zone="hand"] [data-card-id]', { timeout: 15_000 })
  await solo.page.getByRole('button', { name: 'Dés' }).click()
  await solo.page.getByRole('dialog', { name: 'Lancer les dés' }).waitFor()
  for (let i = 0; i < 2; i++) await solo.page.getByRole('button', { name: 'Un dé de plus' }).click()
  check((await solo.page.getByTestId('dice-count').innerText()) === '3', 'mode test : 3 dés choisis')
  await capture(solo.page, 'fenetre-telephone')
  await solo.page.getByTestId('roll-d6').click()
  const soloText = await rollLine(solo.page).innerText()
  check(/Lance 3d6 : [1-6], [1-6], [1-6] \(total \d+\)/.test(soloText), `mode test : résultat affiché sur la table (« ${soloText} »)`)
  check(await solo.page.getByTestId('mulligan-banner').isVisible(), 'mode test : lancer pendant la main de départ, main pas gardée')
  await capture(solo.page, 'resultat-telephone')
  check(await solo.page.getByRole('button', { name: 'Annuler' }).isDisabled(), 'mode test : un lancer ne s’annule pas')
  await solo.page.getByRole('button', { name: 'Dés' }).click()
  check((await solo.page.getByTestId('dice-count').innerText()) === '3', 'mode test : le nombre de dés est retenu')
  await solo.page.getByTestId('roll-coin').click()
  await solo.page.getByTestId('activity-roll').filter({ hasText: /Pile ou face : (Pile|Face)/ }).waitFor()
  check(true, 'mode test : pile ou face')

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
    // « Qui commence ? » : fermé avant de lancer les dés.
    await who.page.getByTestId('start-draw').waitFor()
    await who.page.keyboard.press('Escape')
    await who.page.getByTestId('start-draw').waitFor({ state: 'detached' })
  }

  await bastien.page.getByRole('button', { name: 'Dés' }).click()
  await bastien.page.getByTestId('roll-d20').click()
  await rollLine(bastien.page).waitFor()
  await rollLine(ana.page).waitFor()
  const seenByBastien = (await rollLine(bastien.page).innerText()).trim()
  const seenByAna = (await rollLine(ana.page).innerText()).replace(/\s+/g, ' ').trim()
  check(/^Bastien Lance un d20 : \d+$/.test(seenByAna), `Ana voit le lancer de Bastien, avec son nom (« ${seenByAna} »)`)
  check(seenByAna === `Bastien ${seenByBastien}`, `même résultat chez Bastien (« ${seenByBastien} »)`)
  await capture(ana.page, 'en-ligne-ana')
  await ana.page.getByRole('button', { name: 'Journal' }).click()
  check((await ana.page.getByTestId('log').innerText()).includes(seenByAna.replace(/^Bastien\s*/, '')), 'le lancer est écrit au journal')

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` : ${errors.join(' | ')}` : ''}`)
} finally {
  await browser.close()
}
