// Section admin « Parties en cours » : liste, suppression d'une partie, suppression des inactives.
// Prérequis : seed-online.mjs appliqué ; Worker de jeu (`npm run game:dev`) et site (`wrangler pages dev --port 8788`) lancés.
// Le script vide les tables locales et rend e2e-1 admin (e2e-2 reste simple joueur).
// Usage : node scripts/admin-games-check.mjs <url-de-base> <dossier-captures>
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { launch } from './browser.mjs'
import { PLAYERS, tokenOf } from './seed-online.mjs'

const [base = 'http://localhost:8788', out = '/tmp/admin-games-check'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const [ANA, BASTIEN, CHLOE] = PLAYERS

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

function sql(command) {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'dc-league', '--local', '--command', command], { stdio: 'ignore' })
}

sql(`DELETE FROM game_seats; DELETE FROM game_tables; UPDATE users SET is_admin = 1 WHERE id = 'u-${ANA.id}'`)
const browser = await launch()
const errors = []

async function openAs(player, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ locale: 'fr-FR', viewport })
  await context.addCookies([{ name: 'dc_session', value: tokenOf(player.id), url: base }])
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`${player.name} : ${e.message}`))
  page.on('dialog', (d) => d.accept())
  await page.goto(base + '/salon')
  return { ...player, page }
}

/** Appel API depuis la page (même origine, cookie de session). */
const api = (who, path, method, body) =>
  who.page.evaluate(
    async ([path, method, body]) => {
      const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      return { status: res.status, json: await res.json().catch(() => null) }
    },
    [path, method, body],
  )

const ana = await openAs(ANA)
const bastien = await openAs(BASTIEN)
const chloe = await openAs(CHLOE)

// Partie en cours entre Ana et Bastien, vieillie de 3 jours ; table ouverte récente de Chloé.
const playing = (await api(ana, '/api/games', 'POST', { format: 'duel', seats: 2 })).json.id
await api(bastien, `/api/games/${playing}/join`, 'POST')
await api(ana, `/api/games/${playing}/deck`, 'POST', { deckId: `deck-${ANA.id}` })
await api(bastien, `/api/games/${playing}/deck`, 'POST', { deckId: `deck-${BASTIEN.id}` })
const started = await api(ana, `/api/games/${playing}/start`, 'POST', {})
check(started.status < 300, `partie démarrée (${started.status})`)
await bastien.page.goto(`${base}/tables/${playing}`)
await bastien.page.getByRole('button', { name: 'Abandonner' }).waitFor()
check(true, 'Bastien est à la table')
sql(`UPDATE game_tables SET last_activity_at = datetime('now', '-3 days') WHERE id = '${playing}'`)
await api(chloe, '/api/games', 'POST', { format: 'commander', seats: 4 })

// Un simple joueur ne peut pas supprimer.
const refused = await api(bastien, `/api/admin/games/${playing}`, 'DELETE')
check(refused.status === 403, `joueur non admin refusé (${refused.status})`)

// Admin : liste.
await ana.page.goto(base + '/admin')
const section = ana.page.getByTestId('games-admin')
await section.waitFor()
const rows = section.getByTestId('games-admin-row')
check((await rows.count()) === 2, 'deux parties listées')
check((await rows.first().innerText()).includes('Ana, Bastien') && (await rows.first().innerText()).includes('En cours'), 'la plus inactive en premier, avec ses joueurs et son statut')
check((await rows.first().innerText()).includes('il y a 3 j'), 'inactivité affichée')
await section.screenshot({ path: `${out}/admin-parties.png` })

// Suppression des inactives : la partie en cours disparaît, Bastien est prévenu.
await section.getByRole('button', { name: 'Supprimer la partie inactive depuis plus de 24 h' }).click()
await ana.page.getByText('1 partie supprimée').waitFor()
check((await rows.count()) === 1, 'partie inactive retirée de la liste')
await bastien.page.getByText("Cette partie n'existe plus").waitFor({ timeout: 15000 })
check(true, 'Bastien voit que la partie n’existe plus')
await bastien.page.screenshot({ path: `${out}/joueur-partie-supprimee.png` })

// Suppression d'une partie précise.
await rows.first().getByRole('button', { name: 'Supprimer' }).click()
await ana.page.getByText('Partie supprimée', { exact: true }).waitFor()
check(await section.getByText('Aucune partie en cours.').isVisible(), 'liste vide')
await ana.page.reload()
check((await ana.page.getByTestId('games-admin-row').count()) === 0, 'toujours vide après rechargement')
check((await api(chloe, '/api/games', 'GET')).json.length === 0, 'salon vide')

// Téléphone.
const phone = await openAs(ANA, { width: 390, height: 844 })
await api(chloe, '/api/games', 'POST', { format: 'commander', seats: 4 })
await phone.page.goto(base + '/admin')
await phone.page.getByTestId('games-admin').scrollIntoViewIfNeeded()
check(await phone.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'téléphone : pas de défilement horizontal')
await phone.page.getByTestId('games-admin').screenshot({ path: `${out}/admin-parties-telephone.png` })

check(errors.length === 0, `aucune erreur de page${errors.length ? ` : ${errors.join(' | ')}` : ''}`)
await browser.close()
console.log('Tout est bon.')
