// « Donner une capacité… » dans de vrais navigateurs : mode test à la souris (fenêtre « Capacités », symboles puis
// libellés, durée jusqu'à la fin du tour, vol donné ou perdu, aperçu, journal), tablette (appui long, 1180 × 820),
// puis partie en ligne à 2 (une capacité donnée par un adversaire).
// Prérequis : ceux de scripts/online-check.mjs (Worker, site, données de seed-online.mjs : Llanowar Elves, Ange de Serra volant).
// Usage : node scripts/abilities-check.mjs <url-de-base> <dossier-captures>
import { chromium } from 'playwright-core'
import { PLAYERS, tokenOf } from './seed-online.mjs'

const [base = 'http://localhost:8788', outDir = '.'] = process.argv.slice(2)
const executablePath = process.env.CHROME ?? process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [ANA, BASTIEN] = PLAYERS
const ELVES = 'Llanowar Elves'
const ANGEL = 'Ange de Serra'

const browser = await chromium.launch({ executablePath })
const errors = []

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

async function openAs(player, { viewport = { width: 1280, height: 900 }, mobile = false } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile })
  await context.addCookies([{ name: 'dc_session', value: tokenOf(player.id), url: base }])
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`${player.name} : ${e.message}`))
  page.on('dialog', (d) => d.accept(d.defaultValue()))
  return { ...player, page }
}

let shot = 0
async function capture(page, label) {
  shot++
  await page.waitForTimeout(300)
  const path = `${outDir}/abilities-${shot}-${label}.png`
  await page.screenshot({ path })
  console.log(`📸 ${path}`)
}

/** Carte du joueur mise sur son champ de bataille, à la position donnée (en %) : depuis sa main, sinon sa bibliothèque. */
async function onBattlefield(who, name, solo = false) {
  const { page } = who
  const me = solo ? await page.locator('[data-zone="hand"][data-player]').first().getAttribute('data-player') : who.id
  const inHand = page.locator(`[data-zone="hand"][data-player="${me}"] [data-card-id]:has([title="${name}"])`).first()
  let id
  if (await inHand.count()) {
    id = await inHand.getAttribute('data-card-id')
    await inHand.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Champ de bataille' }).click()
  } else {
    await page.locator(`[data-zone="library"][data-player="${me}"]`).click({ button: 'right' })
    await page.getByRole('menuitem', { name: /Chercher une carte/ }).click()
    const pileCard = page.locator(`[data-pile-card]:has([title="${name}"])`).first()
    id = await pileCard.getAttribute('data-pile-card')
    await pileCard.getByRole('button', { name: 'Champ', exact: true }).click()
    await page.getByRole('button', { name: 'Fermer', exact: true }).click()
  }
  const card = `[data-zone="battlefield"][data-player="${me}"] [data-card-id="${id}"]`
  await page.locator(card).waitFor()
  return card
}

async function playtest(who) {
  await who.page.goto(`${base}/decks/deck-${who.id}`)
  await who.page.evaluate((id) => {
    localStorage.removeItem(`dc-playtest-${id}`)
    localStorage.removeItem('dc-table-settings')
  }, `deck-${who.id}`)
  await who.page.goto(`${base}/decks/deck-${who.id}/test`)
  await who.page.waitForSelector('[data-zone="hand"] [data-card-id]', { timeout: 15_000 })
}

/** Capacités affichées sur une carte : [mot-clé, état] (gained, eot, lost) et style (icons, labels). */
const badgesOf = (locator) => locator.evaluate((el) => ({
  style: el.querySelector('[data-abilities]')?.getAttribute('data-abilities') ?? null,
  badges: [...el.querySelectorAll('[data-ability]')].map((b) => [b.getAttribute('data-ability'), b.getAttribute('data-ability-state')]),
}))
const flying = (locator) => locator.evaluate((el) => !!el.querySelector('.card-lift'))

/** Ouvre la fenêtre « Capacités » depuis le menu de la carte (clic droit). */
async function openAbilities(page, card) {
  await page.locator(card).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Donner une capacité…' }).click()
  const dialog = page.getByRole('dialog', { name: /^Capacités : / })
  await dialog.waitFor()
  return dialog
}

/** Coche ou décoche des capacités, choisit la durée, valide. */
async function give(dialog, { check: on = [], uncheck: off = [], endOfTurn = false }) {
  for (const label of on) await dialog.getByRole('checkbox', { name: new RegExp(`^${label}`) }).check()
  for (const label of off) await dialog.getByRole('checkbox', { name: new RegExp(`^${label}`) }).uncheck()
  if (endOfTurn) await dialog.getByRole('radio', { name: 'Jusqu’à la fin du tour' }).check()
  await dialog.getByRole('button', { name: 'Valider' }).click()
  await dialog.waitFor({ state: 'detached' })
}

async function logText(page) {
  await page.getByRole('button', { name: /Journal/ }).click()
  const text = await page.getByTestId('log').innerText()
  await page.getByRole('button', { name: 'Fermer le journal' }).click()
  return text
}

try {
  // ── Mode test, à la souris ──
  const solo = await openAs(ANA)
  const { page } = solo
  await playtest(solo)
  const elves = await onBattlefield(solo, ELVES, true)
  const dialog = await openAbilities(page, elves)
  check(await dialog.getByRole('checkbox').count() === 43, 'fenêtre « Capacités » : 43 capacités à cocher, en 4 groupes')
  check(!(await dialog.getByRole('checkbox', { name: /^Vol/ }).isChecked()), 'Llanowar Elves : rien de coché (aucune capacité imprimée)')
  check(await dialog.getByRole('radio', { name: 'Tout le temps' }).isChecked(), 'durée par défaut : tout le temps')
  await capture(page, 'fenetre')
  await give(dialog, { check: ['Piétinement', 'Célérité'] })
  let shown = await badgesOf(page.locator(elves))
  check(shown.style === 'icons' && JSON.stringify(shown.badges) === JSON.stringify([['Trample', 'gained'], ['Haste', 'gained']]),
    'Piétinement et Célérité données : deux symboles sur la carte')
  check((await logText(page)).includes('donne Piétinement et Célérité à Llanowar Elves'), 'journal : « donne Piétinement et Célérité à Llanowar Elves »')

  await page.locator(elves).hover()
  const preview = page.getByTestId('preview-abilities')
  await preview.waitFor()
  check((await preview.innerText()).includes('Capacités données : Piétinement, Célérité'), 'aperçu au survol : capacités en toutes lettres')
  await capture(page, 'symboles')
  await page.mouse.move(5, 5)

  const again = await openAbilities(page, elves)
  check(await again.getByRole('checkbox', { name: /^Piétinement/ }).isChecked(), 'fenêtre rouverte : capacités données cochées')
  await give(again, { check: ['Contact mortel'], endOfTurn: true })
  shown = await badgesOf(page.locator(elves))
  check(shown.badges.some(([k, s]) => k === 'Deathtouch' && s === 'eot'), 'Contact mortel jusqu’à la fin du tour : symbole en pointillés')
  await page.getByRole('button', { name: /Fin de tour/ }).click()
  await page.waitForFunction((sel) => !document.querySelector(`${sel} [data-ability="Deathtouch"]`), elves)
  shown = await badgesOf(page.locator(elves))
  check(shown.badges.length === 2, 'fin du tour : Contact mortel retiré, Piétinement et Célérité restent')

  await give(await openAbilities(page, elves), { check: ['Vol'] })
  check(await flying(page.locator(elves)) && !(await badgesOf(page.locator(elves))).badges.some(([k]) => k === 'Flying'), 'vol donné : la carte flotte, sans symbole')

  // Capacités à paramètre : Protection (couleurs) et Parade (coût).
  const prot = await openAbilities(page, elves)
  await prot.getByRole('checkbox', { name: /^Protection/ }).check()
  check(await prot.getByRole('button', { name: 'Valider' }).isDisabled(), 'Protection sans couleur : « Valider » grisé')
  const colors = prot.getByRole('group', { name: 'Protection contre' })
  await colors.getByRole('button', { name: /rouge/ }).click()
  await colors.getByRole('button', { name: /vert/ }).click()
  await prot.getByRole('checkbox', { name: /^Parade/ }).check()
  check((await prot.getByLabel('Coût de la Parade').inputValue()) === '{2}', 'Parade : coût {2} proposé')
  await capture(page, 'protection-parade')
  await prot.getByRole('button', { name: 'Valider' }).click()
  await prot.waitFor({ state: 'detached' })
  const params = await page.locator(`${elves} [data-ability-param]`).evaluateAll((els) => els.map((e) => [e.getAttribute('data-ability'), e.getAttribute('data-ability-param')]))
  check(JSON.stringify(params) === JSON.stringify([['Protection', 'R,G'], ['Ward', '{2}']]), 'Protection rouge et vert, Parade {2} : symboles avec leur précision')
  check((await logText(page)).includes('donne Protection contre le rouge et le vert et Parade {2} à Llanowar Elves'), 'journal : « donne Protection contre le rouge et le vert et Parade {2} »')
  const change = await openAbilities(page, elves)
  await change.getByRole('group', { name: 'Protection contre' }).getByRole('button', { name: 'Tout' }).click()
  await give(change, {})
  check((await page.locator(`${elves} [data-ability="Protection"]`).getAttribute('data-ability-param')) === 'all', 'Protection changée : contre tout')
  check((await logText(page)).includes('change Protection de Llanowar Elves : contre tout'), 'journal : « change Protection de Llanowar Elves : contre tout »')

  // Capacité chiffrée (Annihilateur) : nombre proposé, valeur invalide refusée.
  const annihil = await openAbilities(page, elves)
  await annihil.getByRole('checkbox', { name: /^Annihilateur/ }).check()
  const value = annihil.getByLabel('Valeur de Annihilateur')
  check((await value.inputValue()) === '2', 'Annihilateur : 2 proposé')
  await value.fill('0')
  check(await annihil.getByRole('button', { name: 'Valider' }).isDisabled(), 'Annihilateur 0 : « Valider » grisé')
  await annihil.getByRole('button', { name: '3', exact: true }).click()
  await annihil.getByRole('button', { name: 'Règle : Annihilateur' }).click()
  check((await annihil.getByTestId('ability-rule').innerText()).includes('le joueur défenseur sacrifie 3 permanents'),
    'bouton « i » : texte des règles d’Annihilateur, avec sa valeur')
  await annihil.getByRole('button', { name: 'Règle : Distorsion' }).click()
  check((await annihil.getByTestId('ability-rule').innerText()).includes('créatures avec la distorsion'), 'autre bouton « i » : une seule règle dépliée à la fois')
  await capture(page, 'annihilateur-regle')
  await give(annihil, {})
  check((await page.locator(`${elves} [data-ability="Annihilator"]`).getAttribute('data-ability-param')) === '3', 'Annihilateur 3 : symbole avec son nombre')
  check((await logText(page)).includes('donne Annihilateur 3 à Llanowar Elves'), 'journal : « donne Annihilateur 3 à Llanowar Elves »')

  const angel = await onBattlefield(solo, ANGEL, true)
  check(await flying(page.locator(angel)), 'Ange de Serra : vole (imprimé)')
  const angelDialog = await openAbilities(page, angel)
  check((await angelDialog.innerText()).includes('(imprimée)') && await angelDialog.getByRole('checkbox', { name: /^Vol/ }).isChecked(),
    'Ange : Vol et Vigilance cochés, marqués « (imprimée) »')
  await give(angelDialog, { uncheck: ['Vol'] })
  check(!(await flying(page.locator(angel))), 'vol imprimé retiré : l’Ange ne flotte plus')
  check(JSON.stringify((await badgesOf(page.locator(angel))).badges) === JSON.stringify([['Flying', 'lost']]), 'vol perdu : symbole rouge barré')
  check((await logText(page)).includes('retire Vol à Ange de Serra'), 'journal : « retire Vol à Ange de Serra »')

  await page.getByRole('button', { name: 'Réglages' }).click()
  await page.getByRole('dialog', { name: 'Réglages de la table' }).getByLabel('Capacités sur les cartes').selectOption('labels')
  await page.getByRole('button', { name: 'Fermer les réglages' }).click()
  shown = await badgesOf(page.locator(elves))
  check(shown.style === 'labels' && (await page.locator(`${elves} [data-ability="Trample"]`).innerText()).toLowerCase().includes('piétinement'),
    'réglage « Libellés » : capacités écrites sur la carte')
  check((await page.locator(`${elves} [data-ability="Annihilator"]`).innerText()).includes('Annihilateur 3'), 'réglage « Libellés » : « Annihilateur 3 » écrit')
  await capture(page, 'libelles')

  await page.getByRole('button', { name: 'Réglages' }).click()
  await page.getByRole('dialog', { name: 'Réglages de la table' }).getByLabel('Animations des cartes').uncheck()
  await page.getByRole('button', { name: 'Fermer les réglages' }).click()
  check((await badgesOf(page.locator(elves))).badges.length === 5, 'animations coupées : les capacités restent affichées')

  // L'Ange, posé au même endroit, recouvre les Elfes : au cimetière d'abord.
  await page.locator(angel).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Cimetière' }).click()
  await page.locator(angel).waitFor({ state: 'detached' })
  await page.locator(elves).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Main' }).click()
  const back = await onBattlefield(solo, ELVES, true)
  check((await badgesOf(page.locator(back))).badges.length === 0, 'renvoyée en main puis rejouée : plus aucune capacité donnée')

  // ── Tablette : appui long, fenêtre dans l'écran ──
  const tablet = await openAs(ANA, { viewport: { width: 1180, height: 820 }, mobile: true })
  await playtest(tablet)
  const tabletElves = await onBattlefield(tablet, ELVES, true)
  const cdp = await tablet.page.context().newCDPSession(tablet.page)
  const box = await tablet.page.locator(tabletElves).boundingBox()
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
  await tablet.page.waitForTimeout(700)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await tablet.page.getByRole('menuitem', { name: 'Donner une capacité…' }).tap()
  const tabletDialog = tablet.page.getByRole('dialog', { name: /^Capacités : / })
  await tabletDialog.waitFor()
  const dialogBox = await tabletDialog.boundingBox()
  check(dialogBox.y >= 0 && dialogBox.y + dialogBox.height <= 820, `tablette : fenêtre dans l’écran (${Math.round(dialogBox.height)} px de haut)`)
  const row = await tabletDialog.locator('label').first().boundingBox()
  check(row.height >= 36, `tablette : lignes assez hautes pour le doigt (${Math.round(row.height)} px)`)
  await tabletDialog.getByRole('checkbox', { name: /^Menace/ }).tap()
  await tabletDialog.getByRole('button', { name: 'Valider' }).tap()
  await tablet.page.locator(`${tabletElves} [data-ability="Menace"]`).waitFor()
  check(true, 'tablette : Menace donnée au doigt')
  await capture(tablet.page, 'tablette')

  // ── En ligne, à 2 : Bastien donne une capacité à la créature d'Ana ──
  const ana = await openAs(ANA)
  const bastien = await openAs(BASTIEN)
  await ana.page.goto(`${base}/salon`)
  await ana.page.getByRole('combobox').nth(1).selectOption('2')
  await ana.page.getByRole('button', { name: 'Créer la table' }).click()
  await ana.page.waitForURL(/\/tables\//)
  const tableUrl = ana.page.url()
  for (const who of [ana, bastien]) {
    if (who === bastien) {
      await bastien.page.goto(tableUrl)
      await bastien.page.getByRole('button', { name: 'Rejoindre la table' }).click()
    }
    await who.page.getByTestId('deck-select').selectOption(`deck-${who.id}`)
    await who.page.locator(`[data-seat="${who.id}"]`).getByText(`Kenrith de ${who.name}`).waitFor()
  }
  await ana.page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent === 'Démarrer la partie')
    return b && !b.disabled
  }, null, { timeout: 10_000 })
  await ana.page.getByRole('button', { name: 'Démarrer la partie' }).click()
  for (const who of [ana, bastien]) {
    await who.page.getByTestId('game').waitFor({ timeout: 10_000 })
    await who.page.getByTestId('start-draw').waitFor()
    await who.page.keyboard.press('Escape')
    await who.page.getByTestId('start-draw').waitFor({ state: 'detached' })
  }
  const anaElves = await onBattlefield(ana, ELVES)
  const elvesId = await ana.page.locator(anaElves).getAttribute('data-card-id')
  const forBastien = `[data-zone="battlefield"][data-player="${ANA.id}"] [data-card-id="${elvesId}"], [data-zone="battlefield"][data-player="${ANA.id}"] [data-strip-card="${elvesId}"]`
  await bastien.page.locator(forBastien).waitFor()
  await give(await openAbilities(bastien.page, forBastien), { check: ['Lien de vie'] })
  await ana.page.locator(`${anaElves} [data-ability="Lifelink"]`).waitFor({ timeout: 10_000 })
  check(true, 'en ligne : Bastien donne Lien de vie aux Elfes d’Ana, Ana voit le symbole')
  check((await logText(ana.page)).includes('donne Lien de vie à Llanowar Elves'), 'en ligne : journal chez Ana')
  await capture(ana.page, 'en-ligne-ana')

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` : ${errors.join(' | ')}` : ''}`)
} finally {
  await browser.close()
}
