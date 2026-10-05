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

  // Pendant le glisser, l'aperçu garde la taille de la carte d'origine.
  const source = await firstCard.boundingBox()
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(source.x + source.width / 2 + 40, source.y + source.height / 2 - 60, { steps: 10 })
  const overlay = await page.getByTestId('drag-overlay').boundingBox()
  check(Math.abs(overlay.height - source.height) <= 2, `aperçu de même taille que la carte (${Math.round(overlay.height)} px / ${Math.round(source.height)} px)`)
  await page.mouse.up()
  await page.waitForTimeout(200)
  check((await handCount()) === 7, 'glisser lâché dans la main : la carte y reste')

  // La carte se pose là où l'aperçu a été lâché : son centre arrive sur le centre de l'aperçu.
  const box = await firstCard.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 10, { steps: 5 })
  await page.mouse.move(battlefield.x + battlefield.width * 0.3, battlefield.y + battlefield.height * 0.4, { steps: 15 })
  const seen = await page.getByTestId('drag-overlay').boundingBox()
  await page.mouse.up()
  await page.waitForTimeout(200)
  check((await handCount()) === 6, 'glisser-déposer : 6 cartes en main')
  check((await battlefieldCount()) === 1, 'glisser-déposer : 1 carte sur le champ de bataille')
  const placed = await page.locator(`[data-zone="battlefield"] [data-card-id="${movedId}"]`).boundingBox()
  const gap = Math.hypot(placed.x + placed.width / 2 - (seen.x + seen.width / 2), placed.y + placed.height / 2 - (seen.y + seen.height / 2))
  check(gap <= 3, `carte posée là où l'aperçu a été lâché (écart ${Math.round(gap)} px)`)

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

  // ── Étape C : menu, marqueurs, jetons, bibliothèque, taxe, journal, raccourcis ──
  await onField.click({ button: 'right' })
  await page.getByRole('menu').waitFor()
  await page.getByRole('button', { name: '+1/+1 plus' }).click()
  await page.getByRole('button', { name: '+1/+1 plus' }).click()
  check((await onField.innerText()).includes('+2/+2'), 'menu : 2 marqueurs +1/+1')
  await capture('menu-marqueurs')
  await page.keyboard.press('Escape')
  check(!(await page.getByRole('menu').isVisible()), 'Échap ferme le menu')

  await page.getByRole('button', { name: 'Jeton', exact: true }).click()
  await page.getByRole('button', { name: 'Personnalisé' }).click()
  await page.getByPlaceholder('Nom (ex. Soldat)').fill('Soldat')
  await page.getByRole('button', { name: 'Créer le jeton' }).click()
  check((await battlefieldCount()) === 2, 'jeton personnalisé créé')
  const badges = () => page.locator('[data-zone="battlefield"] [data-token-badge]').allTextContents()
  check((await page.locator('[data-zone="battlefield"]').innerText()).includes('Soldat') && (await badges()).join() === 'Jeton', 'jeton : nom et mention « Jeton » affichés')

  const copiedName = await onField.locator('[title]').first().getAttribute('title')
  await onField.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Créer un jeton copie', exact: true }).click()
  const sameName = await page.locator(`[data-zone="battlefield"] [data-card-id] [title="${copiedName}"]`).count()
  check((await battlefieldCount()) === 3 && sameName === 2 && (await badges()).includes('Copie'),
    `jeton copie : un second « ${copiedName} » marqué « Copie » sur le champ de bataille`)

  const libraryBefore = Number((await page.locator('[data-zone="library"]').innerText()).match(/\((\d+)\)/)[1])
  page.once('dialog', (d) => d.accept('3'))
  await page.locator('[data-zone="library"]').click({ button: 'right' })
  await page.getByRole('menuitem', { name: /Regarder les X/ }).click()
  await page.getByRole('dialog').waitFor()
  check((await page.locator('[data-pile-card]').count()) === 3, 'regarder les 3 du dessus')
  await capture('regarder-3')
  const looked = await page.locator('[data-pile-card]').first().getAttribute('data-pile-card')
  await page.locator('[data-pile-card]').first().getByRole('button', { name: 'Dessous' }).click()
  check((await page.locator('[data-pile-card]').count()) === 2, 'carte envoyée dessous : retirée de la liste')
  await page.getByRole('button', { name: 'Fermer' }).click()
  const libraryAfter = Number((await page.locator('[data-zone="library"]').innerText()).match(/\((\d+)\)/)[1])
  check(libraryAfter === libraryBefore, `bibliothèque inchangée en taille (${libraryAfter}), ${looked} en dessous`)

  // Recherche filtrée par type : seules les créatures, puis « Tous » remet toute la bibliothèque.
  await page.locator('[data-zone="library"]').click({ button: 'right' })
  await page.getByRole('menuitem', { name: /Chercher une carte/ }).click()
  await page.getByRole('dialog').waitFor()
  const creatureButton = page.getByRole('group', { name: 'Filtrer par type' }).getByRole('button', { name: /^Créature \(\d+\)$/ })
  const creatures = Number((await creatureButton.innerText()).match(/\((\d+)\)/)[1])
  await creatureButton.click()
  const shownTypes = await page.locator('[data-pile-card] [title]').evaluateAll((els) => els.map((e) => e.getAttribute('title')))
  check(creatures > 0 && shownTypes.length === creatures && shownTypes.every((n) => n === 'Llanowar Elves'),
    `filtre « Créature » : ${creatures} créatures seulement`)
  await page.getByRole('button', { name: 'Tous', exact: true }).click()
  check((await page.locator('[data-pile-card]').count()) === libraryAfter, `filtre « Tous » : toute la bibliothèque (${libraryAfter})`)
  await capture('recherche-filtre')
  await page.getByRole('dialog').getByRole('checkbox').uncheck()
  await page.getByRole('button', { name: 'Fermer', exact: true }).click()

  // Carte du dessus face visible : une image dans la pile (un dos de carte n'en a pas).
  const library = page.locator('[data-zone="library"]')
  const libraryMenu = async (name) => {
    await library.click({ button: 'right' })
    await page.getByRole('menuitem', { name }).click()
    await page.waitForTimeout(200)
  }
  const topFaceUp = async () => (await library.locator('img').count()) === 1
  check(!(await topFaceUp()), 'bibliothèque : dos de carte par défaut')
  await libraryMenu('Révéler la carte du dessus')
  check(await topFaceUp(), 'révéler la carte du dessus : face visible sur la pile')
  await capture('dessus-revele')
  await library.locator('img').dblclick()
  await page.waitForTimeout(200)
  check(!(await topFaceUp()), 'carte révélée piochée : la pile montre un dos de carte')
  await libraryMenu('Jouer avec la carte du dessus révélée')
  check(await topFaceUp(), 'jouer avec la carte du dessus révélée : face visible sur la pile')
  const topName = await library.locator('img').getAttribute('alt')
  await library.locator('img').dblclick()
  await page.waitForTimeout(200)
  check(await topFaceUp() && (await library.locator('img').getAttribute('alt')) !== null, `après la pioche de ${topName} : la suivante est face visible`)
  await libraryMenu('Cacher la carte du dessus')
  check(!(await topFaceUp()), 'cacher la carte du dessus : dos de carte')

  const commander = page.locator('[data-zone="command"] [data-card-id]').first()
  const commanderId = await commander.getAttribute('data-card-id')
  await drag(commander, battlefield.x + battlefield.width * 0.6, battlefield.y + battlefield.height * 0.5)
  const commanderOnField = page.locator(`[data-zone="battlefield"] [data-card-id="${commanderId}"]`)
  check(await commanderOnField.isVisible(), 'commandant lancé sur le champ de bataille')
  const command = await page.locator('[data-zone="command"]').boundingBox()
  await drag(commanderOnField, command.x + command.width / 2, command.y + command.height / 2)
  check((await page.locator('[data-zone="command"]').innerText()).includes('Taxe +2'), 'retour en zone de commandement : taxe +2')
  await capture('taxe')

  await page.getByRole('button', { name: /Journal/ }).click()
  const log = await page.getByTestId('log').innerText()
  check(log.includes('Crée un jeton Soldat') && log.includes('Mulligan n°1 (gratuit)'), 'journal en français')
  await capture('journal')
  await page.getByRole('button', { name: 'Fermer le journal' }).click()

  const handBefore = await handCount()
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('d')
  check((await handCount()) === handBefore + 1, 'touche D : pioche')
  await page.keyboard.press('Control+z')
  check((await handCount()) === handBefore, 'Ctrl+Z : annule la pioche')

  await page.getByRole('button', { name: 'Jeton', exact: true }).click()
  await page.getByPlaceholder(/Soldat, Treasure/).fill('d')
  check((await handCount()) === handBefore, 'touche D pendant la saisie : pas de pioche')
  await page.keyboard.press('Escape')

  // ── Réglages : quadrillage et couleur du fond, mémorisés sur l'appareil ──
  const fieldStyle = () => page.locator('[data-zone="battlefield"]').evaluate((el) => ({ image: el.style.backgroundImage, color: el.style.backgroundColor }))
  check((await fieldStyle()).image.includes('linear-gradient'), 'quadrillage affiché par défaut')
  await page.getByRole('button', { name: 'Réglages' }).click()
  await page.getByLabel('Quadrillage sur le champ de bataille').uncheck()
  await page.getByLabel('Couleur du fond').fill('#1e3a2f')
  await capture('reglages')
  await page.keyboard.press('Escape')
  await page.reload()
  await page.getByRole('button', { name: /Reprendre la partie/ }).click()
  await page.waitForSelector('[data-zone="hand"] [data-card-id]')
  const styled = await fieldStyle()
  check(styled.image === '' && styled.color === 'rgb(30, 58, 47)', 'réglages gardés après rechargement : sans quadrillage, fond vert')
  await page.getByRole('button', { name: 'Réglages' }).click()
  await page.getByLabel('Quadrillage sur le champ de bataille').check()
  await page.getByRole('button', { name: 'Par défaut' }).click()
  await page.getByRole('button', { name: 'Fermer les réglages' }).click()

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ' : ' + errors.join(' | ') : ''}`)
  console.log('\nTout est OK')
} finally {
  await browser.close()
}
