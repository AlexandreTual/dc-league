// Vérification de la taille de la main dans un vrai navigateur (Chromium piloté par playwright-core) : réglage
// « Taille de la main » (hauteur de la bande main + piles, mémorisé), vignettes des piles plafonnées à la souris
// pour laisser la place à la main sur un écran étroit, tablette inchangée.
// Usage : node scripts/hand-size-check.mjs <url-de-base> <dossier-captures>
import { launch } from './browser.mjs'

const [base = 'http://localhost:8788', outDir = '.'] = process.argv.slice(2)
const browser = await launch()
const errors = []

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

async function open(options) {
  const context = await browser.newContext(options)
  await context.addCookies([{ name: 'dc_session', value: 'jeton-de-test-e2e-1', url: base }])
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${base}/decks/deck-e2e-1`)
  await page.evaluate(() => {
    localStorage.removeItem('dc-playtest-deck-e2e-1')
    localStorage.removeItem('dc-table-settings')
  })
  await page.goto(`${base}/decks/deck-e2e-1/test`)
  await page.waitForSelector('[data-zone="hand"] [data-card-id]')
  return page
}

/** Recharge la page et reprend la partie sauvegardée. */
async function reload(page) {
  await page.reload()
  await page.getByRole('button', { name: /Reprendre la partie/ }).click()
  await page.waitForSelector('[data-zone="hand"] [data-card-id]')
}

/** Hauteur de la bande, largeur de la main et des piles, hauteur d'une vignette. */
const measure = (page) => page.evaluate(() => {
  const box = (sel) => document.querySelector(sel).getBoundingClientRect()
  const row = box('[data-hand-row]')
  return {
    row: row.height,
    rowWidth: row.width,
    board: box('[data-hand-row]').bottom - box('[data-zone="battlefield"]').top,
    hand: box('[data-hand-row] [data-zone="hand"]').width,
    piles: box('[data-pile-tiles]').width,
    tile: box('[data-pile-tiles] [data-zone="graveyard"]').height,
  }
})

async function chooseHandScale(page, value) {
  await page.getByRole('button', { name: 'Réglages' }).click()
  await page.getByLabel('Taille de la main').selectOption(value)
  await page.getByRole('button', { name: 'Fermer les réglages' }).click()
  await page.waitForTimeout(200)
}

try {
  // Souris, grand écran : la bande par défaut, plus basse à 60 %, plus haute à 140 %, réglage mémorisé.
  let page = await open({ viewport: { width: 1440, height: 900 } })
  const normal = await measure(page)
  await page.screenshot({ path: `${outDir}/hand-size-1-defaut.png` })
  check(Math.abs(normal.row / normal.board - 0.25) < 0.03, `bande main + piles : 25 % de la hauteur par défaut (${Math.round(normal.row)} px)`)
  await chooseHandScale(page, '0.6')
  const small = await measure(page)
  await page.screenshot({ path: `${outDir}/hand-size-2-60.png` })
  check(Math.abs(small.row / normal.row - 0.6) < 0.05, `Taille de la main 60 % : bande à ${Math.round(small.row)} px`)
  check(small.tile <= small.row + 1, 'à 60 %, les piles suivent la bande')
  const card = await page.locator('[data-zone="hand"] [data-card-id]').first().boundingBox()
  check(card.height < normal.row * 0.6, 'à 60 %, les cartes de la main rapetissent')
  await chooseHandScale(page, '1.4')
  const big = await measure(page)
  await page.screenshot({ path: `${outDir}/hand-size-3-140.png` })
  check(Math.abs(big.row / normal.row - 1.4) < 0.05, `Taille de la main 140 % : bande à ${Math.round(big.row)} px`)
  check(big.piles / big.rowWidth < 0.4, `à 140 %, les piles gardent moins de 40 % de la largeur (${Math.round((100 * big.piles) / big.rowWidth)} %)`)
  await reload(page)
  check(Math.abs((await measure(page)).row - big.row) < 2, 'taille de la main mémorisée après rechargement')

  // Souris, écran étroit : les vignettes rapetissent, la main garde l'essentiel de la largeur.
  await page.evaluate(() => localStorage.removeItem('dc-table-settings'))
  await page.setViewportSize({ width: 820, height: 900 })
  await reload(page)
  const narrow = await measure(page)
  await page.screenshot({ path: `${outDir}/hand-size-4-etroit.png` })
  check(narrow.tile < narrow.row - 10, `écran étroit : vignettes plus basses que la bande (${Math.round(narrow.tile)} / ${Math.round(narrow.row)} px)`)
  check(narrow.piles / narrow.rowWidth < 0.4, `écran étroit : piles sous 40 % de la largeur (${Math.round((100 * narrow.piles) / narrow.rowWidth)} %)`)
  check(narrow.hand / narrow.rowWidth > 0.55, `écran étroit : la main garde plus de 55 % de la largeur (${Math.round((100 * narrow.hand) / narrow.rowWidth)} %)`)
  await page.context().close()

  // Tablette : réglage proposé, bande réglable, piles en colonne inchangées (bouton et bibliothèque).
  page = await open({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true })
  const tablet = await page.evaluate(() => document.querySelector('[data-hand-row]').getBoundingClientRect().height)
  await chooseHandScale(page, '0.8')
  const tabletSmall = await page.evaluate(() => document.querySelector('[data-hand-row]').getBoundingClientRect().height)
  check(Math.abs(tabletSmall / tablet - 0.8) < 0.05, 'tablette : Taille de la main 80 % appliquée')
  const library = await page.locator('[data-pile-tiles] [data-zone="library"]').boundingBox()
  check(library.height > 30, 'tablette : la bibliothèque reste visible dans la colonne des piles')
  await page.screenshot({ path: `${outDir}/hand-size-5-tablette.png` })
  await page.context().close()

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` : ${errors.join(' | ')}` : ''}`)
  console.log('\nTaille de la main : tout est bon.')
} finally {
  await browser.close()
}
