// Animations des joueurs et de la partie (issue #191) dans de vrais navigateurs : mode test (ordinateur, mouvement réduit,
// tablette), puis partie en ligne à 2 (blessures de commandant, initiative qui passe, dés, abandon : fissures et victoire).
// Prérequis : ceux de scripts/online-check.mjs (Worker, site, données de seed-online.mjs).
// Usage : node scripts/player-fx-check.mjs <url-de-base> <dossier-captures>
import { launch } from './browser.mjs'
import { PLAYERS, tokenOf } from './seed-online.mjs'

const [base = 'http://localhost:8788', outDir = '.'] = process.argv.slice(2)
const [ANA, BASTIEN] = PLAYERS
/** Joueur du mode test. */
const SOLO = { id: 'solo', name: 'Moi' }

const browser = await launch()
const errors = []

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

async function openAs(player, { viewport = { width: 1280, height: 900 }, reducedMotion = 'no-preference' } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 1200, reducedMotion })
  await context.addCookies([{ name: 'dc_session', value: tokenOf(player.id), url: base }])
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`${player.name} : ${e.message}`))
  page.on('dialog', (d) => d.accept(d.defaultValue()))
  return { ...player, page }
}

let shot = 0
async function capture(page, label) {
  shot++
  const path = `${outDir}/player-fx-${shot}-${label}.png`
  await page.screenshot({ path })
  console.log(`📸 ${path}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const panel = (page, id) => page.locator(`[data-panel="${id}"]`).filter({ has: page.getByTestId('player-life') }).first()
const animationOf = (locator) => locator.evaluate((el) => getComputedStyle(el).animationName)
const hasClass = (locator, name) => locator.evaluate((el, n) => el.classList.contains(n), name)
/** Attend que la bulle affiche ce texte (les actions arrivent l'une après l'autre ; machine lente comprise). */
async function waitPop(page, id, kind, text) {
  try {
    await page.waitForFunction(([p, k, t]) => [...document.querySelectorAll(`[data-panel="${p}"] [data-fx-pop="${k}"]`)].some((el) => el.textContent.trim() === t),
      [id, kind, text], { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

async function openTest(who) {
  await who.page.goto(`${base}/decks/deck-${who.id}`)
  await who.page.evaluate((id) => { localStorage.removeItem(`dc-playtest-${id}`); localStorage.removeItem('dc-table-settings') }, `deck-${who.id}`)
  await who.page.goto(`${base}/decks/deck-${who.id}/test`)
  await who.page.waitForSelector('[data-zone="hand"] [data-card-id]', { timeout: 15_000 })
}

async function openBubble(page, id, name) {
  await panel(page, id).getByRole('button', { name: `Compteurs de ${name}` }).click()
  return page.locator(`[data-bubble="${id}"]`)
}

async function setAnimation(page, label, on) {
  await page.getByRole('button', { name: 'Réglages' }).click()
  await page.getByRole('button', { name: 'Animations…' }).click()
  const box = page.getByRole('dialog', { name: 'Animations' }).locator('label').filter({ hasText: label }).locator('input')
  if ((await box.isChecked()) !== on) await box.click()
  await page.getByRole('button', { name: 'Fermer les animations' }).click()
}

async function roll(page, die) {
  await page.getByRole('button', { name: 'Dés' }).click()
  await page.getByTestId(die).click()
}

try {
  // ── Mode test, sur ordinateur ──
  const solo = await openAs(ANA)
  await openTest(solo)
  const minus = panel(solo.page, SOLO.id).getByRole('button', { name: 'moins : points de vie' })
  const plus = panel(solo.page, SOLO.id).getByRole('button', { name: 'plus : points de vie' })
  check((await panel(solo.page, SOLO.id).locator('[data-fx-pop]').count()) === 0, 'mode test : aucune bulle à l’ouverture')
  for (let i = 0; i < 3; i++) await minus.click()
  await panel(solo.page, SOLO.id).locator('[data-fx-pop="life"]').waitFor()
  check(await waitPop(solo.page, SOLO.id, 'life', '−3'), 'trois clics rapprochés sur « − » : une seule bulle « −3 »')
  check(await hasClass(panel(solo.page, SOLO.id).getByTestId('player-life'), 'fx-life-loss'), 'perte de vie : le nombre tremble')
  check((await panel(solo.page, SOLO.id).locator('.fx-halo-loss').count()) === 1, 'perte de vie : halo rouge')
  await capture(solo.page, 'vie-moins-3')
  await panel(solo.page, SOLO.id).locator('[data-fx-pop]').waitFor({ state: 'detached', timeout: 4000 })
  check(true, 'la bulle disparaît')
  await plus.click()
  await panel(solo.page, SOLO.id).locator('[data-fx-pop="life"]').waitFor()
  check(await waitPop(solo.page, SOLO.id, 'life', '+1'), 'gain plus tard : nouvelle bulle « +1 »')
  check(await hasClass(panel(solo.page, SOLO.id).getByTestId('player-life'), 'fx-life-gain'), 'gain de vie : le nombre grossit')
  check((await panel(solo.page, SOLO.id).getByTestId('player-life').innerText()) === '38', 'la vie reste lisible (38)')

  const bubble = await openBubble(solo.page, SOLO.id, SOLO.name)
  await bubble.locator('[data-marker="poison"]').getByRole('button', { name: /^plus/ }).click()
  await panel(solo.page, SOLO.id).locator('[data-fx-pop="poison"]').waitFor()
  check(await waitPop(solo.page, SOLO.id, 'poison', '☠ +1'), 'poison : bulle « ☠ +1 »')
  check((await panel(solo.page, SOLO.id).locator('.fx-drop').count()) === 3, 'poison : trois gouttes coulent sur le portrait')
  await capture(solo.page, 'poison')
  await bubble.getByRole('switch', { name: 'Monarque' }).click()
  await solo.page.locator('[data-fx-flight="monarch"]').waitFor()
  check(true, 'devenir monarque : la couronne jaillit au-dessus du portrait')
  await solo.page.waitForTimeout(300)
  await capture(solo.page, 'monarque')
  await solo.page.locator('[data-fx-flight]').waitFor({ state: 'detached', timeout: 3000 })
  await solo.page.keyboard.press('Escape')

  await roll(solo.page, 'roll-d6')
  const tray = solo.page.getByTestId('dice-tray').locator('[data-fx-roll="d6"]').last()
  await tray.waitFor()
  await solo.page.waitForTimeout(200)
  await capture(solo.page, 'de-en-train-de-rouler')
  const line = (await solo.page.getByTestId('activity-roll').last().innerText()).trim()
  const result = line.match(/Lance un d6 : (\d)/)?.[1]
  check(result && (await tray.getAttribute('data-results')) === result, `d6 : le plateau montre le résultat du journal (${result})`)
  check((await tray.innerText()).startsWith('Vous'), 'mon propre lancer : « Vous »')
  await solo.page.waitForTimeout(1000)
  await capture(solo.page, 'de-pose')
  await roll(solo.page, 'roll-d20')
  await solo.page.getByTestId('dice-tray').locator('[data-fx-roll="d20"]').waitFor()
  check((await solo.page.locator('[data-fx-roll="d20"] .fx-die-tumble').count()) === 1, 'd20 : la forme du dé roule')
  await solo.page.waitForTimeout(1100)
  const d20 = (await solo.page.locator('[data-fx-roll="d20"]').getAttribute('data-results'))
  check((await solo.page.locator('[data-fx-roll="d20"] span.tabular-nums').innerText()) === d20, `d20 : il se pose sur le résultat (${d20})`)
  await roll(solo.page, 'roll-coin')
  await solo.page.getByTestId('dice-tray').locator('[data-fx-roll="d2"]').waitFor()
  check(true, 'pièce : elle tourne')
  await solo.page.getByTestId('dice-tray').waitFor({ state: 'detached', timeout: 5000 })
  check(true, 'le plateau de dés s’efface')

  // Cases coupées.
  await setAnimation(solo.page, 'Vie, poison et blessures', false)
  await setAnimation(solo.page, 'Dés', false)
  await minus.click()
  await roll(solo.page, 'roll-d6')
  await solo.page.getByTestId('activity-roll').last().waitFor()
  await sleep(300)
  check((await panel(solo.page, SOLO.id).locator('[data-fx-pop]').count()) === 0, 'case « Vie, poison et blessures » coupée : pas de bulle')
  check((await solo.page.getByTestId('dice-tray').count()) === 0, 'case « Dés » coupée : pas de plateau, la ligne du lancer reste')
  await solo.page.reload()
  await solo.page.getByRole('button', { name: /Reprendre la partie/ }).click()
  await solo.page.getByTestId('player-life').first().waitFor()
  await minus.click()
  await sleep(300)
  check((await panel(solo.page, SOLO.id).locator('[data-fx-pop]').count()) === 0, 'choix mémorisé après rechargement')
  await setAnimation(solo.page, 'Vie, poison et blessures', true)
  await setAnimation(solo.page, 'Dés', true)

  // ── Mouvement réduit ──
  const still = await openAs(ANA, { reducedMotion: 'reduce' })
  await openTest(still)
  await panel(still.page, SOLO.id).getByRole('button', { name: 'moins : points de vie' }).click()
  await panel(still.page, SOLO.id).locator('[data-fx-pop="life"]').waitFor()
  check((await animationOf(panel(still.page, SOLO.id).locator('[data-fx-pop="life"]'))) === 'fx-still', 'mouvement réduit : la bulle reste immobile')
  check((await animationOf(panel(still.page, SOLO.id).getByTestId('player-life'))) === 'none', 'mouvement réduit : le nombre ne tremble pas')
  await roll(still.page, 'roll-d20')
  await still.page.locator('[data-fx-roll="d20"]').waitFor()
  check((await still.page.locator('[data-fx-roll="d20"] .fx-die-tumble').count()) === 0, 'mouvement réduit : le dé est posé sur son résultat, immobile')
  await capture(still.page, 'mouvement-reduit')

  // ── Tablette ──
  const tablet = await openAs(ANA, { viewport: { width: 1180, height: 820 } })
  await openTest(tablet)
  await panel(tablet.page, SOLO.id).getByRole('button', { name: 'moins : points de vie' }).tap()
  const pop = panel(tablet.page, SOLO.id).locator('[data-fx-pop="life"]')
  await pop.waitFor()
  const box = await pop.boundingBox()
  check(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1180 && box.y + box.height <= 820, 'tablette : la bulle reste dans l’écran')
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
  check((await ana.page.locator('[data-fx-pop], [data-fx-flight], [data-testid="dice-tray"]').count()) === 0, 'en ligne : rien d’animé à l’ouverture de la partie')

  // Bastien inflige 4 blessures de commandant à Ana.
  const anaBubble = await openBubble(bastien.page, ANA.id, ANA.name)
  const damage = anaBubble.locator('[data-marker]').filter({ has: bastien.page.getByTestId(`commander-damage-${BASTIEN.id}`) })
  for (let i = 0; i < 4; i++) await damage.getByRole('button', { name: /^plus : blessures de / }).click()
  await bastien.page.keyboard.press('Escape')
  await panel(ana.page, ANA.id).locator('[data-fx-pop="commander"]').waitFor()
  await ana.page.waitForFunction((id) => document.querySelector(`[data-panel="${id}"] [data-fx-pop="commander"]`)?.textContent === '⚔ +4', ANA.id)
  check(true, 'Ana voit « ⚔ +4 » sur son portrait')
  check((await panel(ana.page, ANA.id).locator('.fx-sword').count()) === 1, 'une épée frappe son portrait')
  await ana.page.waitForFunction((id) => document.querySelector(`[data-panel="${id}"] [data-fx-pop="life"]`)?.textContent === '−4', ANA.id)
  check(true, 'et sa vie : « −4 »')
  await capture(ana.page, 'blessures-commandant')

  // Initiative : Ana la prend, puis Bastien la lui reprend.
  const own = await openBubble(ana.page, ANA.id, ANA.name)
  await own.getByRole('switch', { name: 'Initiative' }).click()
  await ana.page.keyboard.press('Escape')
  await bastien.page.locator('[data-fx-flight="initiative"]').waitFor()
  check(true, 'Bastien voit le drapeau jaillir chez Ana')
  await bastien.page.locator('[data-fx-flight]').waitFor({ state: 'detached', timeout: 3000 })
  const bastienOwn = await openBubble(bastien.page, BASTIEN.id, BASTIEN.name)
  await bastienOwn.getByRole('switch', { name: 'Initiative' }).click()
  await bastien.page.keyboard.press('Escape')
  const flight = ana.page.locator('[data-fx-flight="initiative"]')
  await flight.waitFor()
  await ana.page.waitForTimeout(450)
  const mid = await flight.boundingBox()
  const from = await ana.page.locator(`[data-portrait-of="${ANA.id}"]`).boundingBox()
  check(mid && from && Math.abs(mid.y - from.y) > 20, 'chez Ana, le drapeau s’envole de son portrait vers Bastien')
  await capture(ana.page, 'initiative-en-vol')
  await flight.waitFor({ state: 'detached', timeout: 3000 })
  check((await ana.page.locator(`[data-panel="${BASTIEN.id}"] [data-badge="initiative"]`).count()) > 0, 'la pastille « Initiative » est chez Bastien')

  // Dés de Bastien vus par Ana.
  await roll(bastien.page, 'roll-d20')
  const anaTray = ana.page.getByTestId('dice-tray').locator('[data-fx-roll="d20"]')
  await anaTray.waitFor()
  check((await anaTray.innerText()).startsWith('Bastien'), 'Ana voit le dé de Bastien, avec son nom')
  const seen = (await ana.page.getByTestId('activity-roll').last().innerText()).match(/d20 : (\d+)/)?.[1]
  check((await anaTray.getAttribute('data-results')) === seen, `même résultat que la ligne du lancer (${seen})`)

  // Rien au rechargement.
  await ana.page.reload()
  await ana.page.getByTestId('game').waitFor()
  await sleep(500)
  check((await ana.page.locator('[data-fx-pop], [data-fx-flight], [data-testid="dice-tray"], [data-testid="victory"]').count()) === 0, 'rechargement : aucune animation rejouée')

  // Bastien abandonne : fissures chez lui, victoire d'Ana chez les deux.
  await bastien.page.getByRole('button', { name: 'Abandonner' }).click()
  await bastien.page.getByTestId('confirm-ok').click()
  await ana.page.locator(`[data-panel="${BASTIEN.id}"] [data-fx-crack="opening"]`).first().waitFor()
  check(true, 'Ana voit les fissures s’ouvrir sur le portrait de Bastien')
  await ana.page.getByTestId('victory').waitFor({ timeout: 10_000 })
  check((await ana.page.getByTestId('victory').innerText()).includes(`Victoire de ${ANA.name}`), 'écran de victoire chez Ana')
  check((await ana.page.locator('.fx-confetti').count()) > 20, 'confettis')
  await ana.page.waitForTimeout(800)
  await capture(ana.page, 'victoire')
  await bastien.page.getByTestId('victory').waitFor({ timeout: 10_000 })
  check(true, 'Bastien voit aussi la victoire d’Ana')
  await ana.page.getByTestId('victory').click()
  await ana.page.getByTestId('victory').waitFor({ state: 'detached' })
  check(true, 'un clic ferme l’écran de victoire')
  check((await ana.page.locator(`[data-panel="${BASTIEN.id}"] [data-fx-crack="static"]`).count()) > 0, 'Bastien reste fissuré (portrait en noir et blanc)')
  await capture(ana.page, 'apres-victoire')
  await ana.page.reload()
  await ana.page.getByTestId('finished').waitFor()
  await sleep(800)
  check((await ana.page.getByTestId('victory').count()) === 0, 'partie déjà finie au chargement : pas d’écran de victoire')

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` : ${errors.join(' | ')}` : ''}`)
} finally {
  await browser.close()
}
