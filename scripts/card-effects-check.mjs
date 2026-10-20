// Effets des cartes en jeu, dans de vrais navigateurs : liseré doré et éclat d'arrivée des permanents légendaires,
// entrée du commandant (halo, ondes, couronne), retour du cimetière (tombe qui se brise), flottement des créatures volantes ; mode test à la souris (fenêtre « Animations » : tout, ou une animation à la fois), mouvement réduit,
// tablette (1180 × 820, tactile), puis partie en ligne à 2.
// Prérequis : ceux de scripts/online-check.mjs (Worker, site, données de seed-online.mjs : Teferi légendaire,
// Anneau solaire, Ange de Serra volant, jeton Esprit volant, commandant Kenrith).
// Usage : node scripts/card-effects-check.mjs <url-de-base> <dossier-captures>
import { chromium } from 'playwright-core'
import { PLAYERS, tokenOf } from './seed-online.mjs'

const [base = 'http://localhost:8788', outDir = '.'] = process.argv.slice(2)
const executablePath = process.env.CHROME ?? process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [ANA, BASTIEN] = PLAYERS
const TEFERI = 'Teferi, Time Raveler'
const SOL_RING = 'Anneau solaire'
const ANGEL = 'Ange de Serra'

const browser = await chromium.launch({ executablePath })
const errors = []

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

async function openAs(player, { viewport = { width: 1280, height: 900 }, mobile = false, reducedMotion = 'no-preference' } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile, reducedMotion })
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
  const path = `${outDir}/card-effects-${shot}-${label}.png`
  await page.screenshot({ path })
  console.log(`📸 ${path}`)
}

/** Carte du joueur mise sur son champ de bataille : depuis sa main, sinon en la cherchant dans sa bibliothèque. Renvoie son sélecteur. */
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

/** Commandant du joueur mis sur son champ de bataille depuis la zone de commandement. Renvoie son sélecteur. */
async function commanderOnBattlefield(who, solo = false) {
  const { page } = who
  const me = solo ? await page.locator('[data-zone="hand"][data-player]').first().getAttribute('data-player') : who.id
  const commander = page.locator(`[data-zone="command"][data-player="${me}"] [data-card-id]`).first()
  const id = await commander.getAttribute('data-card-id')
  await commander.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Champ de bataille' }).click()
  const card = `[data-zone="battlefield"][data-player="${me}"] [data-card-id="${id}"]`
  await page.locator(card).waitFor()
  return card
}

/** Carte du champ de bataille mise au cimetière (menu), puis ramenée par la liste du cimetière (bouton « Champ »). */
async function backFromGraveyard(who, card, solo = false) {
  const { page } = who
  const me = solo ? await page.locator('[data-zone="hand"][data-player]').first().getAttribute('data-player') : who.id
  const id = await card.getAttribute('data-card-id')
  await card.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Cimetière', exact: true }).click()
  await page.locator(`[data-zone="graveyard"][data-player="${me}"]`).first().click()
  await page.locator(`[data-pile-card="${id}"]`).getByRole('button', { name: 'Champ', exact: true }).click()
  await page.getByRole('button', { name: 'Fermer', exact: true }).click().catch(() => {})
  await card.waitFor()
  return id
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

/** Effets d'une carte : liseré doré, et éclat d'arrivée en cours (affiché et animé). */
const fxOf = (locator) => locator.evaluate((el) => {
  const glint = el.querySelector('.card-glint')
  const style = glint && getComputedStyle(glint)
  return { frame: !!el.querySelector('.card-legendary'), glint: !!style && style.display !== 'none' && style.animationName === 'card-glint' }
})
/** Entrée du commandant : en cours, ondes animées (cachées en mouvement réduit), couronne et son animation. */
const commanderFx = (locator) => locator.evaluate((el) => {
  const card = el.matches('[data-commander-arrival]') ? el : el.querySelector('[data-commander-arrival]')
  const wave = el.querySelector('.card-commander-wave')
  const crown = el.querySelector('.card-commander-crown')
  return {
    arrival: !!card,
    wave: !!wave && getComputedStyle(wave).display !== 'none' && getComputedStyle(wave).animationName === 'commander-wave',
    crown: !!crown && getComputedStyle(crown).display !== 'none',
    crownAnimation: crown ? getComputedStyle(crown).animationName : null,
  }
})
/** Attend l'entrée du commandant (posée juste après l'affichage de la carte sur le champ de bataille). */
const arrived = async (locator) => {
  await locator.locator('[data-commander-arrival]').waitFor({ timeout: 1500 }).catch(() => {})
  return locator
}
/** Retour du cimetière : en cours, tombe (et son animation), deux moitiés, brume affichée, carte qui remonte. */
const graveFx = (locator) => locator.evaluate((el) => {
  const stone = el.querySelector('.card-grave-stone')
  const mist = el.querySelector('.card-grave-mist')
  const rise = el.querySelector('.card-grave-rise')
  return {
    arrival: !!el.querySelector('[data-grave-arrival]') || el.matches('[data-grave-arrival]'),
    stone: stone ? getComputedStyle(stone).animationName : null,
    halves: el.querySelectorAll('.card-grave-half').length,
    mist: !!mist && getComputedStyle(mist).display !== 'none',
    rise: rise ? getComputedStyle(rise).animationName : null,
  }
})
/** Flottement d'une carte : présent, nom de l'animation (« none » en mouvement réduit) et hauteur de la carte. */
const flightOf = (locator) => locator.evaluate((el) => {
  const lift = el.querySelector('.card-lift')
  if (!lift) return { flying: false }
  const style = getComputedStyle(lift)
  return { flying: true, animation: style.animationName, transform: style.transform, shadow: !!el.querySelector('.card-shadow') }
})
const tapSelector = (locator) => locator.evaluate((el) => `[data-card-id="${el.dataset.cardId}"]`)
const waitTapped = async (page, locator, tapped) =>
  page.waitForFunction(([sel, t]) => document.querySelector(sel)?.style.transform.includes('90deg') === t, [await tapSelector(locator), tapped])

/** L'éclat dure 1,1 s, l'entrée du commandant 1,7 s ; les effets d'arrivée disparaissent au bout de 2 s. */
const afterGlint = (page) => page.waitForTimeout(2300)

/** Fenêtre « Animations » (depuis Réglages) : true / false pour tout activer ou couper, ou chaque animation. */
async function setEffects(page, effects) {
  await page.getByRole('button', { name: 'Réglages' }).click()
  await page.getByRole('dialog', { name: 'Réglages de la table' }).getByRole('button', { name: 'Animations…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Animations' })
  if (effects === true) await dialog.getByRole('button', { name: 'Tout activer' }).click()
  else if (effects === false) await dialog.getByRole('button', { name: 'Tout couper' }).click()
  else for (const [id, on] of Object.entries(effects)) await dialog.locator(`[data-effect="${id}"] input`).setChecked(on)
  await page.getByRole('button', { name: 'Fermer les animations' }).click()
}

/** Cases de la fenêtre « Animations ». */
async function effectsShown(page) {
  await page.getByRole('button', { name: 'Réglages' }).click()
  await page.getByRole('dialog', { name: 'Réglages de la table' }).getByRole('button', { name: 'Animations…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Animations' })
  const shown = {}
  for (const id of ['legendary', 'commander', 'flying']) shown[id] = await dialog.locator(`[data-effect="${id}"] input`).isChecked()
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })
  return shown
}

try {
  // ── Mode test, à la souris ──
  const solo = await openAs(ANA)
  const { page } = solo
  await playtest(solo)
  const teferi = page.locator(await onBattlefield(solo, TEFERI, true))
  const arrival = await fxOf(teferi)
  check(arrival.frame && arrival.glint, 'Teferi (légendaire) arrive en jeu : liseré doré et éclat')
  check(await page.locator('[data-zone="hand"] .card-legendary, [data-pile] .card-legendary').count() === 0, 'aucun effet hors du champ de bataille')
  const box = await teferi.boundingBox()
  const frameBox = await teferi.locator('.card-legendary').boundingBox()
  check(Math.abs(box.width - frameBox.width) < 2 && Math.abs(box.height - frameBox.height) < 2, 'liseré aux dimensions de la carte')
  await afterGlint(page)
  const settled = await fxOf(teferi)
  check(settled.frame && !settled.glint, 'l’éclat s’arrête, le liseré reste')
  await capture(page, 'mode-test')

  await teferi.dblclick()
  await page.waitForFunction((sel) => document.querySelector(sel)?.style.transform.includes('90deg'), await teferi.evaluate((el) => `[data-card-id="${el.dataset.cardId}"]`))
  const tapped = await fxOf(teferi)
  check(tapped.frame && !tapped.glint, 'Teferi engagé : garde son liseré, sans nouvel éclat')
  await capture(page, 'engage')
  check(!(await commanderFx(teferi)).arrival, 'Teferi (pas le commandant) : pas d’entrée de commandant')

  // Entrée du commandant : il se pose avec un halo, deux ondes dorées et une couronne, une seule fois.
  const kenrith = page.locator(await commanderOnBattlefield(solo, true))
  const entrance = await commanderFx(await arrived(kenrith))
  check(entrance.arrival && entrance.wave && entrance.crown && entrance.crownAnimation === 'commander-crown', 'commandant arrivé en jeu : halo, ondes dorées et couronne')
  check((await fxOf(kenrith)).glint, 'commandant légendaire : son éclat aussi')
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${outDir}/card-effects-commandant-entree.png` })
  console.log(`📸 ${outDir}/card-effects-commandant-entree.png`)
  await afterGlint(page)
  const landed = await commanderFx(kenrith)
  check(!landed.arrival && !landed.crown && (await fxOf(kenrith)).frame, 'puis plus que le liseré doré')
  await kenrith.dblclick()
  await waitTapped(page, kenrith, true)
  check(!(await commanderFx(kenrith)).arrival, 'commandant engagé : pas de nouvelle entrée')

  // Posé au même endroit que Teferi, l'Anneau solaire le recouvre : à vérifier après le double-clic.
  const sol = page.locator(await onBattlefield(solo, SOL_RING, true))
  check(!(await fxOf(sol)).frame, 'Anneau solaire (non légendaire) : aucun effet')

  // Créature volante (posée par-dessus les autres : elle reste cliquable).
  const angel = page.locator(await onBattlefield(solo, ANGEL, true))
  const flight = await flightOf(angel)
  check(flight.flying && flight.animation === 'card-hover' && flight.shadow, 'Ange de Serra (vol) en jeu : flotte au-dessus de son ombre')
  check(!(await flightOf(sol)).flying && !(await flightOf(teferi)).flying, 'Anneau solaire et Teferi (sans vol) : ne flottent pas')
  await capture(page, 'vol')
  await angel.dblclick()
  await waitTapped(page, angel, true)
  check(!(await flightOf(angel)).flying, 'Ange engagé : il se pose')
  await angel.dblclick()
  await waitTapped(page, angel, false)
  check((await flightOf(angel)).flying, 'Ange dégagé : il flotte de nouveau')

  // Retour du cimetière : une tombe se brise et la carte remonte, une seule fois.
  check(!(await graveFx(angel)).arrival && !(await graveFx(sol)).arrival, 'arrivée ordinaire (main, bibliothèque) : pas de tombe')
  await afterGlint(page)
  await backFromGraveyard(solo, angel, true)
  const risen = await graveFx(angel)
  check(risen.arrival && risen.stone === 'grave-stone' && risen.halves === 2 && risen.mist && risen.rise === 'grave-rise', 'Ange ramené du cimetière : la tombe se brise, la carte remonte')
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${outDir}/card-effects-retour-cimetiere.png` })
  console.log(`📸 ${outDir}/card-effects-retour-cimetiere.png`)
  await afterGlint(page)
  check(!(await graveFx(angel)).arrival && (await flightOf(angel)).flying, 'puis plus de tombe, l’Ange flotte de nouveau')
  await setEffects(page, { graveyard: false })
  await backFromGraveyard(solo, angel, true)
  check(!(await graveFx(angel)).arrival && (await flightOf(angel)).flying, '« Retour du cimetière » décoché : pas de tombe, l’Ange flotte toujours')
  await setEffects(page, { graveyard: true })
  await afterGlint(page)

  await page.getByRole('button', { name: 'Jeton', exact: true }).click()
  const tokenDialog = page.getByRole('dialog', { name: 'Créer un jeton' })
  await tokenDialog.getByRole('button', { name: /Esprit/ }).click()
  const spirit = page.locator('[data-zone="battlefield"] [data-card-id]:has([title="Esprit"])').first()
  await spirit.waitFor()
  check((await flightOf(spirit)).flying, 'jeton Esprit du deck (vol) : flotte')
  await page.keyboard.press('Escape')

  // Une animation à la fois (fenêtre « Animations »).
  await setEffects(page, { flying: false })
  check(!(await flightOf(angel)).flying && !(await flightOf(spirit)).flying, '« Vol » décoché : l’Ange et l’Esprit ne flottent plus')
  check((await fxOf(teferi)).frame, '« Vol » décoché : Teferi garde son liseré')
  await setEffects(page, { commander: false })
  // L'Ange et l'Esprit, posés au même endroit, recouvrent Kenrith : son menu ouvert directement.
  const kBox = await kenrith.boundingBox()
  await kenrith.dispatchEvent('contextmenu', { button: 2, clientX: kBox.x + 10, clientY: kBox.y + 10 })
  await page.getByRole('menuitem', { name: 'Zone de commandement' }).click()
  await kenrith.waitFor({ state: 'detached' })
  const kenrith2 = page.locator(await commanderOnBattlefield(solo, true))
  await page.waitForTimeout(300)
  check(!(await commanderFx(kenrith2)).arrival, '« Entrée du commandant » décochée : le commandant arrive sans halo ni couronne')
  check((await fxOf(kenrith2)).glint, 'mais son éclat de légendaire reste')
  await setEffects(page, { legendary: false, flying: true })
  check(!(await fxOf(teferi)).frame && !(await fxOf(kenrith2)).frame, '« Légendaires » décoché : plus de liseré')
  check((await flightOf(angel)).flying, '« Vol » recoché : l’Ange flotte de nouveau')
  await capture(page, 'animations-au-choix')
  await page.reload()
  await page.getByRole('button', { name: /Reprendre la partie/ }).click()
  await page.waitForSelector('[data-zone="hand"] [data-card-id]', { timeout: 15_000 })
  const kept = await effectsShown(page)
  check(!kept.legendary && !kept.commander && kept.flying, 'choix de chaque animation mémorisé après rechargement')

  await setEffects(page, false)
  check(!(await fxOf(teferi)).frame, '« Tout couper » : plus de liseré')
  check(!(await flightOf(angel)).flying, '« Tout couper » : l’Ange ne flotte plus')
  await page.reload()
  await page.getByRole('button', { name: /Reprendre la partie/ }).click()
  await page.waitForSelector('[data-zone="hand"] [data-card-id]', { timeout: 15_000 })
  const off = await effectsShown(page)
  check(!off.legendary && !off.commander && !off.flying, 'réglage mémorisé après rechargement')
  check(!(await fxOf(teferi)).frame, 'partie reprise : Teferi toujours sans liseré')
  await setEffects(page, true)
  const back = await fxOf(teferi)
  check(back.frame && !back.glint, '« Tout activer » : liseré revenu, sans éclat (la carte était déjà en jeu)')
  await page.reload()
  await page.getByRole('button', { name: /Reprendre la partie/ }).click()
  await teferi.waitFor()
  check(!(await fxOf(teferi)).glint, 'partie reprise : pas d’éclat au chargement')

  // Ancienne case unique « Animations des cartes » décochée : toutes les animations restent coupées.
  await page.evaluate(() => localStorage.setItem('dc-table-settings', JSON.stringify({ grid: true, background: null, cardScale: 1, pilesBesideHand: true, cardEffects: false })))
  await page.reload()
  await page.getByRole('button', { name: /Reprendre la partie/ }).click()
  await teferi.waitFor()
  const legacy = await effectsShown(page)
  check(!(await fxOf(teferi)).frame && !legacy.legendary && !legacy.commander && !legacy.flying, 'ancien réglage « Animations des cartes » coupé : toutes les animations coupées')
  await setEffects(page, true)

  // ── Mouvement réduit (réglage du système) ──
  const calm = await openAs(ANA, { reducedMotion: 'reduce' })
  await playtest(calm)
  const calmTeferi = calm.page.locator(await onBattlefield(calm, TEFERI, true))
  const calm1 = await fxOf(calmTeferi)
  check(calm1.frame && !calm1.glint, 'mouvement réduit : liseré doré seul, pas d’éclat')
  const calmAngel = calm.page.locator(await onBattlefield(calm, ANGEL, true))
  const calmFlight = await flightOf(calmAngel)
  check(calmFlight.flying && calmFlight.animation === 'none' && calmFlight.transform !== 'none', 'mouvement réduit : l’Ange reste surélevé, immobile')
  await afterGlint(calm.page)
  await backFromGraveyard(calm, calmAngel, true)
  const calmGrave = await graveFx(calmAngel)
  check(calmGrave.arrival && calmGrave.stone === 'none' && calmGrave.halves === 2 && !calmGrave.mist && calmGrave.rise === 'none', 'mouvement réduit : la carte ramenée du cimetière montre la tombe fendue, immobile')
  const calmCommander = await commanderFx(await arrived(calm.page.locator(await commanderOnBattlefield(calm, true))))
  check(calmCommander.arrival && calmCommander.crown && calmCommander.crownAnimation === 'none' && !calmCommander.wave, 'mouvement réduit : le commandant qui arrive montre sa couronne, immobile, sans ondes')

  // ── Mode test, sur tablette (tactile) ──
  const tablet = await openAs(ANA, { viewport: { width: 1180, height: 820 }, mobile: true })
  await playtest(tablet)
  const tabletTeferi = tablet.page.locator(await onBattlefield(tablet, TEFERI, true))
  check((await fxOf(tabletTeferi)).glint, 'tablette : éclat de Teferi à son arrivée')
  await tabletTeferi.locator('[data-loyalty]').tap()
  await tablet.page.getByRole('menu').waitFor()
  check(true, 'tablette : l’effet ne gêne pas le toucher (encart de loyauté)')
  await tablet.page.keyboard.press('Escape')
  await capture(tablet.page, 'tablette')

  // ── En ligne, à 2 ──
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

  const anaCard = await onBattlefield(ana, TEFERI)
  check((await fxOf(ana.page.locator(anaCard))).glint, 'en ligne : Ana voit l’éclat de son Teferi qui arrive')
  const teferiId = await ana.page.locator(anaCard).getAttribute('data-card-id')
  const seenByBastien = bastien.page.locator(`[data-zone="battlefield"][data-player="${ANA.id}"] [data-card-id="${teferiId}"], [data-zone="battlefield"][data-player="${ANA.id}"] [data-strip-card="${teferiId}"]`)
  await seenByBastien.waitFor()
  check((await fxOf(seenByBastien)).glint, 'en ligne : Bastien voit l’éclat du Teferi d’Ana')
  await afterGlint(bastien.page)
  const seen = await fxOf(seenByBastien)
  check(seen.frame && !seen.glint, 'en ligne : puis le liseré seul')

  await afterGlint(ana.page)
  const anaKenrith = await commanderOnBattlefield(ana)
  check((await commanderFx(await arrived(ana.page.locator(anaKenrith)))).arrival, 'en ligne : Ana voit l’entrée de son commandant')
  const kenrithId = await ana.page.locator(anaKenrith).getAttribute('data-card-id')
  const kenrithForBastien = bastien.page.locator(`[data-zone="battlefield"][data-player="${ANA.id}"] [data-card-id="${kenrithId}"], [data-zone="battlefield"][data-player="${ANA.id}"] [data-strip-card="${kenrithId}"]`)
  await kenrithForBastien.waitFor()
  const kenrithSeen = await commanderFx(await arrived(kenrithForBastien))
  check(kenrithSeen.arrival && kenrithSeen.wave && kenrithSeen.crown, 'en ligne : Bastien voit l’entrée du commandant d’Ana')
  await capture(bastien.page, 'en-ligne-commandant')

  const anaAngel = await onBattlefield(ana, ANGEL)
  const angelId = await ana.page.locator(anaAngel).getAttribute('data-card-id')
  check((await flightOf(ana.page.locator(anaAngel))).flying, 'en ligne : l’Ange d’Ana flotte chez elle')
  const angelForBastien = bastien.page.locator(`[data-zone="battlefield"][data-player="${ANA.id}"] [data-card-id="${angelId}"], [data-zone="battlefield"][data-player="${ANA.id}"] [data-strip-card="${angelId}"]`)
  await angelForBastien.waitFor()
  check((await flightOf(angelForBastien)).flying, 'en ligne : Bastien voit l’Ange d’Ana flotter')
  await afterGlint(ana.page)
  await backFromGraveyard(ana, ana.page.locator(anaAngel))
  check((await graveFx(ana.page.locator(anaAngel))).arrival, 'en ligne : Ana voit la tombe de son Ange ramené du cimetière')
  await angelForBastien.locator('[data-grave-arrival]').waitFor({ timeout: 1500 }).catch(() => {})
  check((await graveFx(angelForBastien)).arrival, 'en ligne : Bastien voit l’Ange d’Ana revenir du cimetière')
  await capture(ana.page, 'en-ligne-ana')
  await capture(bastien.page, 'en-ligne-bastien')

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` : ${errors.join(' | ')}` : ''}`)
} finally {
  await browser.close()
}
