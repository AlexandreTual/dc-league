// Mails de bout en bout dans un vrai navigateur : adresse du profil, « Mot de passe oublié ? », invitation par mail.
// Prérequis : `.dev.vars` contenant `MAIL_TEST=1`, migrations appliquées en local, données de scripts/seed-online.mjs
// chargées, site lancé (`wrangler pages dev --port 8788`).
// Usage : node scripts/mail-check.mjs <url-de-base> <dossier-captures>
// Le script prépare lui-même la base locale (Ana admin avec un mot de passe connu, Émile sans compte, boîte vidée)
// et remet la session de test d'Ana à la fin.
import { execFileSync } from 'node:child_process'
import { createHash, pbkdf2Sync, randomBytes } from 'node:crypto'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { PLAYERS, tokenOf } from './seed-online.mjs'

const [base = 'http://localhost:8788', outDir = '.'] = process.argv.slice(2)
const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [ANA] = PLAYERS
const ANA_USER = `e2e-${ANA.name}`
const OLD_PASSWORD = 'ancien-mot-de-passe'
const NEW_PASSWORD = 'nouveau-mot-de-passe'
const EMILE = { id: 'e2e-5', name: 'Émile' }

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

/** Même format que lib/auth/crypto.ts (PBKDF2-SHA256, 100 000 itérations). */
function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = pbkdf2Sync(password, salt, 100_000, 32, 'sha256')
  return `pbkdf2$100000$${salt.toString('base64')}$${hash.toString('base64')}`
}

function sql(statements) {
  const file = join(mkdtempSync(join(tmpdir(), 'mail-check-')), 'prep.sql')
  writeFileSync(file, statements.join('\n'))
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'dc-league', '--local', '--file', file], { stdio: 'ignore' })
}

const anaSession = createHash('sha256').update(tokenOf(ANA.id)).digest('hex')
const restoreAnaSession = `INSERT OR REPLACE INTO sessions (id, user_id, expires_at) VALUES ('${anaSession}', 'u-${ANA.id}', '2099-01-01T00:00:00.000Z');`

sql([
  `UPDATE users SET email = NULL WHERE player_id LIKE 'e2e-%';`,
  `UPDATE users SET is_admin = 1, password_hash = '${hashPassword(OLD_PASSWORD)}' WHERE id = 'u-${ANA.id}';`,
  `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE player_id = '${EMILE.id}');`,
  `DELETE FROM users WHERE player_id = '${EMILE.id}';`,
  `DELETE FROM invitations WHERE player_id LIKE 'e2e-%';`,
  `DELETE FROM password_requests;`,
  `DELETE FROM login_attempts;`,
  `INSERT OR IGNORE INTO players (id, name) VALUES ('${EMILE.id}', '${EMILE.name}');`,
  `DELETE FROM test_mails;`,
  restoreAnaSession,
])

async function mails(request) {
  const res = await request.get(`${base}/api/test/mails`)
  check(res.ok(), 'boîte de test accessible (MAIL_TEST=1)')
  return (await res.json()).mails
}

/** Attend un mail pour cette adresse (l'envoi « mot de passe oublié » se fait après la réponse). */
async function waitMail(request, to, count) {
  for (let i = 0; i < 40; i++) {
    const list = (await (await request.get(`${base}/api/test/mails`)).json()).mails.filter((m) => m.to === to)
    if (list.length >= count) return list[0]
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`ÉCHEC : aucun mail reçu pour ${to}`)
}

const linkIn = (mail) => mail.text.match(/https?:\/\/\S+\/invitation\/[A-Za-z0-9_-]+/)?.[0]

async function login(page, username, password) {
  await page.goto(`${base}/connexion`)
  await page.getByLabel('Pseudo').fill(username)
  await page.getByLabel('Mot de passe').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
}

const browser = await chromium.launch({ executablePath })
try {
  const errors = []
  const phone = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true }

  // 1. Ana ajoute son adresse dans son profil (sur téléphone).
  const anaContext = await browser.newContext(phone)
  await anaContext.addCookies([{ name: 'dc_session', value: tokenOf(ANA.id), url: base }])
  const ana = await anaContext.newPage()
  ana.on('pageerror', (e) => errors.push(e.message))
  await ana.goto(`${base}/profil`)
  check(await ana.getByTestId('email-banner').isVisible(), 'profil sans adresse : bandeau « Ajoute ton adresse mail… »')
  await ana.getByLabel('Adresse mail').fill('ana@exemple')
  await ana.getByRole('button', { name: 'Enregistrer' }).nth(1).click()
  await ana.getByText('Adresse mail invalide').waitFor()
  check(true, 'adresse invalide refusée : « Adresse mail invalide »')
  await ana.getByLabel('Adresse mail').fill('  ana@example.test ')
  await ana.getByRole('button', { name: 'Enregistrer' }).nth(1).click()
  await ana.getByText('Adresse enregistrée').waitFor()
  check(!(await ana.getByTestId('email-banner').isVisible()), 'adresse enregistrée, bandeau masqué')
  await ana.screenshot({ path: `${outDir}/mail-profil-mobile.png`, fullPage: true })
  console.log(`📸 ${outDir}/mail-profil-mobile.png`)
  await ana.reload()
  check((await ana.getByLabel('Adresse mail').inputValue()) === 'ana@example.test', 'adresse retrouvée après rechargement, sans espaces')
  await anaContext.close()

  // 2. « Mot de passe oublié ? » par adresse, sans être connecté.
  const visitor = await browser.newContext(phone)
  const page = await visitor.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${base}/connexion`)
  await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click()
  await page.waitForURL('**/mot-de-passe-oublie')
  check(true, 'lien « Mot de passe oublié ? » depuis la connexion')
  await page.getByLabel('Pseudo ou adresse mail').fill('ANA@example.test')
  await page.getByRole('button', { name: 'Envoyer le lien' }).click()
  const done = page.getByTestId('forgot-done')
  await done.waitFor()
  const doneText = await done.innerText()
  check(doneText.includes('Il est valable 1 heure'), 'message de confirmation affiché')
  await page.screenshot({ path: `${outDir}/mail-oublie-mobile.png`, fullPage: true })
  console.log(`📸 ${outDir}/mail-oublie-mobile.png`)
  const forgot = await waitMail(page.request, 'ana@example.test', 1)
  check(forgot.subject === 'Commander League — nouveau mot de passe', 'mail « nouveau mot de passe » reçu')
  check(forgot.text.includes('valable 1 heure') && forgot.text.includes('Bonjour Ana'), 'mail : nom du joueur et durée de validité')

  // Identifiant inconnu : même message, aucun mail de plus.
  const before = (await mails(page.request)).length
  await page.getByLabel('Pseudo ou adresse mail').fill('personne@example.test')
  await page.getByRole('button', { name: 'Envoyer le lien' }).click()
  await done.waitFor()
  check((await done.innerText()) === doneText, 'identifiant inconnu : message identique')
  await page.waitForTimeout(1500)
  check((await mails(page.request)).length === before, 'identifiant inconnu : aucun mail')

  // 3. Nouveau mot de passe depuis le lien du mail.
  const link = linkIn(forgot)
  check(Boolean(link), 'lien présent dans le mail')
  await page.goto(link)
  await page.getByLabel('Mot de passe', { exact: true }).fill(NEW_PASSWORD)
  await page.getByLabel('Confirmation').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Changer mon mot de passe' }).click()
  await page.waitForURL('**/profil')
  check(true, 'nouveau mot de passe enregistré')
  await visitor.clearCookies()

  await login(page, ANA_USER, OLD_PASSWORD)
  await page.getByText('Pseudo ou mot de passe incorrect').waitFor()
  check(true, 'connexion avec l’ancien mot de passe refusée')
  await login(page, ANA_USER, NEW_PASSWORD)
  await page.waitForURL((url) => !url.pathname.startsWith('/connexion'))
  check(true, 'connexion avec le nouveau mot de passe réussie')

  // 4. Ana invite Émile avec une adresse.
  await page.goto(`${base}/admin`)
  await page.getByLabel(`Adresse mail de ${EMILE.name} (facultatif)`).fill('emile@example.test')
  const row = page.locator('li').filter({ hasText: EMILE.name })
  await row.getByRole('button', { name: 'Inviter' }).click()
  const status = page.getByTestId('invite-mail-status')
  await status.waitFor()
  check((await status.innerText()).trim() === 'Invitation envoyée à e…@example.test', `admin : « ${(await status.innerText()).trim()} »`)
  check(await row.getByText('Invitation en attente').isVisible(), 'invitation en attente affichée')
  await row.screenshot({ path: `${outDir}/mail-admin-mobile.png` })
  console.log(`📸 ${outDir}/mail-admin-mobile.png`)
  await visitor.close()

  // 5. Émile crée son compte depuis le mail et retrouve son adresse.
  const emileContext = await browser.newContext(phone)
  const emile = await emileContext.newPage()
  emile.on('pageerror', (e) => errors.push(e.message))
  const invitation = await waitMail(emile.request, 'emile@example.test', 1)
  check(invitation.subject === 'Commander League — ton invitation', 'mail d’invitation reçu par Émile')
  await emile.goto(linkIn(invitation))
  await emile.getByLabel('Pseudo de connexion').fill('e2e-emile')
  await emile.getByLabel('Mot de passe', { exact: true }).fill(NEW_PASSWORD)
  await emile.getByLabel('Confirmation').fill(NEW_PASSWORD)
  await emile.getByRole('button', { name: 'Créer mon compte' }).click()
  await emile.waitForURL('**/profil')
  await emile.getByLabel('Adresse mail').waitFor()
  check((await emile.getByLabel('Adresse mail').inputValue()) === 'emile@example.test', 'Émile retrouve emile@example.test dans son profil')
  await emileContext.close()

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ' : ' + errors.join(' | ') : ''}`)
  console.log('\nTout est OK')
} finally {
  await browser.close()
  sql([restoreAnaSession])
}
