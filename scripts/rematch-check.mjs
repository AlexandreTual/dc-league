// Revanche (issue #244) dans de vrais navigateurs : bouton sur l'écran de victoire et dans le bandeau de fin,
// bandeau « Ana propose une revanche : Rejoindre » chez les autres joueurs, decks repris, refus pour un joueur extérieur.
// Prérequis : ceux de scripts/online-check.mjs (Worker, site, données de seed-online.mjs).
// Usage : node scripts/rematch-check.mjs <url-de-base> <dossier-captures>
import { chromium } from 'playwright-core'
import { PLAYERS, tokenOf } from './seed-online.mjs'

const [base = 'http://localhost:8788', outDir = '.'] = process.argv.slice(2)
const executablePath = process.env.CHROME ?? process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [ANA, BASTIEN, CHLOE, DAMIEN] = PLAYERS

const browser = await chromium.launch({ executablePath })
const errors = []

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

async function openAs(player, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 1200 })
  await context.addCookies([{ name: 'dc_session', value: tokenOf(player.id), url: base }])
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`${player.name} : ${e.message}`))
  page.on('dialog', (d) => d.accept(d.defaultValue()))
  return { ...player, page }
}

let shot = 0
async function capture(who, label) {
  shot++
  await who.page.waitForTimeout(300)
  const path = `${outDir}/rematch-${shot}-${label}.png`
  await who.page.screenshot({ path })
  console.log(`📸 ${path}`)
}

const api = (who, path, method = 'GET') => who.page.evaluate(async ([path, method]) => {
  const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' } })
  return { status: res.status, body: await res.json().catch(() => null) }
}, [path, method])

try {
  const ana = await openAs(ANA)
  // Téléphone en paysage pour jouer (en portrait, la table demande de tourner l'écran), en portrait pour la salle d'attente.
  const bastien = await openAs(BASTIEN, { width: 844, height: 390 })
  const chloe = await openAs(CHLOE, { width: 1180, height: 820 })
  const damien = await openAs(DAMIEN)

  // ── Partie à 3, option des éliminés cochée ──
  await ana.page.goto(`${base}/salon`)
  await ana.page.getByRole('combobox').nth(1).selectOption('4')
  const seeAll = ana.page.getByRole('checkbox')
  if (await seeAll.count()) await seeAll.first().check()
  await ana.page.getByRole('button', { name: 'Créer la table' }).click()
  await ana.page.waitForURL(/\/tables\//)
  const oldUrl = ana.page.url()
  const oldId = oldUrl.split('/tables/')[1]
  for (const who of [ana, bastien, chloe]) {
    if (who !== ana) {
      await who.page.goto(oldUrl)
      await who.page.getByRole('button', { name: 'Rejoindre la table' }).click()
    }
    await who.page.getByTestId('deck-select').selectOption(`deck-${who.id}`)
    await who.page.locator(`[data-seat="${who.id}"]`).getByText(`Kenrith de ${who.name}`).waitFor()
  }
  const before = (await api(ana, `/api/games/${oldId}`)).body
  check(before.rematchTableId === null, 'table en attente : pas de revanche')
  const early = await api(ana, `/api/games/${oldId}/rematch`, 'POST')
  check(early.status === 400 && early.body.error === 'La partie n’est pas terminée', 'revanche refusée avant la fin de la partie')
  await ana.page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent === 'Démarrer la partie' && !b.disabled), null, { timeout: 10_000 })
  await ana.page.getByRole('button', { name: 'Démarrer la partie' }).click()
  for (const who of [ana, bastien, chloe]) {
    await who.page.getByTestId('start-draw').waitFor({ timeout: 10_000 })
    await who.page.keyboard.press('Escape')
    await who.page.getByTestId('start-draw').waitFor({ state: 'detached' })
  }
  check((await ana.page.getByTestId('rematch').count()) === 0, 'partie en cours : pas de bouton « Revanche »')

  // ── Fin : Bastien et Chloé abandonnent ──
  for (const who of [bastien, chloe]) {
    const button = who.page.getByRole('button', { name: 'Abandonner' })
    await button.click()
    await ana.page.locator(`[data-panel="${who.id}"]`).getByText('éliminé').waitFor()
  }
  await ana.page.getByTestId('victory').waitFor()
  check(await ana.page.getByTestId('victory-rematch').isVisible(), 'écran de victoire : bouton « Revanche »')
  await bastien.page.getByTestId('finished').getByTestId('rematch-button').waitFor()
  check((await bastien.page.getByTestId('rematch-button').innerText()).trim() === 'Revanche', 'bandeau de fin (téléphone en paysage) : bouton « Revanche »')
  await capture(bastien, 'fin-telephone-844x390')

  // Un joueur extérieur ne peut pas utiliser le raccourci.
  await damien.page.goto(`${base}/salon`)
  const outsider = await api(damien, `/api/games/${oldId}/rematch`, 'POST')
  check(outsider.status === 400 && outsider.body.error === "Tu n'es pas à cette table", 'Damien (pas à la table) : revanche refusée')

  // ── Ana lance la revanche depuis l'écran de victoire ──
  await ana.page.getByTestId('victory-rematch').click()
  await ana.page.waitForURL((url) => /\/tables\//.test(url.pathname) && url.href !== oldUrl)
  const newUrl = ana.page.url()
  const newId = newUrl.split('/tables/')[1]
  await ana.page.locator(`[data-seat="${ANA.id}"]`).getByText(`Kenrith de ${ANA.name}`).waitFor()
  const rematch = (await api(ana, `/api/games/${newId}`)).body
  check(rematch.hostPlayerId === ANA.id && rematch.format === before.format && rematch.seats === before.seats && rematch.eliminatedSeeAll === before.eliminatedSeeAll,
    `revanche : même format (${rematch.format}), mêmes places (${rematch.seats}), même option des éliminés (${rematch.eliminatedSeeAll}), Ana hôte`)
  check(rematch.players.length === 1 && rematch.players[0].deckId === `deck-${ANA.id}`, 'Ana assise avec son deck')

  // ── Bastien (téléphone) voit la proposition et rejoint ──
  await bastien.page.getByTestId('rematch-offer').getByText(`${ANA.name} propose une revanche :`).waitFor({ timeout: 10_000 })
  check((await bastien.page.getByTestId('rematch-button').innerText()).trim() === 'Rejoindre', 'Bastien : « Ana propose une revanche : Rejoindre »')
  await capture(bastien, 'proposition-telephone-844x390')
  await bastien.page.getByTestId('rematch-button').click()
  await bastien.page.waitForURL(newUrl)
  await bastien.page.setViewportSize({ width: 390, height: 844 })
  await bastien.page.locator(`[data-seat="${BASTIEN.id}"]`).getByText(`Kenrith de ${BASTIEN.name}`).waitFor()
  check((await bastien.page.getByTestId('deck-select').inputValue()) === `deck-${BASTIEN.id}`, 'Bastien assis avec le deck de la partie précédente, modifiable')
  const width = await bastien.page.evaluate(() => document.documentElement.scrollWidth)
  check(width <= 390, `salle d'attente à 390 px : pas de défilement horizontal (${width} px)`)
  await capture(bastien, 'salle-attente-telephone-390')

  // ── Chloé (tablette) rejoint depuis le bandeau ──
  await chloe.page.getByTestId('rematch-offer').waitFor({ timeout: 10_000 })
  await chloe.page.getByTestId('rematch-button').click()
  await chloe.page.waitForURL(newUrl)
  await ana.page.locator(`[data-seat="${CHLOE.id}"]`).getByText(`Kenrith de ${CHLOE.name}`).waitFor({ timeout: 10_000 })
  check(true, 'Chloé rejoint avec son deck ; Ana voit les 3 joueurs')
  const again = await api(chloe, `/api/games/${oldId}/rematch`, 'POST')
  check(again.status === 200 && again.body.id === newId && again.body.players.length === 3, 'deuxième demande : même revanche, pas de doublon')
  check((await api(ana, `/api/games/${oldId}`)).body.status === 'finished', 'l’ancienne partie reste terminée')

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` : ${errors.join(' | ')}` : ''}`)
} finally {
  await browser.close()
}
