// Donjons, dans de vrais navigateurs : mode test (explorer le donjon, choix du chemin, donjon terminé, initiative
// proposée, « Plus tard », annulation, animation coupée, mouvement réduit), mode test sur tablette (1180 × 820,
// tactile, cibles de 44 px), puis partie en ligne à 2.
// Prérequis : ceux de scripts/online-check.mjs (Worker, site, données de seed-online.mjs).
// Usage : node scripts/dungeon-check.mjs <url-de-base> <dossier-captures> [--ancien-serveur]
// --ancien-serveur : serveur de jeu sans donjons (`npm run game:dev` lancé depuis un worktree de main) ; vérifie
// seulement qu'une partie en ligne s'affiche sans jeton, sans rubrique « Donjon » et sans erreur.
import { chromium } from 'playwright-core'
import { PLAYERS, tokenOf } from './seed-online.mjs'

const args = process.argv.slice(2)
const oldServer = args.includes('--ancien-serveur')
const [base = 'http://localhost:8788', outDir = '.'] = args.filter((a) => !a.startsWith('--'))
const executablePath = process.env.CHROME ?? process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [ANA, BASTIEN] = PLAYERS

const browser = await chromium.launch({ executablePath })
const errors = []

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

async function openAs(player, { viewport = { width: 1280, height: 900 }, mobile = false, reducedMotion, settings } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile, reducedMotion })
  await context.addCookies([{ name: 'dc_session', value: tokenOf(player.id), url: base }])
  if (settings) await context.addInitScript((s) => localStorage.setItem('dc-table-settings', s), JSON.stringify(settings))
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`${player.name} : ${e.message}`))
  page.on('dialog', (d) => d.accept(d.defaultValue()))
  return { ...player, page }
}

let shot = 0
async function capture(page, label) {
  shot++
  await page.waitForTimeout(300)
  const path = `${outDir}/dungeon-${shot}-${label}.png`
  await page.screenshot({ path })
  console.log(`📸 ${path}`)
}

async function playtest(who) {
  await who.page.goto(`${base}/decks/deck-${who.id}`)
  await who.page.evaluate((id) => localStorage.removeItem(`dc-playtest-${id}`), `deck-${who.id}`)
  await who.page.goto(`${base}/decks/deck-${who.id}/test`)
  await who.page.waitForSelector('[data-zone="hand"] [data-card-id]', { timeout: 15_000 })
}

/** Identifiant du joueur dont la main est affichée (mode test : identifiant local). */
const myId = (page) => page.locator('[data-zone="hand"][data-player]').first().getAttribute('data-player')

/** Bulle « ⋯ » du portrait d'un joueur, ouverte. */
async function bubble(page, player) {
  const panel = page.locator(`[data-panel="${player}"]`).first()
  if (!(await page.locator(`[data-bubble="${player}"]`).count())) await panel.getByRole('button', { name: /^Compteurs de/ }).click()
  return page.locator(`[data-bubble="${player}"]`)
}
const closeBubble = (page) => page.keyboard.press('Escape')

/** Jeton de donjon d'un joueur (le premier affiché), et la salle attendue. */
const chip = (page, player) => page.locator(`[data-dungeon="${player}"]`).first()
const waitRoom = (page, player, room) =>
  page.waitForFunction(([p, r]) => document.querySelector(`[data-dungeon="${p}"]`)?.getAttribute('data-dungeon-room') === r, [player, room], { timeout: 10_000 })

const map = (page) => page.getByTestId('dungeon-map')

/** « Explorer le donjon » depuis la bulle de mon portrait. */
async function ventureFromBubble(page, me) {
  await (await bubble(page, me)).getByTestId('venture-dungeon').click()
  await closeBubble(page).catch(() => {})
}

async function logText(page) {
  await page.getByRole('button', { name: 'Journal' }).click()
  const text = await page.getByTestId('log').innerText()
  await page.getByRole('button', { name: 'Fermer le journal' }).click()
  return text
}

/** Hauteur (px) de chaque élément visible du sélecteur. */
const heights = (locator) => locator.evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect().height))

async function startOnline(ana, bastien) {
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
}

try {
  if (oldServer) {
    const ana = await openAs(ANA)
    const bastien = await openAs(BASTIEN)
    await startOnline(ana, bastien)
    check(await ana.page.locator('[data-dungeon]').count() === 0, 'ancien serveur : aucun jeton de donjon')
    const b = await bubble(ana.page, ANA.id)
    check(await b.getByTestId('dungeon-row').count() === 0, 'ancien serveur : pas de rubrique « Donjon » dans la bulle')
    await b.getByRole('switch', { name: 'Initiative' }).click()
    await ana.page.waitForTimeout(800)
    check(await ana.page.getByTestId('venture-offer').count() === 0, 'ancien serveur : initiative prise, aucune proposition')
    await capture(ana.page, 'ancien-serveur')
    check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` : ${errors.join(' | ')}` : ''}`)
    process.exit(0)
  }

  // ── Mode test, à la souris ──
  const solo = await openAs(ANA)
  const { page } = solo
  await playtest(solo)
  const me = await myId(page)
  check(await page.locator('[data-dungeon]').count() === 0, 'au départ : aucun jeton de donjon')

  await ventureFromBubble(page, me)
  await map(page).waitFor()
  check(true, 'sans donjon : « Explorer le donjon » ouvre le plan pour choisir')
  await map(page).locator('[data-dungeon-tab="undercity"]').click()
  check((await map(page).getByTestId('dungeon-actions').innerText()).includes('qu’avec l’initiative'), 'Les Souterrains ne se choisissent pas')
  await map(page).locator('[data-dungeon-tab="phandelver"]').click()
  check(await map(page).locator('[data-room]').count() === 7, 'Mine oubliée de Phancreux : 7 salles sur le plan')
  await capture(page, 'choix-du-donjon')
  await map(page).getByTestId('dungeon-enter').click()
  await waitRoom(page, me, 'cave')
  check((await chip(page, me).innerText()).includes('Entrée du souterrain'), 'jeton sous le portrait : « Phancreux · Entrée du souterrain »')
  check(await page.locator('.dungeon-glide').count() === 0, 'entrée dans un donjon : pas de glissement')

  await ventureFromBubble(page, me)
  await map(page).waitFor()
  const nexts = await map(page).locator('[data-next]').evaluateAll((els) => els.map((e) => e.getAttribute('data-room')))
  check(nexts.join() === 'goblinLair,mineTunnels', 'deux chemins : Repaire de gobelins ou Tunnels de la mine en surbrillance')
  await capture(page, 'choix-du-chemin')
  await map(page).locator('[data-room="mineTunnels"]').click()
  check((await map(page).getByTestId('dungeon-room-text').innerText()) === 'Créez un jeton Trésor.', 'texte de la salle choisie')
  await map(page).getByTestId('dungeon-advance').click()
  await waitRoom(page, me, 'mineTunnels')
  check(await page.locator('[data-dungeon-token].dungeon-glide').count() === 1, 'le jeton glisse jusqu’à la nouvelle salle')
  check(await page.locator(`[data-dungeon="${me}"] .dungeon-lit`).count() === 1, 'la salle atteinte s’allume')
  await capture(page, 'avance')

  // Plan ouvert depuis le jeton : position et texte.
  await chip(page, me).click()
  await map(page).waitFor()
  check(await map(page).locator(`[data-token="${me}"][data-token-room="mineTunnels"]`).count() === 1, 'plan : mon jeton sur les Tunnels de la mine')
  await map(page).locator('[data-room="fungiCavern"]').click()
  check((await map(page).getByTestId('dungeon-room-text').innerText()).includes('-4/-0'), 'plan : texte d’une autre salle au toucher')
  await map(page).getByTestId('dungeon-venture').click()
  await map(page).locator('[data-room="fungiCavern"]').click()
  await map(page).getByTestId('dungeon-advance').click()
  await waitRoom(page, me, 'fungiCavern')
  await page.waitForTimeout(400)
  await chip(page, me).click()
  await map(page).waitFor()
  await map(page).getByTestId('dungeon-venture').click()
  await map(page).getByTestId('dungeon-advance').click()
  await waitRoom(page, me, 'temple')
  check(await page.getByTestId('dungeon-finish').count() === 1, 'dernière salle : éclat « Donjon terminé »')
  check((await chip(page, me).innerText()).includes('✓ 1'), 'un donjon terminé compté')
  await capture(page, 'donjon-termine')
  const log = await logText(page)
  check(log.includes('entre dans la Mine oubliée de Phancreux : Entrée du souterrain — Regard 1.'), 'journal : entrée dans le donjon')
  check(log.includes('avance dans la Mine oubliée de Phancreux : Temple de Dumathoïn — Piochez une carte. Donjon terminé (1 au total).'), 'journal : donjon terminé')

  // Rechargement : jamais d'animation au premier affichage.
  await page.reload()
  await page.getByRole('button', { name: /Reprendre la partie/ }).click()
  await waitRoom(page, me, 'temple')
  await page.waitForTimeout(500)
  check(await page.locator('.dungeon-lit, .dungeon-glide, [data-testid="dungeon-finish"]').count() === 0, 'rechargement : jeton à sa place, sans animation')

  // Initiative : exploration des Souterrains proposée, à la prise puis au début du tour.
  await (await bubble(page, me)).getByRole('switch', { name: 'Initiative' }).click()
  await closeBubble(page)
  await page.getByTestId('venture-offer').waitFor()
  check(true, 'prendre l’initiative : « explorer Les Souterrains ? » proposé')
  await capture(page, 'initiative-proposee')
  await page.getByTestId('venture-offer-go').click()
  await waitRoom(page, me, 'secret')
  await page.getByTestId('venture-offer').waitFor({ state: 'detached' })
  check(true, 'Explorer : donjon terminé, on entre dans Les Souterrains ; la proposition disparaît')
  await page.getByRole('button', { name: /Fin de tour/ }).click()
  await page.getByTestId('venture-offer').waitFor()
  check(true, 'début de mon tour avec l’initiative : de nouveau proposé')
  await page.getByTestId('venture-offer-go').click()
  await map(page).waitFor()
  await map(page).locator('[data-room="well"]').click()
  await map(page).getByTestId('dungeon-advance').click()
  await waitRoom(page, me, 'well')
  check(true, 'deux chemins dans Les Souterrains : choix sur le plan (Puits perdu)')
  await page.getByRole('button', { name: 'Annuler' }).click()
  await waitRoom(page, me, 'secret')
  await page.getByTestId('venture-offer').waitFor()
  check(true, 'Annuler : retour à l’Entrée secrète, proposition revenue')
  await page.getByTestId('venture-offer-skip').click()
  await page.getByTestId('venture-offer').waitFor({ state: 'detached' })
  check(true, '« Plus tard » : proposition retirée')

  // ── Animation coupée (case « Donjon » décochée) ──
  const off = await openAs(ANA, { settings: { grid: true, background: null, cardEffects: { dungeon: false } } })
  await playtest(off)
  const offMe = await myId(off.page)
  await ventureFromBubble(off.page, offMe)
  await map(off.page).locator('[data-dungeon-tab="annihilation"]').click()
  await map(off.page).getByTestId('dungeon-enter').click()
  await waitRoom(off.page, offMe, 'trappedEntry')
  await ventureFromBubble(off.page, offMe)
  await map(off.page).locator('[data-room="oubliette"]').click()
  await map(off.page).getByTestId('dungeon-advance').click()
  await waitRoom(off.page, offMe, 'oubliette')
  await ventureFromBubble(off.page, offMe)
  await waitRoom(off.page, offMe, 'cradle')
  check(await off.page.locator('.dungeon-lit, .dungeon-glide, [data-testid="dungeon-finish"]').count() === 0, 'case « Donjon » décochée : aucune animation, même à la fin')

  // ── Mouvement réduit ──
  const reduced = await openAs(ANA, { reducedMotion: 'reduce' })
  await playtest(reduced)
  const rMe = await myId(reduced.page)
  await ventureFromBubble(reduced.page, rMe)
  await map(reduced.page).locator('[data-dungeon-tab="madMage"]').click()
  await map(reduced.page).getByTestId('dungeon-enter').click()
  await waitRoom(reduced.page, rMe, 'portal')
  await ventureFromBubble(reduced.page, rMe)
  await waitRoom(reduced.page, rMe, 'level')
  const glide = reduced.page.locator('[data-dungeon-token].dungeon-glide')
  check(await glide.count() === 1 && (await glide.evaluate((e) => getComputedStyle(e).transitionDuration)) === '0s', 'mouvement réduit : le jeton saute à sa place')
  const lit = reduced.page.locator('.dungeon-lit').first()
  check((await lit.evaluate((e) => [getComputedStyle(e).animationName, getComputedStyle(e).opacity].join())) === 'none,0.7', 'mouvement réduit : la salle reste allumée, immobile')

  // ── Mode test, sur tablette (tactile) ──
  const tablet = await openAs(ANA, { viewport: { width: 1180, height: 820 }, mobile: true })
  await playtest(tablet)
  const tMe = await myId(tablet.page)
  await (await bubble(tablet.page, tMe)).getByTestId('venture-dungeon').tap()
  await map(tablet.page).waitFor()
  const targets = await heights(map(tablet.page).locator('[role="tab"], [data-testid="dungeon-enter"], [aria-label="Fermer les donjons"]'))
  check(targets.length >= 6 && targets.every((h) => h >= 44), `tablette : onglets et boutons du plan de 44 px (${targets.map(Math.round).join(', ')})`)
  await map(tablet.page).locator('[data-dungeon-tab="phandelver"]').tap()
  await map(tablet.page).getByTestId('dungeon-enter').tap()
  await waitRoom(tablet.page, tMe, 'cave')
  const chipH = await heights(tablet.page.locator(`[data-dungeon="${tMe}"]`))
  check(chipH[0] >= 44, `tablette : jeton de donjon de 44 px (${Math.round(chipH[0])})`)
  const rowH = await heights((await bubble(tablet.page, tMe)).locator('[data-testid="dungeon-row"] button'))
  check(rowH.length >= 2 && rowH.every((h) => h >= 44), 'tablette : boutons de la rubrique « Donjon » de 44 px')
  await capture(tablet.page, 'tablette')

  // ── En ligne, à 2 ──
  const ana = await openAs(ANA)
  const bastien = await openAs(BASTIEN)
  await startOnline(ana, bastien)
  await ventureFromBubble(ana.page, ANA.id)
  await map(ana.page).locator('[data-dungeon-tab="madMage"]').click()
  await map(ana.page).getByTestId('dungeon-enter').click()
  await waitRoom(bastien.page, ANA.id, 'portal')
  check(true, 'Ana entre dans le Donjon du mage dément : Bastien voit son jeton')
  await ventureFromBubble(ana.page, ANA.id)
  await waitRoom(bastien.page, ANA.id, 'level')
  check(await bastien.page.locator(`[data-dungeon="${ANA.id}"] .dungeon-lit`).count() === 1, 'Bastien voit la salle atteinte s’allumer')
  const bBubble = await bubble(bastien.page, ANA.id)
  check(await bBubble.getByTestId('venture-dungeon').count() === 0, 'Bastien ne peut pas explorer pour Ana (seulement « Plan »)')
  await bBubble.getByRole('switch', { name: 'Initiative' }).click()
  await closeBubble(bastien.page)
  await ana.page.getByTestId('venture-offer').waitFor()
  await bastien.page.waitForTimeout(500)
  check(await bastien.page.getByTestId('venture-offer').count() === 0, 'Bastien donne l’initiative à Ana : proposée chez Ana seulement')
  await ana.page.getByTestId('venture-offer-go').click()
  await map(ana.page).waitFor()
  await map(ana.page).locator('[data-room="caverns"]').click()
  await map(ana.page).getByTestId('dungeon-advance').click()
  await waitRoom(bastien.page, ANA.id, 'caverns')
  check(true, 'avec l’initiative et le Mage dément commencé, Ana avance dans celui-ci (Cavernes tortueuses)')
  await chip(bastien.page, ANA.id).click()
  await map(bastien.page).waitFor()
  check(await map(bastien.page).locator(`[data-token="${ANA.id}"][data-token-room="caverns"]`).count() === 1, 'plan chez Bastien : le jeton d’Ana sur les Cavernes tortueuses')
  check(await map(bastien.page).getByTestId('dungeon-actions').count() === 1 && await map(bastien.page).getByTestId('dungeon-advance').count() === 0, 'plan chez Bastien : rien à choisir pour Ana')
  await capture(bastien.page, 'en-ligne-plan')
  await capture(ana.page, 'en-ligne-ana')

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` : ${errors.join(' | ')}` : ''}`)
} finally {
  await browser.close()
}
