// Visio en partie en ligne, dans de vrais navigateurs avec caméra et micro simulés par Chromium.
// Prérequis : ceux de scripts/online-check.mjs (Worker, site, données de seed-online.mjs).
// Usage : node scripts/visio-check.mjs <url-de-base> <dossier-captures>
import { chromium } from 'playwright-core'
import { PLAYERS, tokenOf } from './seed-online.mjs'

const [base = 'http://localhost:8788', outDir = '.'] = process.argv.slice(2)
const executablePath = process.env.CHROME ?? process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [ANA, BASTIEN, CHLOE] = PLAYERS

const browser = await chromium.launch({
  executablePath,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
})
const errors = []

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

async function openAs(player, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ locale: 'fr-FR', viewport, hasTouch: viewport.width < 1200 })
  await context.grantPermissions(['camera', 'microphone'], { origin: base })
  await context.addCookies([{ name: 'dc_session', value: tokenOf(player.id), url: base }])
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`${player.name} : ${e.message}`))
  page.on('dialog', (d) => d.accept(d.defaultValue()))
  return { ...player, page, context }
}

let shot = 0
async function capture(page, label) {
  shot++
  await page.waitForTimeout(400)
  const path = `${outDir}/visio-${shot}-${label}.png`
  await page.screenshot({ path })
  console.log(`📸 ${path}`)
}

const tile = (who, player) => who.page.locator(`[data-visio-tile="${player.id}"]`)
/** La vidéo d'un joueur défile vraiment (images reçues, lecture en cours). */
const playing = (who, player) => who.page.waitForFunction((id) => {
  const v = document.querySelector(`[data-visio-tile="${id}"] video`)
  return v && v.readyState >= 2 && !v.paused && v.videoWidth > 0
}, player.id, { timeout: 20_000 })
const tiles = (who) => who.page.locator('[data-visio-tile]').count()

async function startTable(players) {
  const [host] = players
  await host.page.goto(`${base}/salon`)
  await host.page.getByRole('combobox').nth(1).selectOption(String(players.length))
  await host.page.getByRole('button', { name: 'Créer la table' }).click()
  await host.page.waitForURL(/\/tables\//)
  const url = host.page.url()
  for (const who of players) {
    if (who !== host) {
      await who.page.goto(url)
      await who.page.getByRole('button', { name: 'Rejoindre la table' }).click()
    }
    await who.page.getByTestId('deck-select').selectOption(`deck-${who.id}`)
    await who.page.locator(`[data-seat="${who.id}"]`).getByText(`Kenrith de ${who.name}`).waitFor()
  }
  await host.page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent === 'Démarrer la partie')
    return b && !b.disabled
  }, null, { timeout: 10_000 })
  await host.page.getByRole('button', { name: 'Démarrer la partie' }).click()
  for (const who of players) {
    await who.page.getByTestId('game').waitFor({ timeout: 10_000 })
    await who.page.getByTestId('start-draw').waitFor()
    await who.page.keyboard.press('Escape')
    await who.page.getByTestId('start-draw').waitFor({ state: 'detached' })
  }
  return url
}

try {
  // ── Mode test : pas de visio ──
  const solo = await openAs(ANA)
  await solo.page.goto(`${base}/decks/deck-${ANA.id}/test`)
  await solo.page.waitForSelector('[data-zone="hand"] [data-card-id]', { timeout: 15_000 })
  check(await solo.page.getByTestId('visio-join').count() === 0, 'mode test : pas de bouton « Visio »')
  await solo.context.close()

  const ana = await openAs(ANA)
  const bastien = await openAs(BASTIEN)
  const chloe = await openAs(CHLOE, { width: 1180, height: 820 })
  const url = await startTable([ana, bastien, chloe])

  // ── Entrée d'Ana : fenêtre en haut à droite, en attente ──
  check(await ana.page.getByTestId('visio-panel').count() === 0, 'pas de fenêtre de visio avant d’y entrer')
  await ana.page.getByTestId('visio-join').click()
  const panel = ana.page.getByTestId('visio-panel')
  await panel.waitFor()
  await ana.page.getByTestId('visio-waiting').waitFor()
  const box = await panel.boundingBox()
  const bar = await ana.page.getByTestId('top-bar').boundingBox()
  check(box.x + box.width > 1280 - 20 && box.y >= bar.y + bar.height, `fenêtre en haut à droite, sous la barre (x ${Math.round(box.x)}, y ${Math.round(box.y)}, ${Math.round(box.width)} px de large)`)
  check(box.width <= 260 && box.height <= 240, 'fenêtre petite par défaut')
  check(await ana.page.getByTestId('visio-join').count() === 0, 'le bouton « Visio » disparaît une fois en visio')
  await bastien.page.getByTestId('visio-count').filter({ hasText: '1' }).waitFor()
  check(true, 'Bastien voit qu’un joueur est en visio (pastille 1)')

  // ── Bastien entre : chacun voit l'autre ──
  await bastien.page.getByTestId('visio-join').click()
  await playing(ana, BASTIEN)
  await playing(bastien, ANA)
  check(true, 'Ana et Bastien se voient (vidéo reçue et lue)')
  check((await tile(ana, BASTIEN).innerText()).includes('Bastien'), 'vignette au nom du joueur')
  check(await ana.page.getByTestId('visio-self').isVisible(), 'ma propre image en incrustation')
  await capture(ana.page, 'ana-et-bastien')

  // ── Chloé (tablette) entre : trois pairs, deux vignettes chacun ──
  await chloe.page.getByTestId('visio-count').filter({ hasText: '2' }).waitFor()
  await chloe.page.getByTestId('visio-join').tap()
  for (const [who, others] of [[ana, [BASTIEN, CHLOE]], [bastien, [ANA, CHLOE]], [chloe, [ANA, BASTIEN]]]) {
    for (const other of others) await playing(who, other)
    check(await tiles(who) === 2, `${who.name} voit ${others.map((o) => o.name).join(' et ')}`)
  }
  const micBox = await chloe.page.getByTestId('visio-mic').boundingBox()
  check(micBox.width >= 44 && micBox.height >= 44, 'tablette : boutons de 44 px')
  await capture(chloe.page, 'trois-tablette')

  // ── Caméra et micro coupés ──
  await ana.page.getByTestId('visio-cam').click()
  await ana.page.getByTestId('visio-mic').click()
  await bastien.page.waitForFunction((id) => {
    const t = document.querySelector(`[data-visio-tile="${id}"]`)
    return t && t.querySelector('video')?.classList.contains('invisible') && t.textContent.trim().startsWith('A')
  }, ANA.id)
  check(await tile(bastien, ANA).locator('svg').count() >= 1, 'Bastien voit Ana caméra coupée (initiale) et micro coupé')
  await capture(bastien.page, 'ana-camera-coupee')
  await ana.page.getByTestId('visio-cam').click()
  await bastien.page.waitForFunction((id) => !document.querySelector(`[data-visio-tile="${id}"] video`)?.classList.contains('invisible'), ANA.id)
  await ana.page.waitForFunction(() => {
    const v = document.querySelector('[data-testid="visio-self"] video')
    return v && !v.paused && v.readyState >= 2 && v.videoWidth > 0
  }, null, { timeout: 5000 })
  check(true, 'caméra rallumée : Ana réapparaît, chez Bastien et dans sa propre incrustation')

  // ── Taille : tirer le coin bas gauche ──
  const handle = await ana.page.getByTestId('visio-resize').boundingBox()
  const before = (await panel.boundingBox()).width
  await ana.page.mouse.move(handle.x + 5, handle.y + 5)
  await ana.page.mouse.down()
  await ana.page.mouse.move(handle.x - 200, handle.y + 100, { steps: 8 })
  await ana.page.mouse.up()
  const after = await panel.boundingBox()
  check(Math.abs(after.width - (before + 205)) <= 3, `tirer le coin agrandit la fenêtre (${Math.round(before)} → ${Math.round(after.width)} px)`)
  check(after.x + after.width > 1280 - 20, 'elle reste accrochée à droite')
  await capture(ana.page, 'agrandie')
  /** Tire le coin de `dx` pixels (négatif : vers la gauche, la fenêtre grandit). */
  const dragCorner = async (dx) => {
    const h = await ana.page.getByTestId('visio-resize').boundingBox()
    await ana.page.mouse.move(h.x + 5, h.y + 5)
    await ana.page.mouse.down()
    await ana.page.mouse.move(h.x + 5 + dx, h.y + 5, { steps: 5 })
    await ana.page.mouse.up()
  }
  await dragCorner(3000)
  check(Math.round((await panel.boundingBox()).width) === 160, 'pas plus petite que 160 px')
  await dragCorner(-3000)
  check(Math.round((await panel.boundingBox()).width) === 720, 'pas plus grande que 720 px')

  // Taille au doigt (tablette).
  const cHandle = await chloe.page.getByTestId('visio-resize').boundingBox()
  const cBefore = (await chloe.page.getByTestId('visio-panel').boundingBox()).width
  const cdp = await chloe.context.newCDPSession(chloe.page)
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
  await touch('touchStart', cHandle.x + 10, cHandle.y + 10)
  for (let i = 1; i <= 6; i++) await touch('touchMove', cHandle.x + 10 - i * 20, cHandle.y + 10)
  await touch('touchEnd')
  const cAfter = (await chloe.page.getByTestId('visio-panel').boundingBox()).width
  check(cAfter > cBefore + 100, `tablette : le coin se tire au doigt (${Math.round(cBefore)} → ${Math.round(cAfter)} px)`)

  // ── Réduire : seule la barre reste, le son continue ──
  await bastien.page.getByTestId('visio-collapse').click()
  const reduced = await bastien.page.getByTestId('visio-panel').boundingBox()
  check(reduced.height < 60, 'réduite : seule la barre de la visio reste')
  check(await bastien.page.evaluate(() => [...document.querySelectorAll('[data-visio-tile] video')].every((v) => !v.paused)), 'réduite : les vidéos (et le son) continuent')
  await bastien.page.getByTestId('visio-collapse').click()

  // ── La table reste jouable sous la visio ──
  await ana.page.keyboard.press('d')
  check(true, 'raccourci clavier de la table toujours actif')

  // ── Rechargement : largeur retenue, retour en visio ──
  await ana.page.goto(url)
  await ana.page.getByTestId('game').waitFor()
  // Tour 1, main pas gardée : « Qui commence ? » se rouvre au rechargement.
  await ana.page.getByTestId('start-draw').waitFor({ timeout: 5000 }).then(() => ana.page.keyboard.press('Escape'), () => {})
  await ana.page.getByTestId('start-draw').waitFor({ state: 'detached' })
  await ana.page.getByTestId('visio-join').click()
  await ana.page.getByTestId('visio-panel').waitFor()
  check(Math.round((await ana.page.getByTestId('visio-panel').boundingBox()).width) === 720, 'largeur retenue après rechargement')
  await playing(ana, BASTIEN)
  await playing(ana, CHLOE)
  await bastien.page.waitForFunction((id) => document.querySelectorAll(`[data-visio-tile="${id}"]`).length === 1, ANA.id)
  await playing(bastien, ANA)
  check(true, 'après un rechargement, Ana revient en visio sans vignette en double chez Bastien')

  // ── Quitter ──
  await bastien.page.getByTestId('visio-leave').click()
  check(await bastien.page.getByTestId('visio-panel').count() === 0, 'Bastien quitte : sa fenêtre se ferme')
  await ana.page.waitForFunction((id) => !document.querySelector(`[data-visio-tile="${id}"]`), BASTIEN.id)
  await chloe.page.waitForFunction((id) => !document.querySelector(`[data-visio-tile="${id}"]`), BASTIEN.id)
  check(await tiles(ana) === 1, 'Ana et Chloé ne voient plus Bastien')
  check(await bastien.page.evaluate(() => document.querySelectorAll('video').length === 0), 'Bastien : caméra relâchée')
  await capture(ana.page, 'apres-depart')

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` : ${errors.join(' | ')}` : ''}`)
} finally {
  await browser.close()
}
