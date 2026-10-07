// Plateau d'un adversaire dans une fenêtre à part (#82), dans de vrais navigateurs (Chromium piloté par playwright-core).
// Prérequis : ceux de scripts/online-check.mjs (Worker, site, données de scripts/seed-online.mjs).
// Usage : node scripts/board-window-check.mjs <url-de-base> <dossier-captures>
import { chromium } from 'playwright-core'
import { PLAYERS, tokenOf } from './seed-online.mjs'

const [base = 'http://localhost:8788', outDir = '.'] = process.argv.slice(2)
const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [ANA, BASTIEN, CHLOE] = PLAYERS

const browser = await chromium.launch({ executablePath })
const errors = []

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

/** Trames de vue reçues par une page (table ou fenêtre). */
function listen(page, label, frames) {
  page.on('pageerror', (e) => errors.push(`${label} : ${e.message}`))
  page.on('websocket', (ws) => ws.on('framereceived', (f) => { try { frames.push(JSON.parse(String(f.payload))) } catch { /* ignoré */ } }))
  page.on('dialog', (d) => d.accept(d.defaultValue()))
}

async function openAs(player, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options })
  await context.addCookies([{ name: 'dc_session', value: tokenOf(player.id), url: base }])
  const page = await context.newPage()
  const frames = []
  listen(page, player.name, frames)
  return { ...player, context, page, frames }
}

let shot = 0
async function capture(page, label) {
  shot++
  await page.waitForTimeout(300)
  const path = `${outDir}/fenetre-${shot}-${label}.png`
  await page.screenshot({ path })
  console.log(`📸 ${path}`)
}

/** Cartes visibles d'une vue, « propriétaire:ref ». */
function visibleRefs(view) {
  const out = new Set()
  for (const p of Object.values(view.players)) {
    const { library, ...zones } = p.zones
    for (const cards of Object.values(zones)) for (const c of cards) if (!c.hidden && c.ref !== undefined) out.add(`${c.owner}:${c.ref}`)
    for (const { card } of library.visible) if (card.ref !== undefined) out.add(`${card.owner}:${card.ref}`)
  }
  return out
}

/** Données de cartes reçues sans qu'aucune vue reçue ne montre une carte correspondante. */
function leaks(frames) {
  const views = frames.filter((f) => f.type === 'view')
  const seen = new Set(views.flatMap((f) => [...visibleRefs(f.view)]))
  const received = views.flatMap((f) => Object.entries(f.cards).flatMap(([owner, refs]) => Object.keys(refs).map((r) => `${owner}:${r}`)))
  return [...new Set(received)].filter((key) => !seen.has(key))
}

async function chooseDeck(who) {
  await who.page.getByTestId('deck-select').selectOption(`deck-${who.id}`)
  await who.page.locator(`[data-seat="${who.id}"]`).getByText(`Kenrith de ${who.name}`).waitFor()
}

const strip = (page, id) => page.locator(`[data-strip="${id}"]`)
const myHand = (who) => who.page.locator(`[data-board="${who.id}"] [data-zone="hand"] [data-card-id]`)

/** Ouvre le plateau d'un adversaire (bouton du bandeau ou de la bulle) et renvoie la fenêtre. */
async function detach(ana, button) {
  const [popup] = await Promise.all([ana.context.waitForEvent('page'), button.click()])
  const frames = []
  listen(popup, 'fenêtre', frames)
  await popup.getByTestId('board-window').waitFor()
  return { popup, frames }
}

try {
  const ana = await openAs(ANA)
  const bastien = await openAs(BASTIEN)
  const chloe = await openAs(CHLOE)

  await ana.page.goto(`${base}/salon`)
  await ana.page.getByRole('combobox').nth(1).selectOption('3')
  await ana.page.getByRole('button', { name: 'Créer la table' }).click()
  await ana.page.waitForURL(/\/tables\//)
  const tableUrl = ana.page.url()
  const tableId = tableUrl.split('/').pop()
  await chooseDeck(ana)
  for (const who of [bastien, chloe]) {
    await who.page.goto(tableUrl)
    await who.page.getByRole('button', { name: 'Rejoindre la table' }).click()
    await chooseDeck(who)
  }
  await ana.page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent === 'Démarrer la partie')
    return b && !b.disabled
  }, null, { timeout: 10_000 })
  await ana.page.getByRole('button', { name: 'Démarrer la partie' }).click()
  for (const who of [ana, bastien, chloe]) {
    await who.page.getByTestId('game').waitFor({ timeout: 10_000 })
    await who.page.getByRole('button', { name: 'Garder' }).click()
    await who.page.getByRole('button', { name: 'Garder' }).waitFor({ state: 'detached' })
  }
  check(true, `partie à 3 lancée (${tableId}), mains gardées`)

  // Bastien joue une carte, pour avoir de quoi regarder dans la fenêtre.
  const played = await myHand(bastien).first().getAttribute('data-card-id')
  await myHand(bastien).first().dblclick()
  await strip(ana.page, BASTIEN.id).locator(`[data-strip-card="${played}"]`).waitFor()

  // ── Bouton sur les bandeaux, pas sur ma colonne ──
  check(await strip(ana.page, BASTIEN.id).getByTestId('detach').isVisible(), 'bouton « Ouvrir dans une fenêtre » sur le bandeau de Bastien')
  check(await strip(ana.page, CHLOE.id).getByTestId('detach').isVisible(), '… et sur celui de Chloé')
  check((await ana.page.locator(`[data-board="${ANA.id}"] [data-testid="detach"]`).count()) === 0, 'pas de bouton sur ma propre colonne')

  // ── Ouverture ──
  const one = await detach(ana, strip(ana.page, BASTIEN.id).getByTestId('detach'))
  check(one.popup.url().endsWith(`/tables/${tableId}/plateau/${BASTIEN.id}`), 'la fenêtre s’ouvre sur /tables/<id>/plateau/<joueur>')
  await one.popup.locator(`[data-board="${BASTIEN.id}"]`).waitFor()
  check(await one.popup.locator(`[data-board="${BASTIEN.id}"] [data-column="${BASTIEN.id}"]`).isVisible(), 'la fenêtre affiche la colonne de Bastien')
  check(await one.popup.locator(`[data-board="${BASTIEN.id}"] [data-card-id="${played}"]`).isVisible(), '… et son champ de bataille, avec la carte jouée')
  check((await one.popup.locator(`[data-board="${ANA.id}"]`).count()) === 0, 'la fenêtre ne montre pas ma main')
  check(await one.popup.title() === `Plateau de ${BASTIEN.name}`, 'titre de la fenêtre : « Plateau de Bastien »')
  await strip(ana.page, BASTIEN.id).waitFor({ state: 'detached' })
  check(true, 'le plateau de Bastien quitte la table principale')
  check(await ana.page.locator(`[data-detached="${BASTIEN.id}"]`).isVisible(), 'bandeau « Plateau de Bastien dans une fenêtre à part » avec « Ramener »')
  await ana.page.locator(`[data-board="${CHLOE.id}"]`).waitFor()
  check(true, 'Chloé, seule adversaire restante, occupe la place libérée')
  await capture(one.popup, 'fenetre-bastien')
  await capture(ana.page, 'table-sans-bastien')

  // ── La fenêtre suit la partie et reste active ──
  const second = await myHand(bastien).first().getAttribute('data-card-id')
  await myHand(bastien).first().dblclick()
  await one.popup.locator(`[data-board="${BASTIEN.id}"] [data-card-id="${second}"]`).waitFor()
  check(true, 'une carte jouée par Bastien apparaît en direct dans la fenêtre')
  await one.popup.locator(`[data-board="${BASTIEN.id}"] [data-card-id="${second}"]`).click({ button: 'right' })
  await one.popup.getByRole('menu').waitFor()
  check(await one.popup.getByRole('menuitem').count() > 0, 'menu de carte dans la fenêtre')
  await one.popup.keyboard.press('Escape')
  const lifeBefore = Number(await one.popup.locator(`[data-panel="${BASTIEN.id}"] [data-testid="player-life"]`).first().innerText())
  await one.popup.locator(`[data-panel="${BASTIEN.id}"]`).getByRole('button', { name: 'moins : points de vie' }).first().click()
  await bastien.page.waitForFunction(([id, n]) =>
    [...document.querySelectorAll(`[data-panel="${id}"] [data-testid="player-life"]`)].some((el) => Number(el.textContent) === n), [BASTIEN.id, lifeBefore - 1])
  check(true, 'la vie de Bastien changée depuis la fenêtre arrive chez Bastien')
  check(leaks(one.frames).length === 0, `fenêtre : aucune donnée de carte cachée reçue (${leaks(one.frames).join(', ')})`)
  check(leaks(ana.frames).length === 0, 'table : aucune donnée de carte cachée reçue')

  // ── « Ramener » depuis la table ferme la fenêtre ──
  await Promise.all([one.popup.waitForEvent('close'), ana.page.locator(`[data-detached="${BASTIEN.id}"]`).getByRole('button', { name: 'Ramener' }).click()])
  check(true, '« Ramener » sur la table ferme la fenêtre')
  await strip(ana.page, BASTIEN.id).waitFor()
  check(true, 'le bandeau de Bastien revient sur la table')
  const anaOnline = bastien.frames.filter((f) => f.type === 'view').at(-1).online
  check(anaOnline.includes(ANA.id), 'Ana reste en ligne après la fermeture de la fenêtre')

  // ── Fermer la fenêtre remet le plateau ──
  const two = await detach(ana, strip(ana.page, BASTIEN.id).getByTestId('detach'))
  await strip(ana.page, BASTIEN.id).waitFor({ state: 'detached' })
  await two.popup.close({ runBeforeUnload: true })
  await strip(ana.page, BASTIEN.id).waitFor({ timeout: 6000 })
  check(true, 'fermer la fenêtre remet le plateau sur la table')

  // ── Bulle « ⋯ » de Chloé, puis « Ramener » depuis la fenêtre ──
  await strip(ana.page, CHLOE.id).getByRole('button', { name: `Compteurs de ${CHLOE.name}` }).click()
  const three = await detach(ana, ana.page.getByTestId('detach-bubble'))
  await three.popup.locator(`[data-board="${CHLOE.id}"]`).waitFor()
  check(true, 'la bulle « ⋯ » de Chloé ouvre sa fenêtre')
  await Promise.all([three.popup.waitForEvent('close'), three.popup.getByTestId('board-window-return').click()])
  await strip(ana.page, CHLOE.id).waitFor()
  check(true, '« Ramener sur la table » dans la fenêtre la ferme et remet le plateau')

  // ── Les deux adversaires sortis : la table ne garde que mon plateau ──
  const four = await detach(ana, strip(ana.page, BASTIEN.id).getByTestId('detach'))
  // Bastien sorti, Chloé est seule : son plateau est agrandi (bouton sur sa colonne).
  const five = await detach(ana, ana.page.locator(`[data-board="${CHLOE.id}"]`).getByTestId('detach'))
  await ana.page.locator('[data-opponents]').waitFor({ state: 'detached' })
  check(await ana.page.locator(`[data-detached="${BASTIEN.id}"]`).isVisible() && await ana.page.locator(`[data-detached="${CHLOE.id}"]`).isVisible(),
    'une fenêtre par adversaire : deux fenêtres ouvertes, la table ne garde que mon plateau')
  await capture(ana.page, 'table-deux-fenetres')

  // ── Table rechargée : elle retrouve les fenêtres ouvertes ──
  await ana.page.reload()
  await ana.page.getByTestId('game').waitFor()
  await ana.page.locator(`[data-detached="${CHLOE.id}"]`).waitFor({ timeout: 4000 })
  check((await ana.page.locator('[data-opponents]').count()) === 0, 'après rechargement, la table retrouve les deux fenêtres')
  await four.popup.close({ runBeforeUnload: true })
  await five.popup.close({ runBeforeUnload: true })
  await strip(ana.page, CHLOE.id).waitFor({ timeout: 6000 })

  // ── Fenêtre bloquée : message et lien ──
  await ana.page.evaluate(() => { window.open = () => null })
  await strip(ana.page, BASTIEN.id).getByTestId('detach').click()
  const blocked = ana.page.getByTestId('board-window-blocked')
  await blocked.waitFor()
  check((await blocked.innerText()).includes('Le navigateur a bloqué la fenêtre'), 'fenêtre bloquée : message en français')
  check((await blocked.getByRole('link').getAttribute('href')) === `/tables/${tableId}/plateau/${BASTIEN.id}`, '… avec le lien à ouvrir à la main')
  await capture(ana.page, 'fenetre-bloquee')

  // ── Adresse invalide : mon propre plateau ──
  const own = await ana.context.newPage()
  listen(own, 'fenêtre invalide', [])
  await own.goto(`${base}/tables/${tableId}/plateau/${ANA.id}`)
  await own.getByTestId('board-window-unknown').waitFor()
  check(true, 'mon propre plateau en fenêtre : message et lien vers la table')
  await own.close()

  // ── Tablette (tactile) : pas de bouton ──
  const tablet = await openAs(ANA, { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true })
  await tablet.page.goto(tableUrl)
  await tablet.page.getByTestId('game').waitFor()
  await strip(tablet.page, BASTIEN.id).waitFor()
  check((await tablet.page.getByTestId('detach').count()) === 0, 'tablette : pas de bouton « Ouvrir dans une fenêtre »')

  check(errors.length === 0, `aucune erreur JavaScript (${errors.join(' | ')})`)
} finally {
  await browser.close()
}
