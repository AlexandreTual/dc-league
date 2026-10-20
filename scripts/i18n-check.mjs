// Vérifie le site en anglais : langue déduite du navigateur, sélecteur (interface et cartes réglées séparément),
// et aucune phrase française visible sur les pages déjà traduites.
// Usage : node scripts/i18n-check.mjs http://localhost:8788 <dossier-captures>
// Prérequis : seed-online.mjs appliqué (joueurs e2e-1… et leurs decks deck-e2e-…).
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const [base = 'http://localhost:8788', out = '/tmp/i18n-check'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
let failures = 0
function check(ok, label) {
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  if (!ok) failures++
}

/** Contexte avec la langue du navigateur, un joueur connecté et, au besoin, la langue d'interface déjà choisie. */
async function pageAs({ locale = 'en-US', player = null, uiLang = null, viewport = { width: 1280, height: 900 }, touch = false } = {}) {
  const context = await browser.newContext({ locale, viewport, hasTouch: touch, isMobile: touch })
  const cookies = []
  if (player) cookies.push({ name: 'dc_session', value: `jeton-de-test-${player}`, url: base })
  if (uiLang) cookies.push({ name: 'dc_lang', value: uiLang, url: base })
  if (cookies.length) await context.addCookies(cookies)
  return context.newPage()
}

/** Contenu des joueurs et des cartes, jamais traduit : exclu de la recherche de français. */
const USER_CONTENT = ['Ana', 'Bastien', 'Chloé', 'Damien', 'Émilie', 'Émile Mailcheck', 'ÉM', 'Saison e2e']
const FRENCH_WORDS = /\b(le|la|les|des|du|une|pour|avec|sur|dans|aux|est|ton|ta|tes|vos|votre|pas)\b/i
const ACCENTS = /[àâçéèêëîïôûùüÿœ]/i

/**
 * Lignes de texte visibles qui ressemblent à du français, hors contenu des joueurs (`[data-user-content]`), cartes
 * (`[data-card]`, images) et noms des comptes de test.
 */
async function frenchLines(page, selector = 'body') {
  const lines = await page.locator(selector).first().evaluate((root) => {
    const skip = (el) => el.closest('[data-user-content],[data-card],[data-card-id],script,style,noscript')
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const texts = []
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement
      if (!el || skip(el)) continue
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      const text = n.textContent.trim()
      if (text) texts.push(text)
    }
    return texts
  })
  return lines.filter((line) => {
    let rest = line
    for (const name of USER_CONTENT) rest = rest.replaceAll(name, '')
    return FRENCH_WORDS.test(rest) || ACCENTS.test(rest)
  })
}

async function noFrench(page, label, selector) {
  const found = await frenchLines(page, selector)
  check(found.length === 0, `${label} : aucun texte français${found.length ? ` (trouvé : ${found.slice(0, 5).map((l) => `« ${l} »`).join(', ')})` : ''}`)
}

/** Vrai si l'élément devient visible dans les 5 s. */
const appears = (locator) => locator.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false)

const barTexts = async (page) => (await page.locator('nav').first().locator('a').allInnerTexts()).map((t) => t.trim()).filter(Boolean)

// 1. Langue déduite du navigateur
{
  const en = await pageAs({ locale: 'en-US' })
  await en.goto(base + '/')
  check((await en.locator('html').getAttribute('lang')) === 'en', 'navigateur anglais : <html lang="en">')
  check(JSON.stringify(await barTexts(en)) === JSON.stringify(['Commander League', 'League', 'Rules', 'Log in']), `navigateur anglais : barre « ${(await barTexts(en)).join(' · ')} »`)
  await noFrench(en, 'barre du site (visiteur, anglais)', 'nav')
  await en.context().close()

  const de = await pageAs({ locale: 'de-DE' })
  await de.goto(base + '/')
  check((await de.locator('html').getAttribute('lang')) === 'en', 'navigateur allemand : anglais')
  await de.context().close()

  const fr = await pageAs({ locale: 'fr-FR' })
  await fr.goto(base + '/')
  check((await fr.locator('html').getAttribute('lang')) === 'fr', 'navigateur français : <html lang="fr">')
  check((await barTexts(fr)).includes('Ligue'), 'navigateur français : barre en français')
  await fr.context().close()
}

// 2. Sélecteur de la barre du site : l'interface change sans rechargement, le choix est retenu
{
  const page = await pageAs({ locale: 'fr-FR', player: 'e2e-2' })
  await page.goto(base + '/')
  await page.evaluate(() => { window.__notReloaded = true })
  await page.getByTestId('language-button').first().click()
  check(await page.getByTestId('language-menu').isVisible(), 'barre du site : la bulle de langue s’ouvre')
  check((await page.getByTestId('ui-lang-fr').getAttribute('aria-pressed')) === 'true', 'interface en français cochée')
  await page.screenshot({ path: `${out}/bulle-langue.png` })
  await page.getByTestId('ui-lang-en').click()
  await page.waitForFunction(() => document.documentElement.lang === 'en')
  check(await page.evaluate(() => window.__notReloaded === true), 'interface anglaise sans recharger la page')
  check(JSON.stringify(await barTexts(page)) === JSON.stringify(['Commander League', 'League', 'Play', 'My decks', 'Rules']), `joueur : barre « ${(await barTexts(page)).join(' · ')} »`)
  check((await page.getByTestId('card-lang-en').getAttribute('aria-pressed')) === 'true', 'langue des cartes jamais choisie : elle suit l’interface')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /account menu/ }).click()
  check(await page.getByRole('button', { name: 'Log out' }).isVisible(), 'menu du compte en anglais')
  await page.reload()
  check((await page.locator('html').getAttribute('lang')) === 'en', 'choix retenu après rechargement')
  await page.context().close()
}

// 3. Page d'un deck : interface anglaise et cartes françaises, puis l'inverse
{
  const page = await pageAs({ locale: 'en-US', player: 'e2e-1' })
  await page.goto(`${base}/decks/deck-e2e-1`)
  // Vue en liste : les noms des cartes y sont du texte (les visuels de test sont des images).
  await page.getByRole('button', { name: /^(Liste|List)$/ }).click()
  await page.locator('main').getByTestId('language-button').click()
  await page.getByTestId('card-lang-fr').click()
  await page.keyboard.press('Escape')
  check((await page.locator('html').getAttribute('lang')) === 'en', 'deck : interface toujours en anglais')
  check(await appears(page.getByText('Ange de Serra', { exact: true }).first()), 'deck : cartes en français avec l’interface anglaise')
  await page.screenshot({ path: `${out}/deck-interface-en-cartes-fr.png` })
  await page.locator('main').getByTestId('language-button').click()
  await page.getByTestId('ui-lang-fr').click()
  await page.getByTestId('card-lang-en').click()
  await page.waitForFunction(() => document.documentElement.lang === 'fr')
  check(await appears(page.getByText('Serra Angel', { exact: true }).first()), 'deck : cartes en anglais avec l’interface française')
  await page.context().close()
}

// 4. Mode test : sélecteur dans la barre de la table, les cartes changent tout de suite
{
  const page = await pageAs({ locale: 'en-US', player: 'e2e-1', uiLang: 'en' })
  await page.goto(`${base}/decks/deck-e2e-1/test`)
  await page.getByTestId('top-bar').waitFor()
  const button = page.getByTestId('top-bar').getByTestId('language-button')
  check(await button.isVisible(), 'mode test : sélecteur dans la barre de la table')
  await button.click()
  check(await page.getByTestId('language-menu').isVisible(), 'mode test : la bulle s’ouvre au-dessus de la table')
  await page.screenshot({ path: `${out}/table-bulle.png` })
  await page.getByTestId('card-lang-fr').click()
  check((await page.getByTestId('card-lang-fr').getAttribute('aria-pressed')) === 'true', 'mode test : cartes en français')
  check((await page.locator('html').getAttribute('lang')) === 'en', 'mode test : interface toujours en anglais')
  await page.context().close()
}

// 5. Tablette : la bulle tient dans l'écran
{
  const page = await pageAs({ locale: 'en-US', player: 'e2e-1', viewport: { width: 1024, height: 768 }, touch: true })
  await page.goto(`${base}/decks/deck-e2e-1/test`)
  await page.getByTestId('top-bar').waitFor()
  await page.getByTestId('top-bar').getByTestId('language-button').tap()
  const box = await page.getByTestId('language-menu').boundingBox()
  check(box && box.x >= 0 && box.x + box.width <= 1024, 'tablette : la bulle tient dans l’écran')
  const height = (await page.getByTestId('ui-lang-en').boundingBox())?.height ?? 0
  check(height >= 44, `tablette : boutons de 44 px (${Math.round(height)} px)`)
  await page.screenshot({ path: `${out}/tablette-bulle.png` })
  await page.context().close()
}

// 6. Pages traduites : aucun texte français visible avec l'interface anglaise
{
  const visitorPages = ['/', '/ligues', '/rules', '/connexion', '/mot-de-passe-oublie', '/invitation/jeton-inconnu', '/ligues/rejoindre/jeton-inconnu', '/page-inexistante']
  const playerPages = ['/', '/ligues', '/ligues/nouvelle', '/ligues/statistiques', '/ligues/league-e2e/classement', '/ligues/league-e2e/calendrier',
    '/ligues/league-e2e/playoffs', '/profil', '/profil/decks', '/decks/deck-e2e-1', '/salon']
  for (const [player, paths] of [[null, visitorPages], ['e2e-2', playerPages]]) {
    const page = await pageAs({ locale: 'en-US', player })
    for (const path of paths) {
      await page.goto(base + path)
      await page.waitForLoadState('networkidle')
      await noFrench(page, `${player ? 'joueur' : 'visiteur'} ${path}`)
      await page.screenshot({ path: `${out}/page-${player ?? 'visiteur'}${path.replaceAll('/', '_')}.png`, fullPage: true })
    }
    await page.context().close()
  }
}

// 7. Mode test en anglais : barre, fenêtres et menus, sans français (hors cartes)
{
  const page = await pageAs({ locale: 'en-US', player: 'e2e-1', uiLang: 'en' })
  page.on('dialog', (d) => d.accept(d.defaultValue()))
  await page.goto(`${base}/decks/deck-e2e-1/test`)
  await page.waitForSelector('[data-zone="hand"] [data-card-id]')
  check((await page.getByTestId('turn').innerText()) === 'Turn 1', 'mode test : « Turn 1 »')
  check(await page.getByRole('button', { name: 'Keep hand' }).isVisible(), 'mode test : « Keep hand »')
  await noFrench(page, 'mode test : table au départ')
  await page.getByRole('button', { name: 'Keep hand' }).click()
  // Une carte de la main sur le champ de bataille, par son menu.
  await page.locator('[data-zone="hand"] [data-card-id]').first().click({ button: 'right' })
  await page.getByRole('menu').waitFor()
  await noFrench(page, 'mode test : menu d’une carte en main', '[role="menu"]')
  await page.getByRole('menu').getByRole('menuitem', { name: /^Battlefield\b/ }).click()
  const onField = page.locator('[data-zone="battlefield"] [data-card-id]').first()
  await onField.waitFor()
  await onField.click({ button: 'right' })
  await page.getByRole('menu').waitFor()
  check(await page.getByRole('menu').getByRole('menuitem', { name: /^Tap\b/ }).isVisible(), 'menu d’une carte en jeu : « Tap »')
  await noFrench(page, 'mode test : menu d’une carte en jeu', '[role="menu"]')
  await page.getByRole('menu').getByRole('menuitem', { name: /^Tap\b/ }).click()
  await page.locator('[data-zone="library"]').click({ button: 'right' })
  await page.getByRole('menu').waitFor()
  check(await page.getByRole('menu').getByRole('menuitem', { name: /^Shuffle\b/ }).isVisible(), 'menu de la bibliothèque : « Shuffle »')
  await noFrench(page, 'mode test : menu de la bibliothèque', '[role="menu"]')
  await page.getByRole('menu').getByRole('menuitem', { name: /^Draw\ 1\b/ }).click()
  for (const [button, dialog] of [['Dice', 'Roll dice'], ['Token', 'Create a token'], ['Settings', 'Table settings']]) {
    await page.getByTestId('top-bar').getByRole('button', { name: button, exact: true }).click()
    const box = page.getByRole('dialog', { name: dialog })
    check(await appears(box), `mode test : fenêtre « ${dialog} »`)
    await noFrench(page, `mode test : fenêtre « ${dialog} »`, `[role="dialog"][aria-label="${dialog}"]`)
    await page.screenshot({ path: `${out}/table-${button}.png` })
    await page.keyboard.press('Escape')
    if (await box.isVisible()) await page.getByTestId('top-bar').getByRole('button', { name: button, exact: true }).click()
  }
  await page.getByTestId('top-bar').getByRole('button', { name: 'Game log', exact: true }).click()
  const log = await page.getByTestId('log').innerText()
  check(/Keeps their hand/.test(log) && /Shuffles|Draws 1 card/.test(log), `journal en anglais (« ${log.split('\n').slice(-3).join(' / ')} »)`)
  await noFrench(page, 'mode test : journal', '[data-testid="log"]')
  await page.screenshot({ path: `${out}/table-journal.png` })
  await noFrench(page, 'mode test : table après quelques actions')
  await page.context().close()
}

// 8. Partie en ligne : Ana en anglais, Bastien en français ; chacun lit sa langue
{
  const ana = await pageAs({ locale: 'en-US', player: 'e2e-1', uiLang: 'en' })
  const bastien = await pageAs({ locale: 'fr-FR', player: 'e2e-2', uiLang: 'fr' })
  for (const p of [ana, bastien]) p.on('dialog', (d) => d.accept(d.defaultValue()))
  await ana.goto(`${base}/salon`)
  check(await appears(ana.getByRole('heading', { name: 'Lobby' })), 'salon : « Lobby »')
  await noFrench(ana, 'salon (anglais)')
  await ana.getByRole('button', { name: 'Create table' }).click()
  await ana.waitForURL(/\/tables\//)
  const tableUrl = ana.url()
  await ana.getByTestId('deck-select').selectOption('deck-e2e-1')
  await bastien.goto(tableUrl)
  await bastien.getByRole('button', { name: 'Rejoindre la table' }).click()
  await bastien.getByTestId('deck-select').selectOption('deck-e2e-2')
  await ana.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent === 'Start the game' && !b.disabled), null, { timeout: 10_000 })
  await noFrench(ana, 'salle d’attente (anglais)')
  await ana.screenshot({ path: `${out}/en-ligne-attente.png` })
  await ana.getByRole('button', { name: 'Start the game' }).click()
  for (const p of [ana, bastien]) {
    await p.getByTestId('game').waitFor({ timeout: 10_000 })
    await p.getByTestId('start-draw').waitFor({ timeout: 10_000 })
  }
  check(await appears(ana.getByRole('dialog', { name: 'Who goes first?' })), 'tirage : « Who goes first? » chez Ana')
  check(await appears(bastien.getByRole('dialog', { name: 'Qui commence ?' })), 'tirage : « Qui commence ? » chez Bastien')
  for (const p of [ana, bastien]) {
    await p.keyboard.press('Escape')
    await p.getByTestId('start-draw').waitFor({ state: 'detached' })
  }
  await ana.getByRole('button', { name: 'Keep hand' }).click()
  await bastien.getByRole('button', { name: 'Garder' }).click()
  await ana.waitForTimeout(1000)
  await noFrench(ana, 'partie en ligne (anglais)')
  await ana.screenshot({ path: `${out}/en-ligne-ana.png` })
  for (const [p, label, re] of [[ana, 'Game log', /Keeps their hand/], [bastien, 'Journal', /Garde sa main/]]) {
    await p.getByTestId('top-bar').getByRole('button', { name: label, exact: true }).click()
    const text = await p.getByTestId('log').innerText()
    check(re.test(text), `journal en ligne dans la langue de chacun (${label})`)
  }
  await noFrench(ana, 'journal en ligne (anglais)', '[data-testid="log"]')
  await ana.context().close()
  await bastien.context().close()
}

// 9. Administration (e2e-1 admin)
{
  const page = await pageAs({ locale: 'en-US', player: 'e2e-1', uiLang: 'en' })
  for (const path of ['/admin', '/ligues/league-e2e/gerer']) {
    await page.goto(base + path)
    await page.waitForLoadState('networkidle')
    await noFrench(page, `admin ${path}`)
    await page.screenshot({ path: `${out}/admin${path.replaceAll('/', '_')}.png`, fullPage: true })
  }
  const res = await page.request.post(`${base}/api/leagues`, { data: {} })
  const body = await res.json().catch(() => ({}))
  check(typeof body.error === 'string' && !ACCENTS.test(body.error) && !FRENCH_WORDS.test(body.error), `erreur d’une route en anglais (« ${body.error} »)`)
  await page.context().close()
}

await browser.close()
console.log(failures === 0 ? '\nTout est bon.' : `\n${failures} échec(s).`)
process.exit(failures === 0 ? 0 : 1)
