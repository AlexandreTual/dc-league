// Vérification du mode test dans un vrai navigateur (Chromium piloté par playwright-core).
// Usage : node scripts/playtest-check.mjs <url-de-base> <deckId> <dossier-captures>
import { chromium } from 'playwright-core'

const [base = 'http://localhost:8788', deckId, outDir = '.'] = process.argv.slice(2)
if (!deckId) throw new Error('deckId manquant')

const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const browser = await chromium.launch({ executablePath })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

let shot = 0
async function capture(label) {
  shot++
  await page.waitForTimeout(300) // laisser finir les animations
  const path = `${outDir}/playtest-${shot}-${label}.png`
  await page.screenshot({ path })
  console.log(`📸 ${path}`)
}

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

const handCount = () => page.locator('[data-zone="hand"] [data-card-id]').count()
const battlefieldCount = () => page.locator('[data-zone="battlefield"] [data-card-id]').count()

/** Glisse un élément vers un point, par petits pas (le capteur de dnd-kit exige un vrai mouvement). */
async function drag(locator, x, y) {
  const box = await locator.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 10, { steps: 5 })
  await page.mouse.move(x, y, { steps: 15 })
  await page.mouse.up()
  await page.waitForTimeout(200)
}

try {
  // Effacer une éventuelle sauvegarde avant d'ouvrir la page de test (même origine).
  await page.goto(`${base}/decks/${deckId}`)
  await page.evaluate((id) => localStorage.removeItem(`dc-playtest-${id}`), deckId)
  await page.goto(`${base}/decks/${deckId}/test`)
  await page.waitForSelector('[data-zone="hand"] [data-card-id]')

  check((await handCount()) === 7, 'main de départ de 7 cartes')
  check(await page.locator('[data-testid="mulligan-banner"]').isVisible(), 'bandeau de mulligan affiché')
  await capture('depart')

  await page.getByRole('button', { name: 'Mulligan', exact: true }).click()
  check((await handCount()) === 7, 'après mulligan : toujours 7 cartes (premier gratuit)')
  check((await page.locator('[data-testid="mulligan-banner"]').innerText()).includes('Mulligan n°1'), 'bandeau : Mulligan n°1')
  await capture('mulligan')
  await page.getByRole('button', { name: 'Garder' }).click()
  check(!(await page.locator('[data-testid="mulligan-banner"]').isVisible()), 'bandeau masqué après Garder')

  const battlefield = await page.locator('[data-zone="battlefield"]').boundingBox()
  const firstCard = page.locator('[data-zone="hand"] [data-card-id]').first()
  const movedId = await firstCard.getAttribute('data-card-id')
  await drag(firstCard, battlefield.x + battlefield.width * 0.3, battlefield.y + battlefield.height * 0.4)
  check((await handCount()) === 6, 'glisser-déposer : 6 cartes en main')
  check((await battlefieldCount()) === 1, 'glisser-déposer : 1 carte sur le champ de bataille')

  const onField = page.locator(`[data-zone="battlefield"] [data-card-id="${movedId}"]`)
  await onField.dblclick()
  await page.waitForTimeout(250)
  const transform = await onField.evaluate((el) => el.style.transform)
  check(transform.includes('rotate(90deg)'), 'double-clic : carte engagée')

  await page.getByRole('button', { name: /Tour suivant/ }).click()
  check((await page.getByTestId('turn').innerText()) === 'Tour 2', 'tour suivant : tour 2')
  check((await handCount()) === 7, 'tour suivant : pioche (7 cartes)')
  check(!(await onField.evaluate((el) => el.style.transform)).includes('rotate(90deg)'), 'tour suivant : carte dégagée')
  await capture('tour-2')

  await page.getByRole('button', { name: /Annuler/ }).click()
  check((await page.getByTestId('turn').innerText()) === 'Tour 1', 'annuler : retour au tour 1')
  check((await handCount()) === 6, 'annuler : 6 cartes en main')
  await capture('annuler')

  await page.reload()
  await page.getByRole('button', { name: /Reprendre la partie/ }).waitFor()
  await capture('reprise')
  await page.getByRole('button', { name: /Reprendre la partie/ }).click()
  await page.waitForSelector('[data-zone="hand"] [data-card-id]')
  check((await handCount()) === 6, 'reprise : même main (6 cartes)')
  check((await battlefieldCount()) === 1, 'reprise : même champ de bataille')

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ' : ' + errors.join(' | ') : ''}`)
  console.log('\nTout est OK')
} finally {
  await browser.close()
}
