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
const USER_CONTENT = ['Ana', 'Bastien', 'Chloé', 'Damien', 'Émilie', 'Saison e2e']
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

await browser.close()
console.log(failures === 0 ? '\nTout est bon.' : `\n${failures} échec(s).`)
process.exit(failures === 0 ? 0 : 1)
