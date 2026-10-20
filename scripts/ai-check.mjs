// Assistant IA de bout en bout dans de vrais navigateurs, avec un faux Gemini (scripts/fake-gemini.mjs, lancé ici).
// Prérequis : seed-online.mjs appliqué ; Worker de jeu (`npm run game:dev`) et site (`wrangler pages dev --port 8788`)
// lancés avec, dans `.dev.vars` : GEMINI_API_KEY=test et GEMINI_BASE_URL=http://localhost:8790.
// Le script remet à zéro le compteur de questions et l'interrupteur admin, et rend e2e-1 admin.
// Usage : node scripts/ai-check.mjs <url-de-base> <dossier-captures>
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright-core'
import { PLAYERS, tokenOf } from './seed-online.mjs'
import { startFakeGemini } from './fake-gemini.mjs'

const [base = 'http://localhost:8788', outDir = '.'] = process.argv.slice(2)
const executablePath = process.env.CHROME ?? process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [ANA, BASTIEN, CHLOE] = PLAYERS
const AI = 'Ajouter à la question IA'

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

function sql(command) {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'dc-league', '--local', '--command', command], { stdio: 'ignore' })
}

sql(`DELETE FROM ai_usage; DELETE FROM site_settings; UPDATE users SET is_admin = 1 WHERE id = 'u-${ANA.id}'`)
const gemini = await startFakeGemini()
const browser = await chromium.launch({ executablePath })
const errors = []
const browserRequests = []

async function openAs(player, options = {}) {
  const context = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 900 }, ...options })
  if (player) await context.addCookies([{ name: 'dc_session', value: tokenOf(player.id), url: base }])
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`${player?.name ?? 'visiteur'} : ${e.message}`))
  page.on('dialog', (d) => d.accept(d.defaultValue()))
  page.on('request', (r) => browserRequests.push(`${r.url()} ${JSON.stringify(r.headers())} ${r.postData() ?? ''}`))
  return { ...player, page }
}

let shot = 0
async function capture(page, label) {
  shot++
  await page.waitForTimeout(300)
  const path = `${outDir}/ia-${shot}-${label}.png`
  await page.screenshot({ path })
  console.log(`📸 ${path}`)
}

const chips = (page) => page.getByTestId('ai-cards').locator('li')
const remaining = (page) => page.getByTestId('ai-remaining').innerText()
async function closePanel(page) {
  await page.getByTestId('ai-panel').getByRole('button', { name: 'Fermer', exact: true }).click()
  await page.getByTestId('ai-panel').waitFor({ state: 'detached' })
}

try {
  // ── Visiteur : rien ──
  const visitor = await openAs(null)
  await visitor.page.goto(`${base}/decks/deck-${ANA.id}`)
  await visitor.page.waitForTimeout(1500)
  check((await visitor.page.getByRole('button', { name: 'Assistant IA' }).count()) === 0, 'visiteur : pas de bouton « Assistant IA »')
  await visitor.page.context().close()

  // ── Page du deck : Oracle → Demander à l'IA ──
  const ana = await openAs(ANA)
  const p = ana.page
  await p.goto(`${base}/decks/deck-${ANA.id}`)
  await p.getByRole('button', { name: 'Assistant IA' }).waitFor()
  check(true, 'joueur : bouton « Assistant IA » sur la page du deck')
  await p.locator('[data-deck-card]').first().locator('button').first().click({ button: 'right' })
  await p.getByRole('button', { name: 'Demander à l’IA' }).click()
  await p.getByTestId('ai-panel').waitFor()
  check((await p.getByRole('dialog', { name: 'Oracle et règles' }).count()) === 0, 'deck : la fiche Oracle se ferme')
  check((await chips(p).count()) === 1, 'deck : la carte est dans la question')
  check((await remaining(p)).includes('20 questions'), 'deck : 20 questions restantes')
  await p.getByRole('button', { name: 'Explique cette carte' }).click()
  check(await p.getByText('L’IA réfléchit…').isVisible(), 'deck : « L’IA réfléchit… » pendant l’attente')
  await p.getByTestId('ai-answer').waitFor()
  const answer = p.getByTestId('ai-answer').first()
  check((await answer.innerText()).includes('Réponse de test pour : Explique cette carte'), 'deck : réponse affichée')
  check((await answer.locator('li').count()) === 2 && (await answer.locator('strong').count()) === 1, 'deck : liste et gras rendus')
  check((await answer.locator('b').count()) === 0 && (await answer.innerText()).includes('<b>'), 'deck : HTML de la réponse jamais interprété')
  check((await answer.locator('a[href*="gatherer.wizards.com"]').count()) === 1, 'deck : lien Gatherer sous la réponse')
  check((await remaining(p)).includes('19 questions'), 'deck : 19 questions restantes')
  const sent = gemini.requests.at(-1)
  check(sent.key === 'test' && sent.url.includes(':generateContent'), 'serveur : clé envoyée à Gemini dans l’en-tête')
  check(JSON.stringify(sent.body.contents).includes('Texte Oracle'), 'serveur : texte Oracle joint à la question')

  await p.getByLabel('Ta question').fill('Et avec un contre-sort ?')
  await p.keyboard.press('Enter')
  await p.getByTestId('ai-answer').nth(1).waitFor()
  check((await p.getByTestId('ai-answer').nth(1).innerText()).includes('contre-sort'), 'deck : deuxième question dans le même chat')
  check(gemini.requests.at(-1).body.contents.length === 3, 'serveur : historique renvoyé (question, réponse, question)')

  await p.getByLabel('Ta question').fill('Erreur #quota')
  await p.keyboard.press('Enter')
  await p.getByTestId('ai-error').waitFor()
  check((await p.getByTestId('ai-error').innerText()).includes('ne répond pas'), 'erreur Google : message en français')
  check((await p.getByLabel('Ta question').inputValue()) === 'Erreur #quota', 'erreur Google : la question reste dans la saisie')
  check((await remaining(p)).includes('18 questions'), 'erreur Google : la question n’est pas décomptée')
  await capture(p, 'deck')
  await closePanel(p)
  await p.getByRole('button', { name: 'Assistant IA' }).click()
  check((await p.getByTestId('ai-answer').count()) === 2, 'deck : fermer puis rouvrir garde la conversation')
  await p.getByRole('button', { name: 'Nouvelle question' }).click()
  check((await p.getByTestId('ai-answer').count()) === 0 && (await chips(p).count()) === 1, '« Nouvelle question » vide le fil et garde les cartes')

  // ── Mode test : menu d'une carte en main ──
  await p.goto(`${base}/decks/deck-${ANA.id}/test`)
  const hand = p.locator('[data-zone="hand"] [data-card-id]')
  await hand.first().waitFor()
  await p.waitForTimeout(800)
  await hand.first().click({ button: 'right' })
  await p.getByRole('menuitem', { name: AI }).click()
  await p.getByTestId('ai-panel').waitFor()
  check((await chips(p).count()) === 1, 'mode test : « Ajouter à la question IA » ouvre le panneau avec la carte')
  const handSize = await hand.count()
  await p.getByLabel('Ta question').pressSequentially('dnd')
  check((await hand.count()) === handSize, 'mode test : taper dans le chat ne déclenche pas les raccourcis (D : piocher)')
  await capture(p, 'mode-test')
  await p.context().close()

  // ── Partie en ligne en Duel : carte adverse visible, puis face cachée ──
  const anaOnline = await openAs(ANA)
  // Bastien sur tablette : le menu d'une carte en jeu (appui long, avec l'image) dépasse la hauteur de l'écran.
  const bastien = await openAs(BASTIEN, { viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true })
  const chooseDeck = async (who) => {
    await who.page.getByTestId('deck-select').selectOption(`deck-${who.id}`)
    await who.page.locator(`[data-seat="${who.id}"]`).getByText(`Kenrith de ${who.name}`).waitFor()
  }
  await anaOnline.page.goto(`${base}/salon`)
  await anaOnline.page.getByRole('combobox').first().selectOption('duel')
  await anaOnline.page.getByRole('button', { name: 'Créer la table' }).click()
  await anaOnline.page.waitForURL(/\/tables\//)
  const tableUrl = anaOnline.page.url()
  await chooseDeck(anaOnline)
  await bastien.page.goto(tableUrl)
  await bastien.page.getByRole('button', { name: 'Rejoindre la table' }).click()
  await chooseDeck(bastien)
  await anaOnline.page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent === 'Démarrer la partie')
    return b && !b.disabled
  }, null, { timeout: 10_000 })
  await anaOnline.page.getByRole('button', { name: 'Démarrer la partie' }).click()
  const myHand = (who) => who.page.locator(`[data-board="${who.id}"] [data-zone="hand"] [data-card-id]`)
  for (const who of [anaOnline, bastien]) {
    await myHand(who).first().waitFor({ timeout: 10_000 })
    await who.page.getByTestId('start-draw').waitFor({ timeout: 10_000 })
    await who.page.keyboard.press('Escape')
    await who.page.getByTestId('start-draw').waitFor({ state: 'detached' })
    await who.page.getByRole('button', { name: 'Garder' }).click()
  }
  await myHand(bastien).first().dblclick()
  const bastienField = (who) => who.page.locator(`[data-board="${BASTIEN.id}"] [data-zone="battlefield"] [data-card-id]`)
  await bastienField(anaOnline).first().waitFor({ timeout: 10_000 })
  await bastienField(anaOnline).first().click({ button: 'right' })
  await anaOnline.page.getByRole('menuitem', { name: AI }).click()
  await anaOnline.page.getByTestId('ai-panel').waitFor()
  check((await chips(anaOnline.page).count()) === 1, 'en ligne : Ana ajoute une carte visible de Bastien')
  // Les decks de test se ressemblent : on ajoute des cartes d'Ana jusqu'à en avoir une autre que celle de Bastien.
  const handCards = await myHand(anaOnline).count()
  for (let i = 0; i < handCards && (await chips(anaOnline.page).count()) < 2; i++) {
    await closePanel(anaOnline.page)
    await myHand(anaOnline).nth(i).click({ button: 'right' })
    await anaOnline.page.getByRole('menuitem', { name: AI }).click()
  }
  check((await chips(anaOnline.page).count()) === 2, 'en ligne : une carte d’Ana s’ajoute (même carte jamais en double)')
  await anaOnline.page.getByRole('button', { name: 'Comment ces cartes interagissent-elles ?' }).click()
  await anaOnline.page.getByTestId('ai-answer').waitFor()
  check(true, 'en ligne : question sur l’interaction d’une carte adverse et d’une des siennes')
  await capture(anaOnline.page, 'en-ligne')
  await closePanel(anaOnline.page)

  // Appui long sur sa propre carte en jeu : « Ajouter à la question IA » visible sans faire défiler le menu.
  const cdp = await bastien.page.context().newCDPSession(bastien.page)
  const fieldBox = await bastienField(bastien).first().boundingBox()
  const point = { x: fieldBox.x + fieldBox.width / 2, y: fieldBox.y + fieldBox.height / 2 }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
  await bastien.page.waitForTimeout(700)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  const touchMenu = bastien.page.getByRole('menu')
  await touchMenu.getByTestId('menu-preview').waitFor()
  const menuBox = await touchMenu.boundingBox()
  const aiBox = await touchMenu.getByRole('menuitem', { name: AI }).boundingBox()
  check(aiBox.y >= menuBox.y && aiBox.y + aiBox.height <= Math.min(menuBox.y + menuBox.height, 820),
    'tablette en ligne : « Ajouter à la question IA » visible sans défiler sur une carte en jeu')
  await capture(bastien.page, 'tablette-menu')
  await bastien.page.waitForTimeout(400) // le toucher qui suit de peu un appui long est ignoré (touch.ts)
  await touchMenu.getByRole('menuitem', { name: AI }).tap()
  await bastien.page.getByTestId('ai-panel').waitFor()
  check((await chips(bastien.page).count()) === 1, 'tablette en ligne : la carte en jeu est ajoutée à la question')
  await closePanel(bastien.page)

  await bastienField(bastien).first().click({ button: 'right' })
  await bastien.page.getByRole('menuitem', { name: 'Face cachée', exact: true }).click()
  await anaOnline.page.waitForTimeout(1000)
  // Chez l'adversaire, une carte face cachée n'est qu'un compteur dans les rangées : aucune carte à viser, donc aucun
  // menu ni « Ajouter à la question IA » (le menu lui-même est couvert par lib/game/menus.test.ts).
  check((await bastienField(anaOnline).count()) === 0, 'en ligne : la carte face cachée de Bastien ne peut pas être ajoutée')
  await anaOnline.page.context().close()
  await bastien.page.context().close()

  // ── Interrupteur admin et utilisation du jour ──
  const admin = await openAs(ANA)
  const chloe = await openAs(CHLOE)
  await admin.page.goto(`${base}/admin`)
  const section = admin.page.getByTestId('ai-admin')
  check((await section.getByTestId('ai-admin-state').innerText()) === 'Activé', 'admin : assistant « Activé »')
  check((await section.getByTestId('ai-admin-usage').innerText()).includes('3 questions par 1 joueur'), 'admin : utilisation du jour (3 questions par 1 joueur)')
  await section.getByRole('button', { name: 'Désactiver', exact: true }).click()
  await section.getByRole('button', { name: 'Activer', exact: true }).waitFor()
  check((await section.getByTestId('ai-admin-state').innerText()) === 'Désactivé', 'admin : assistant « Désactivé »')
  await capture(admin.page, 'admin')
  await chloe.page.goto(`${base}/decks/deck-${CHLOE.id}`)
  await chloe.page.waitForTimeout(1500)
  check((await chloe.page.getByRole('button', { name: 'Assistant IA' }).count()) === 0, 'coupé : plus de bouton pour les joueurs')
  const refused = await chloe.page.evaluate(async () => (await fetch('/api/ai/ask', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oracleIds: ['e2e-teferi'], messages: [{ role: 'user', text: 'Q' }] }),
  })).status)
  check(refused === 503, 'coupé : question refusée par le serveur')
  await section.getByRole('button', { name: 'Activer', exact: true }).click()
  await section.getByRole('button', { name: 'Désactiver', exact: true }).waitFor()
  await admin.page.context().close()

  // ── Quota atteint, téléphone ──
  const parisDay = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  sql(`INSERT OR REPLACE INTO ai_usage (user_id, day, count) VALUES ('u-${CHLOE.id}', '${parisDay}', 20)`)
  const phone = await openAs(CHLOE, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await phone.page.goto(`${base}/decks/deck-${CHLOE.id}`)
  await phone.page.getByRole('button', { name: 'Assistant IA' }).click()
  const box = await phone.page.getByTestId('ai-panel').boundingBox()
  check(box.width === 390 && box.height >= 840, 'téléphone : panneau en plein écran')
  check((await remaining(phone.page)).includes('Plus de questions') && await phone.page.getByLabel('Ta question').isDisabled(),
    'quota atteint : saisie désactivée et message « Plus de questions »')
  await capture(phone.page, 'telephone')
  await phone.page.context().close()
  await chloe.page.context().close()

  check(!browserRequests.some((r) => r.includes('x-goog-api-key') || r.includes('generativelanguage') || r.includes(':8790')),
    'la clé et Gemini ne passent jamais par le navigateur')
  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ' : ' + errors.join(' | ') : ''}`)
  console.log('\nTout est OK')
} finally {
  await browser.close()
  await gemini.close()
}
