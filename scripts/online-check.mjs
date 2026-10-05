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
const COMMANDER_REF = 1 // Kenrith : première ligne de chaque deck

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
  page.on('dialog', (d) => d.accept())
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

const section = (who, playerId) => who.page.locator(`[data-player="${playerId}"]`)
const handCount = async (who, playerId) => Number(await section(who, playerId).getByTestId('hand-count').innerText())
const activeName = async (who) => (await who.page.getByText(/^Joueur actif :/).innerText()).replace('Joueur actif : ', '')

/** Données de cartes reçues pour un propriétaire, toutes trames confondues. */
const refsReceived = (who, owner) =>
  new Set(who.frames.filter((f) => f.type === 'view').flatMap((f) => Object.keys(f.cards[owner] ?? {}).map(Number)))

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
  check(true, 'la partie s’affiche chez les 3 joueurs')
  for (const who of [ana, bastien, chloe]) {
    check((await who.page.getByTestId('my-hand').locator('li').count()) === 7, `${who.name} : main de 7 cartes`)
  }

  for (const who of [ana, bastien, chloe]) {
    await who.page.getByRole('button', { name: 'Garder' }).click()
    await who.page.getByRole('button', { name: 'Garder' }).waitFor({ state: 'detached' })
  }
  check(true, 'chacun garde sa main')

  const before = await handCount(ana, BASTIEN.id)
  await bastien.page.getByRole('button', { name: 'Piocher' }).click()
  await ana.page.waitForFunction(
    ([id, n]) => Number(document.querySelector(`[data-player="${id}"] [data-testid="hand-count"]`)?.textContent) === n,
    [BASTIEN.id, before + 1],
  )
  check(true, `Ana voit en direct la pioche de Bastien (${before} → ${before + 1})`)

  const leaked = [...refsReceived(ana, BASTIEN.id)].filter((ref) => ref !== COMMANDER_REF)
  check(leaked.length === 0, `aucune donnée des cartes cachées de Bastien reçue par Ana (reçu : ${[...refsReceived(ana, BASTIEN.id)].join(', ')})`)
  check(refsReceived(bastien, BASTIEN.id).size > 1, 'Bastien reçoit bien les données de sa propre main')
  await capture(ana, 'partie-ana')

  // ── Rechargement ──
  const chloeHand = await chloe.page.getByTestId('my-hand').locator('li').count()
  await chloe.page.reload()
  await chloe.page.getByTestId('game').waitFor()
  check((await chloe.page.getByTestId('my-hand').locator('li').count()) === chloeHand, `Chloé recharge et retrouve sa main (${chloeHand} cartes)`)

  // ── Spectateur ──
  await damien.page.goto(tableUrl)
  await damien.page.getByTestId('spectator').waitFor()
  check(true, 'Damien regarde en spectateur')
  const spectatorLeaks = PLAYERS.slice(0, 3).flatMap((p) => [...refsReceived(damien, p.id)].filter((ref) => ref !== COMMANDER_REF))
  check(spectatorLeaks.length === 0, 'le spectateur ne reçoit aucune carte cachée')
  check((await damien.page.getByRole('button', { name: 'Piocher' }).count()) === 0, 'le spectateur n’a aucun bouton d’action')
  await capture(damien, 'spectateur')

  // ── L'hôte passe le tour de Chloé ──
  const byName = { [ANA.name]: ana, [BASTIEN.name]: bastien, [CHLOE.name]: chloe }
  for (let i = 0; i < 3 && (await activeName(ana)) !== CHLOE.name; i++) {
    const active = byName[await activeName(ana)]
    await active.page.getByRole('button', { name: 'Fin du tour' }).click()
    await ana.page.waitForTimeout(400)
  }
  check((await activeName(ana)) === CHLOE.name, 'c’est au tour de Chloé')
  await section(ana, CHLOE.id).getByRole('button', { name: 'Passer son tour' }).click()
  await ana.page.waitForFunction((name) => !document.body.innerText.includes(`Joueur actif : ${name}`), CHLOE.name)
  check(true, `Ana (hôte) passe le tour de Chloé → ${await activeName(ana)}`)

  // ── Fin de partie ──
  await bastien.page.getByRole('button', { name: 'Abandonner' }).click()
  await section(ana, BASTIEN.id).getByText('éliminé').waitFor()
  check(true, 'Bastien abandonne')
  await section(ana, CHLOE.id).getByRole('button', { name: 'Éliminer' }).click()
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
