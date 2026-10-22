// Vérifie les ligues créées par les joueurs : ligue privée, lien d'invitation, droits, gestion, inscription depuis un lien de ligue, anciennes adresses.
// Usage : node scripts/leagues-check.mjs http://localhost:8788 <dossier-captures>
// Prérequis : seed-online.mjs appliqué (joueurs e2e-1…e2e-5, ligue publique « Saison e2e »).
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [base = 'http://localhost:8788', out = '/tmp/leagues-check'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
let failures = 0
function check(ok, label) {
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  if (!ok) failures++
}
async function pageAs(playerId, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport })
  if (playerId) await context.addCookies([{ name: 'dc_session', value: `jeton-de-test-${playerId}`, url: base }])
  return context.newPage()
}
const name = `Ligue privée e2e ${Date.now().toString(36)}`

// 1. Ana crée une ligue privée et son lien d'invitation.
const ana = await pageAs('e2e-1')
await ana.goto(base + '/ligues')
await ana.getByRole('link', { name: 'Créer une ligue' }).click()
await ana.waitForURL('**/ligues/nouvelle')
await ana.getByLabel('Nom de la ligue').fill(name)
await ana.getByText('Privée', { exact: true }).click()
await ana.screenshot({ path: `${out}/1-creation.png` })
await ana.getByRole('button', { name: 'Créer la ligue' }).click()
await ana.waitForURL('**/ligues/*/gerer')
const leagueId = new URL(ana.url()).pathname.split('/')[2]
check(await ana.getByRole('heading', { level: 1, name }).isVisible(), 'organisatrice : arrive sur la gestion de sa ligue')
check(await ana.getByText('Organisée par Ana').isVisible(), 'en-tête : « Organisée par Ana »')
check(await ana.getByText('Privée').first().isVisible(), 'en-tête : badge « Privée »')
check(await ana.getByLabel('Inscrire Ana à la ligue').isChecked(), "organisatrice : inscrite d'office dans sa ligue")
await ana.getByRole('button', { name: "Créer un lien d'invitation" }).click()
const linkInput = ana.getByRole('textbox', { name: 'Lien à partager' })
await linkInput.waitFor()
await ana.waitForFunction(() => document.querySelector('input[aria-label="Lien à partager"]')?.value?.includes('/ligues/rejoindre/'))
const invite = await linkInput.inputValue()
check(invite.startsWith(base + '/ligues/rejoindre/'), `lien d'invitation affiché (${invite.replace(base, '')})`)
await ana.screenshot({ path: `${out}/2-gestion.png`, fullPage: true })

// 2. Bastien rejoint par le lien.
const bastien = await pageAs('e2e-2')
await bastien.goto(invite)
check(await bastien.getByRole('heading', { name }).isVisible(), 'invité : voit le nom de la ligue')
await bastien.screenshot({ path: `${out}/3-rejoindre.png` })
await bastien.getByRole('button', { name: 'Rejoindre la ligue' }).click()
await bastien.waitForURL(`**/ligues/${leagueId}/classement`)
check(await bastien.getByRole('region', { name: 'Ma participation' }).isVisible(), 'invité : encart « Ma participation » sur le classement')
await bastien.getByLabel('Mon deck pour cette ligue').selectOption('deck-e2e-2')
await bastien.getByText('Enregistré').waitFor()
check(true, 'invité : choisit son deck')
const tabs = await bastien.getByRole('navigation', { name: 'Pages de la ligue' }).locator('a').allInnerTexts()
check(!tabs.includes('Gérer'), `invité : pas d'onglet « Gérer » (${tabs.join(' · ')})`)
const manage = await bastien.goto(`${base}/ligues/${leagueId}/gerer`)
check(manage.status() === 404, `invité : /gerer répond ${manage.status()}`)

// 3. Chloé, non invitée, ne voit pas la ligue.
const chloe = await pageAs('e2e-3')
const hidden = await chloe.goto(`${base}/ligues/${leagueId}/classement`)
check(hidden.status() === 404, `non invitée : la ligue privée répond ${hidden.status()}`)
await chloe.goto(base + '/ligues')
check((await chloe.getByText(name).count()) === 0, "non invitée : la ligue n'est pas dans la liste")
check(await chloe.getByText('Saison e2e').first().isVisible(), 'non invitée : voit la ligue publique')

// 4. Un visiteur qui ouvre le lien est envoyé à la connexion, avec l'explication.
const visitor = await pageAs(null)
await visitor.goto(invite)
await visitor.waitForURL('**/connexion?**')
check(await visitor.getByText("Pas encore de compte ? Demande une invitation à l'administrateur.", { exact: false }).isVisible(), 'visiteur : connexion avec le message pour la ligue')
await visitor.screenshot({ path: `${out}/4-visiteur.png` })

// 4 bis. Un ami sans compte : l'invitation garde le lien de ligue (`from`), mais refuse un autre site.
function sql(statements) {
  const file = join(mkdtempSync(join(tmpdir(), 'leagues-check-')), 'prep.sql')
  writeFileSync(file, statements.join('\n'))
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'dc-league', '--local', '--file', file], { stdio: 'ignore' })
}
const newcomers = [
  { id: 'e2e-inv-1', name: 'Fanny Invitée', token: `jeton-invitation-1-${Date.now()}` },
  { id: 'e2e-inv-2', name: 'Gaspard Invité', token: `jeton-invitation-2-${Date.now()}` },
]
sql(
  newcomers.flatMap((n) => [
    `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE player_id = '${n.id}' OR username = '${n.id}');`,
    `DELETE FROM users WHERE player_id = '${n.id}' OR username = '${n.id}';`,
    `DELETE FROM invitations WHERE player_id = '${n.id}';`,
    `INSERT INTO players (id, name) VALUES ('${n.id}', '${n.name}') ON CONFLICT(id) DO UPDATE SET name = excluded.name;`,
    `INSERT INTO invitations (id, player_id, kind, expires_at) VALUES ('${createHash('sha256').update(n.token).digest('hex')}', '${n.id}', 'signup', '2099-01-01T00:00:00.000Z');`,
  ]),
)
async function signUp(page, newcomer, from) {
  await page.goto(`${base}/invitation/${newcomer.token}?from=${encodeURIComponent(from)}`)
  await page.getByLabel('Pseudo de connexion').fill(newcomer.id)
  await page.getByLabel('Mot de passe', { exact: true }).fill('mot-de-passe-e2e')
  await page.getByLabel('Confirmation').fill('mot-de-passe-e2e')
}
const invitePath = new URL(invite).pathname
const fanny = await pageAs(null, { width: 390, height: 844 })
await signUp(fanny, newcomers[0], invitePath)
check(await fanny.getByText('Une fois ton compte créé, tu arriveras sur la page pour rejoindre la ligue.').isVisible(), 'nouvel ami : l’invitation annonce la ligue')
const overflowInvitation = await fanny.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
check(overflowInvitation <= 0, `téléphone : pas de défilement horizontal sur l'invitation (${overflowInvitation} px)`)
await fanny.screenshot({ path: `${out}/4b-invitation-telephone.png`, fullPage: true })
await fanny.getByRole('button', { name: 'Créer mon compte' }).click()
await fanny.waitForURL((url) => url.pathname === invitePath)
check(await fanny.getByRole('heading', { name }).isVisible(), 'nouvel ami : arrive sur le lien de ligue après l’inscription')
await fanny.screenshot({ path: `${out}/4c-apres-inscription-telephone.png`, fullPage: true })
await fanny.context().close()
const gaspard = await pageAs(null, { width: 390, height: 844 })
await signUp(gaspard, newcomers[1], 'https://exemple.invalid/ligues/rejoindre/x')
check((await gaspard.getByText('tu arriveras sur la page pour rejoindre la ligue', { exact: false }).count()) === 0, 'from externe : aucune annonce de ligue')
await gaspard.getByRole('button', { name: 'Créer mon compte' }).click()
await gaspard.waitForURL((url) => url.origin === base && url.pathname === '/profil')
check(true, 'from externe : refusé, arrivée sur le profil')
await gaspard.context().close()
sql(
  newcomers.flatMap((n) => [
    `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE player_id = '${n.id}');`,
    `DELETE FROM users WHERE player_id = '${n.id}';`,
    `DELETE FROM invitations WHERE player_id = '${n.id}';`,
    `DELETE FROM players WHERE id = '${n.id}';`,
  ]),
)

// 5. Ana inscrit Damien directement, génère les matchs et saisit un score.
await ana.reload()
await ana.getByLabel('Inscrire Damien à la ligue').click()
await ana.getByText('Damien inscrit').waitFor()
check(true, 'organisatrice : inscrit Damien sans lien')
await ana.getByRole('button', { name: 'Générer la ligue (3 joueurs)' }).click()
await ana.getByRole('button', { name: 'Confirmer la génération' }).click()
await ana.getByText(/Round 1/).first().waitFor({ timeout: 15000 })
check(true, 'organisatrice : matchs générés')
await ana.screenshot({ path: `${out}/5-matchs.png`, fullPage: true })

// Le lien ne sert plus une fois les matchs générés.
const emilie = await pageAs('e2e-5')
await emilie.goto(invite)
check(await emilie.getByText('Les matchs ont déjà été générés : impossible de rejoindre cette ligue.').isVisible(), 'trop tard : rejoindre refusé après la génération')

// 6. Anciennes adresses.
await chloe.goto(base + '/classement')
check(/\/ligues\/[^/]+\/classement$/.test(new URL(chloe.url()).pathname), `ancienne adresse /classement → ${new URL(chloe.url()).pathname}`)
await chloe.goto(base + '/stats')
check(new URL(chloe.url()).pathname === '/ligues/statistiques', '/stats → /ligues/statistiques')
await chloe.goto(base + '/history')
check(new URL(chloe.url()).pathname === '/ligues', '/history → /ligues')

// 7. Téléphone : la liste et la gestion restent lisibles.
const phone = await pageAs('e2e-1', { width: 390, height: 844 })
await phone.goto(`${base}/ligues/${leagueId}/gerer`)
const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
check(overflow <= 0, `téléphone : pas de défilement horizontal sur la gestion (${overflow} px)`)
await phone.screenshot({ path: `${out}/6-telephone-gestion.png`, fullPage: true })
await phone.goto(`${base}/ligues`)
await phone.screenshot({ path: `${out}/7-telephone-liste.png`, fullPage: true })

await browser.close()
console.log(failures ? `${failures} échec(s)` : 'Tout est bon')
process.exit(failures ? 1 : 0)
