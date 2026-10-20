// Vérifie les ligues créées par les joueurs : ligue privée, lien d'invitation, droits, gestion, anciennes adresses.
// Usage : node scripts/leagues-check.mjs http://localhost:8788 <dossier-captures>
// Prérequis : seed-online.mjs appliqué (joueurs e2e-1…e2e-5, ligue publique « Saison e2e »).
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const [base = 'http://localhost:8788', out = '/tmp/leagues-check'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
let failures = 0
function check(ok, label) {
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  if (!ok) failures++
}
async function pageAs(playerId, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ locale: 'fr-FR', viewport })
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
