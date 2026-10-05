// Partie en ligne de bout en bout dans de vrais navigateurs (Chromium piloté par playwright-core).
// Prérequis : Worker (`npm run game:dev`) et site (`wrangler pages dev --port 8788`) lancés,
// données de scripts/seed-online.mjs chargées dans la base locale.
// Usage : node scripts/online-check.mjs <url-de-base> <dossier-captures>
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright-core'
import { PLAYERS, tokenOf } from './seed-online.mjs'

const [base = 'http://localhost:8788', outDir = '.'] = process.argv.slice(2)
const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [ANA, BASTIEN, CHLOE, DAMIEN] = PLAYERS

const browser = await chromium.launch({ executablePath })
const errors = []

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

/** Un joueur : son contexte de navigation, sa page, et les messages WebSocket qu'il reçoit. */
async function openAs(player) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.addCookies([{ name: 'dc_session', value: tokenOf(player.id), url: base }])
  const page = await context.newPage()
  const frames = []
  page.on('pageerror', (e) => errors.push(`${player.name} : ${e.message}`))
  page.on('websocket', (ws) => ws.on('framereceived', (f) => { try { frames.push(JSON.parse(String(f.payload))) } catch { /* ignoré */ } }))
  page.on('dialog', (d) => d.accept(d.defaultValue()))
  return { ...player, page, frames }
}

let shot = 0
async function capture(who, label) {
  shot++
  await who.page.waitForTimeout(300)
  const path = `${outDir}/online-${shot}-${label}.png`
  await who.page.screenshot({ path, fullPage: true })
  console.log(`📸 ${path}`)
}

const board = (who, playerId) => who.page.locator(`[data-board="${playerId}"]`)
const myHand = (who) => who.page.locator(`[data-board="${who.id}"] [data-zone="hand"] [data-card-id]`)
const handCount = async (who, playerId) => Number(await who.page.locator(`[data-strip="${playerId}"] [data-testid="hand-count"]`).innerText())
const activeName = async (who) => (await who.page.getByTestId('active-player').innerText()).replace('Joueur actif : ', '')
const views = (who) => who.frames.filter((f) => f.type === 'view').map((f) => f.view)
const lastView = (who) => views(who).at(-1)

/** Données de cartes reçues pour un propriétaire, toutes trames confondues. */
const refsReceived = (who, owner) =>
  new Set(who.frames.filter((f) => f.type === 'view').flatMap((f) => Object.keys(f.cards[owner] ?? {}).map(Number)))

/** Cartes visibles d'une vue, sous la forme « propriétaire:ref ». */
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
function leaks(who) {
  const seen = new Set(views(who).flatMap((v) => [...visibleRefs(v)]))
  const received = who.frames.filter((f) => f.type === 'view').flatMap((f) => Object.entries(f.cards).flatMap(([owner, refs]) => Object.keys(refs).map((r) => `${owner}:${r}`)))
  return [...new Set(received)].filter((key) => !seen.has(key))
}

/** Glisser-déposer à la souris jusqu'au centre de la cible (dnd-kit démarre après 5 px). */
async function drag(who, source, target) {
  const from = await source.boundingBox()
  const to = await target.boundingBox()
  await who.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await who.page.mouse.down()
  await who.page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, { steps: 5 })
  await who.page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 })
  await who.page.mouse.up()
  await who.page.waitForTimeout(200)
}

async function chooseDeck(who) {
  await who.page.getByTestId('deck-select').selectOption(`deck-${who.id}`)
  await who.page.locator(`[data-seat="${who.id}"]`).getByText(`Kenrith de ${who.name}`).waitFor()
}

try {
  const ana = await openAs(ANA)
  const bastien = await openAs(BASTIEN)
  const chloe = await openAs(CHLOE)
  const damien = await openAs(DAMIEN)

  // ── Salle d'attente ──
  await ana.page.goto(`${base}/salon`)
  await ana.page.getByRole('combobox').nth(1).selectOption('3')
  await ana.page.getByRole('button', { name: 'Créer la table' }).click()
  await ana.page.waitForURL(/\/tables\//)
  const tableUrl = ana.page.url()
  const tableId = tableUrl.split('/').pop()
  check(true, `Ana crée une table Commander à 3 (${tableId})`)
  await chooseDeck(ana)

  await bastien.page.goto(`${base}/salon`)
  await bastien.page.locator(`[data-table-id="${tableId}"]`).getByRole('button', { name: 'Rejoindre' }).click()
  await bastien.page.waitForURL(tableUrl)
  await chooseDeck(bastien)
  check(true, 'Bastien rejoint par le salon et choisit son deck')

  await chloe.page.goto(tableUrl)
  await chloe.page.getByRole('button', { name: 'Rejoindre la table' }).click()
  await chooseDeck(chloe)
  check(true, 'Chloé rejoint par le lien et choisit son deck')

  const start = ana.page.getByRole('button', { name: 'Démarrer la partie' })
  await ana.page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent === 'Démarrer la partie')
    return b && !b.disabled
  }, null, { timeout: 10_000 })
  await capture(ana, 'salle-attente')
  await start.click()

  // ── Partie ──
  for (const who of [ana, bastien, chloe]) await who.page.getByTestId('game').waitFor({ timeout: 10_000 })
  check(true, 'la table s’affiche chez les 3 joueurs')
  for (const who of [ana, bastien, chloe]) {
    await myHand(who).first().waitFor()
    check((await myHand(who).count()) === 7, `${who.name} : main de 7 cartes`)
  }
  for (const who of [ana, bastien, chloe]) {
    await who.page.getByRole('button', { name: 'Garder' }).click()
    await who.page.getByRole('button', { name: 'Garder' }).waitFor({ state: 'detached' })
  }
  check(true, 'chacun garde sa main')
  check((await ana.page.locator('[data-opponents="all"] [data-strip]').count()) === 2, 'Ana voit ses 2 adversaires en bandeaux')

  // ── Pioche et carte jouée par Bastien, vues par Ana ──
  const before = await handCount(ana, BASTIEN.id)
  await bastien.page.getByRole('button', { name: 'Piocher' }).click()
  await ana.page.waitForFunction(
    ([id, n]) => Number(document.querySelector(`[data-strip="${id}"] [data-testid="hand-count"]`)?.textContent) === n,
    [BASTIEN.id, before + 1],
  )
  check(true, `Ana voit en direct la pioche de Bastien (${before} → ${before + 1})`)
  check(leaks(ana).length === 0, `aucune donnée des cartes cachées des autres reçue par Ana (${leaks(ana).join(', ')})`)
  check(refsReceived(bastien, BASTIEN.id).size > 1, 'Bastien reçoit bien les données de sa propre main')

  const played = await myHand(bastien).first().getAttribute('data-card-id')
  await myHand(bastien).first().dblclick()
  const playedInStrip = ana.page.locator(`[data-strip="${BASTIEN.id}"] [data-row] [data-strip-card="${played}"]`)
  await playedInStrip.waitFor()
  check(true, 'la carte jouée par Bastien apparaît dans ses rangées chez Ana')
  check(/ring-2/.test(await playedInStrip.getAttribute('class')), 'elle est en surbrillance')
  await ana.page.getByTestId('activity-line').filter({ hasText: BASTIEN.name }).first().waitFor()
  check(true, 'ligne d’activité « Bastien … » chez Ana')
  await capture(ana, 'activite-ana')
  await ana.page.waitForTimeout(1700)
  check(!/ring-2/.test(await playedInStrip.getAttribute('class')), 'la surbrillance s’éteint après 1,5 s')

  // ── Bastien prend une carte du cimetière d'Ana ──
  const dumped = await myHand(ana).first().getAttribute('data-card-id')
  await drag(ana, myHand(ana).first(), board(ana, ANA.id).locator('[data-zone="graveyard"]'))
  await board(ana, ANA.id).locator(`[data-zone="graveyard"] [data-card-id="${dumped}"]`).waitFor()
  check(true, 'Ana glisse une carte de sa main dans son cimetière')
  await bastien.page.locator(`[data-strip="${ANA.id}"] [data-testid="player-name"]`).click()
  await board(bastien, ANA.id).waitFor()
  check(true, 'Bastien agrandit le plateau d’Ana')
  await capture(bastien, 'vue-agrandie')
  await drag(bastien, board(bastien, ANA.id).locator(`[data-zone="graveyard"] [data-card-id="${dumped}"]`), board(bastien, BASTIEN.id).locator('[data-zone="battlefield"]'))
  await board(bastien, BASTIEN.id).locator(`[data-zone="battlefield"] [data-card-id="${dumped}"]`).waitFor()
  await ana.page.locator(`[data-strip="${BASTIEN.id}"] [data-strip-card="${dumped}"]`).waitFor()
  check(true, 'Bastien glisse la carte du cimetière d’Ana sur son champ de bataille, vu par Ana')

  // ── Dépôt refusé : Ana lâche sa carte sur le champ de bataille de Bastien ──
  const handBefore = await myHand(ana).count()
  await ana.page.locator(`[data-strip="${BASTIEN.id}"] [data-testid="player-name"]`).click()
  await board(ana, BASTIEN.id).waitFor()
  await drag(ana, myHand(ana).first(), board(ana, BASTIEN.id).locator('[data-zone="battlefield"]'))
  await ana.page.getByTestId('activity-error').waitFor()
  check(true, `dépôt refusé, message affiché : « ${await ana.page.getByTestId('activity-error').innerText()} »`)
  check((await myHand(ana).count()) === handBefore, 'la carte reste dans la main d’Ana')
  await ana.page.getByRole('button', { name: 'Tous' }).click()

  // ── Chloé : −3 PV et 5 blessures de commandant à Ana ──
  const anaStripPanel = chloe.page.locator(`[data-strip="${ANA.id}"] [data-panel="${ANA.id}"]`)
  for (let i = 0; i < 3; i++) await anaStripPanel.getByRole('button', { name: 'moins' }).first().click()
  await chloe.page.locator(`[data-strip="${ANA.id}"] [data-testid="player-name"]`).click()
  const damage = board(chloe, ANA.id).locator(`[data-panel="${ANA.id}"]`).getByTestId(`commander-damage-${CHLOE.id}`)
  for (let i = 0; i < 5; i++) await damage.locator('xpath=following-sibling::button').click()
  await ana.page.waitForFunction((id) => document.querySelector(`[data-board="${id}"] [data-panel="${id}"] [data-testid="player-life"]`)?.textContent === '32', ANA.id)
  await ana.page.waitForFunction(([id, c]) => document.querySelector(`[data-board="${id}"] [data-testid="commander-damage-${c}"]`)?.textContent === '5', [ANA.id, CHLOE.id])
  check(true, 'Ana voit 5 blessures du commandant de Chloé et 32 PV (40 − 3 − 5 : les blessures retirent aussi des PV)')
  await bastien.page.waitForFunction((id) => document.querySelector(`[data-panel="${id}"] [data-testid="player-life"]`)?.textContent === '32', ANA.id)
  check(true, 'Bastien voit aussi 32 PV pour Ana')

  // ── Ana regarde les 3 cartes du dessus de Bastien ──
  await ana.page.locator(`[data-strip="${BASTIEN.id}"] [data-zone="library"]`).click({ button: 'right' })
  await ana.page.getByRole('menuitem', { name: 'Regarder les X du dessus…' }).click()
  await ana.page.locator('[data-pile-card]').nth(2).waitFor()
  check((await ana.page.locator('[data-pile-card]').count()) === 3, 'Ana voit les 3 cartes du dessus de Bastien')
  await capture(ana, 'regarder-3')
  await chloe.page.waitForTimeout(500)
  const chloeView = lastView(chloe)
  check(chloeView.players[BASTIEN.id].zones.library.visible.length === 0, 'Chloé ne voit pas ces cartes')
  check(leaks(chloe).length === 0, `aucune donnée de carte cachée reçue par Chloé (${leaks(chloe).join(', ')})`)
  await ana.page.getByRole('button', { name: 'Fermer' }).click()

  // ── Carte du dessus d'Ana montrée à tous : « Révéler », puis « Jouer avec la carte du dessus révélée » ──
  const anaPile = board(ana, ANA.id).locator('[data-zone="library"]')
  // Bandeau ou plateau agrandi : la pile d'Ana porte data-zone et data-player dans les deux cas.
  const anaTopSeenBy = (who) => who.page.locator(`[data-zone="library"][data-player="${ANA.id}"] img`)
  const anaMenu = async (name) => {
    await anaPile.click({ button: 'right' })
    await ana.page.getByRole('menuitem', { name }).click()
  }
  await anaMenu('Révéler la carte du dessus')
  await anaPile.locator('img').waitFor()
  for (const who of [bastien, chloe]) await anaTopSeenBy(who).waitFor()
  check(true, 'Ana révèle la carte du dessus : face visible chez Ana, Bastien et Chloé')
  await capture(bastien, 'dessus-revele-chez-bastien')
  await ana.page.getByRole('button', { name: 'Piocher' }).click()
  for (const who of [bastien, chloe]) await anaTopSeenBy(who).waitFor({ state: 'detached' })
  check(true, 'Ana pioche la carte révélée : dos de carte chez les autres')
  await anaMenu('Jouer avec la carte du dessus révélée')
  for (const who of [bastien, chloe]) await anaTopSeenBy(who).waitFor()
  await anaPile.locator('img').waitFor()
  check(true, 'Ana joue avec la carte du dessus révélée : visible chez tout le monde')
  await anaMenu('Cacher la carte du dessus')
  for (const who of [bastien, chloe]) await anaTopSeenBy(who).waitFor({ state: 'detached' })
  check(true, 'Ana cache la carte du dessus : dos de carte chez les autres')

  // ── moveTop : Ana glisse le dessus de sa bibliothèque sur son champ de bataille ──
  const myBattlefield = board(ana, ANA.id).locator('[data-zone="battlefield"] [data-card-id]')
  const onBattlefield = await myBattlefield.count()
  await drag(ana, board(ana, ANA.id).locator(`[data-card-id="top:${ANA.id}"]`), board(ana, ANA.id).locator('[data-zone="battlefield"]'))
  await ana.page.waitForFunction(([id, n]) => document.querySelectorAll(`[data-board="${id}"] [data-zone="battlefield"] [data-card-id]`).length === n, [ANA.id, onBattlefield + 1])
  check(true, 'Ana glisse la carte du dessus de sa bibliothèque sur son champ de bataille')

  // ── Rechargement ──
  const chloeHand = await myHand(chloe).count()
  await chloe.page.reload()
  await chloe.page.getByTestId('game').waitFor()
  await myHand(chloe).first().waitFor()
  check((await myHand(chloe).count()) === chloeHand, `Chloé recharge et retrouve sa main (${chloeHand} cartes)`)

  // ── Spectateur ──
  await damien.page.goto(tableUrl)
  await damien.page.getByTestId('spectator').waitFor()
  check(true, 'Damien regarde en spectateur')
  check(leaks(damien).length === 0, `le spectateur ne reçoit aucune carte cachée (${leaks(damien).join(', ')})`)
  check((await damien.page.getByRole('button', { name: 'Piocher' }).count()) === 0, 'le spectateur n’a pas de bouton Piocher')
  await damien.page.locator(`[data-strip="${BASTIEN.id}"] [data-strip-card]`).first().click({ button: 'right' })
  await damien.page.waitForTimeout(300)
  check((await damien.page.getByRole('menu').count()) === 0, 'clic droit du spectateur : aucun menu')
  await damien.page.locator(`[data-strip="${ANA.id}"] [data-testid="player-name"]`).click()
  const anaCard = board(damien, ANA.id).locator('[data-zone="battlefield"] [data-card-id]').first()
  const styleBefore = await anaCard.getAttribute('style')
  const box = await anaCard.boundingBox()
  await damien.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await damien.page.mouse.down()
  await damien.page.mouse.move(box.x + 80, box.y + 60, { steps: 10 })
  const overlay = await damien.page.getByTestId('drag-overlay').count()
  await damien.page.mouse.up()
  check(overlay === 0 && (await anaCard.getAttribute('style')) === styleBefore, 'le spectateur ne peut déplacer aucune carte')
  await capture(damien, 'spectateur')

  // ── L'hôte passe le tour de Chloé ──
  const byName = { [ANA.name]: ana, [BASTIEN.name]: bastien, [CHLOE.name]: chloe }
  for (let i = 0; i < 3 && (await activeName(ana)) !== CHLOE.name; i++) {
    const current = await activeName(ana)
    await byName[current].page.getByRole('button', { name: 'Tour suivant' }).click()
    await ana.page.waitForFunction((name) => document.querySelector('[data-testid="active-player"]')?.textContent !== `Joueur actif : ${name}`, current)
  }
  check((await activeName(ana)) === CHLOE.name, 'c’est au tour de Chloé')
  await ana.page.getByRole('button', { name: 'Hôte' }).click()
  await ana.page.getByRole('menuitem', { name: `Passer le tour de ${CHLOE.name}` }).click()
  await ana.page.waitForFunction((name) => document.querySelector('[data-testid="active-player"]')?.textContent !== `Joueur actif : ${name}`, CHLOE.name)
  await ana.page.getByRole('button', { name: 'Journal' }).click()
  await ana.page.getByTestId('log').getByText('(passé par l’hôte)').waitFor()
  check(true, `Ana (hôte) passe le tour de Chloé → ${await activeName(ana)}, « (passé par l’hôte) » au journal`)
  await capture(ana, 'journal')
  await ana.page.getByRole('button', { name: 'Fermer le journal' }).click()

  // ── Fin de partie ──
  await bastien.page.getByRole('button', { name: 'Abandonner' }).click()
  await ana.page.locator(`[data-panel="${BASTIEN.id}"]`).getByText('éliminé').waitFor()
  check(true, 'Bastien abandonne')
  await ana.page.getByRole('button', { name: 'Hôte' }).click()
  await ana.page.getByRole('menuitem', { name: `Éliminer ${CHLOE.name}` }).click()
  for (const who of [ana, bastien, chloe, damien]) {
    await who.page.getByTestId('finished').getByText(`Victoire de ${ANA.name}`).waitFor()
  }
  check(true, 'Ana élimine Chloé : « Victoire de Ana » chez tout le monde')
  await capture(chloe, 'fin')

  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'dc-league', '--local', '--json', '--command',
    `SELECT status, winner_player_id FROM game_tables WHERE id = '${tableId}'`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const row = JSON.parse(out)[0].results[0]
  check(row.status === 'finished' && row.winner_player_id === ANA.id, `base : partie terminée, vainqueur ${row.winner_player_id}`)

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ' : ' + errors.join(' | ') : ''}`)
  console.log('\nTout est OK')
} finally {
  await browser.close()
}
