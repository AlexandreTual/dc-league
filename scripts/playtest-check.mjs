// Vérification du mode test dans un vrai navigateur (Chromium piloté par playwright-core).
// Usage : node scripts/playtest-check.mjs <url-de-base> <deckId> <dossier-captures>
import { launch } from './browser.mjs'

const [base = 'http://localhost:8788', deckId, outDir = '.'] = process.argv.slice(2)
if (!deckId) throw new Error('deckId manquant')

const browser = await launch()
const page = await browser.newPage({ locale: 'fr-FR', viewport: { width: 1440, height: 900 } })
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
const libraryCount = async () => Number(await page.locator('[data-zone="library"]').getAttribute('data-count'))

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

  // Plein écran : le haut de la fenêtre appartient à la table, pas à la barre du site.
  const coversSite = (p) => p.evaluate(() => !!document.elementFromPoint(window.innerWidth / 2, 8)?.closest('[data-table-root]'))
  check(await coversSite(page), 'plein écran : la table couvre la barre du site')

  // Vrai plein écran du navigateur : le bouton suit l'état réel (y compris une sortie hors bouton, comme Échap).
  const fullscreenButton = page.getByTestId('fullscreen')
  await fullscreenButton.click()
  await page.waitForFunction(() => !!document.fullscreenElement)
  // Le bouton suit l'événement fullscreenchange : on lui laisse le temps de se redessiner.
  await page.waitForFunction(() => document.querySelector('[data-testid="fullscreen"]')?.getAttribute('aria-label') === 'Quitter le plein écran', null, { timeout: 5000 }).catch(() => {})
  check((await fullscreenButton.getAttribute('aria-label')) === 'Quitter le plein écran', 'plein écran du navigateur : le bouton devient « Quitter le plein écran »')
  await page.evaluate(() => document.exitFullscreen())
  await page.waitForFunction(() => !document.fullscreenElement)
  await page.waitForFunction(() => document.querySelector('[data-testid="fullscreen"]')?.textContent?.trim() === 'Plein écran')
  check(true, 'sortie du plein écran (Échap) : le bouton redevient « Plein écran »')

  // Ma colonne (portrait), à gauche de mon champ de bataille et de ma main ; la vie n'est plus dans la barre du haut.
  // Par défaut, mes piles en vignettes à droite de la main (façon Moxfield).
  const columnBox = await page.locator('[data-column]').boundingBox()
  const handBox = await page.locator('[data-zone="hand"]').boundingBox()
  const fieldBox = await page.locator('[data-zone="battlefield"]').boundingBox()
  check(columnBox.x + columnBox.width <= fieldBox.x && columnBox.x + columnBox.width <= handBox.x, 'colonne à gauche du champ de bataille et de la main')
  check((await page.locator('[data-column] [data-zone]').count()) === 0 && (await page.locator('[data-column] [data-testid="player-life"]').count()) === 1,
    'par défaut : la colonne ne garde que la ligne portrait (vie)')
  const tiles = page.locator('[data-pile-tiles]')
  const tilesBox = await tiles.boundingBox()
  check(tilesBox.x >= handBox.x + handBox.width - 1 && tilesBox.y >= handBox.y - 2 && tilesBox.y + tilesBox.height <= handBox.y + handBox.height + 2,
    'par défaut : piles en vignettes à droite de la main, à sa hauteur')
  for (const zone of ['library', 'graveyard', 'exile', 'command']) {
    check((await tiles.locator(`[data-zone="${zone}"]`).count()) === 1, `vignette ${zone} présente`)
  }
  check((await page.getByTestId('life').count()) === 0, 'mode test : plus de vie dans la barre du haut')

  check((await handCount()) === 7, 'main de départ de 7 cartes')
  check(await page.locator('[data-testid="mulligan-banner"]').isVisible(), 'bandeau de mulligan affiché')
  await capture('depart')

  await page.getByRole('button', { name: 'Mulligan', exact: true }).click()
  check((await handCount()) === 7, 'après mulligan : 7 nouvelles cartes')
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

  await page.getByRole('button', { name: /Fin de tour/ }).click()
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
  const plusField = page.getByRole('textbox', { name: '+1/+1 : nombre' })
  check((await plusField.inputValue()) === '2', 'menu : la valeur affichée suit les clics')
  await plusField.fill('5')
  await plusField.press('Enter')
  await page.waitForTimeout(150)
  check((await onField.innerText()).includes('+5/+5') && (await plusField.inputValue()) === '5', 'menu : nombre de marqueurs tapé (5)')
  await page.getByRole('textbox', { name: '-1/-1 : nombre' }).fill('1')
  await page.mouse.click(battlefield.x + battlefield.width * 0.9, battlefield.y + 20)
  await page.waitForTimeout(150)
  check((await onField.innerText()).includes('+4/+4') && !(await page.getByRole('menu').isVisible()), 'menu : nombre tapé appliqué en cliquant à côté')
  await onField.click({ button: 'right' })
  await page.getByRole('menu').waitFor()
  await capture('menu-marqueurs')
  await page.keyboard.press('Escape')
  check(!(await page.getByRole('menu').isVisible()), 'Échap ferme le menu')

  // Oracle et règles : depuis une carte visible, pas une fois face cachée.
  await onField.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Oracle et règles' }).click()
  const oracleDialog = page.getByRole('dialog', { name: 'Oracle et règles' })
  await oracleDialog.getByText(/Règles indisponibles|Aucune règle|\d{4}/).first().waitFor()
  check((await oracleDialog.getByRole('link', { name: /Gatherer/ }).getAttribute('href')).startsWith('https://gatherer.wizards.com/'), 'fenêtre « Oracle et règles » ouverte depuis le menu, avec le lien Gatherer')
  await capture('oracle')
  await oracleDialog.getByRole('button', { name: 'Fermer' }).click()
  check((await oracleDialog.count()) === 0, 'bouton « Fermer » : fenêtre fermée')
  await onField.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Face cachée' }).click()
  await onField.click({ button: 'right' })
  check((await page.getByRole('menuitem', { name: 'Oracle et règles' }).count()) === 0, 'carte face cachée : pas d’entrée « Oracle et règles »')
  await page.getByRole('menuitem', { name: 'Face visible' }).click()

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

  // Jetons du deck (issue #41) : onglet « Du deck » ouvert par défaut, avec la carte qui crée chaque jeton.
  await page.getByRole('button', { name: 'Jeton', exact: true }).click()
  const tokenDialog = page.getByRole('dialog', { name: 'Créer un jeton' })
  await tokenDialog.waitFor()
  check((await tokenDialog.innerText()).includes('Plante') && (await tokenDialog.innerText()).includes('Pour : Avenger of Zendikar'),
    'onglet « Du deck » : jetons du deck et carte qui les crée')
  await capture('jetons-du-deck')
  await tokenDialog.getByRole('button', { name: /Plante/ }).click()
  check((await battlefieldCount()) === 4 && (await page.locator('[data-zone="battlefield"]').innerText()).includes('Plante'), 'jeton du deck créé')

  const libraryBefore = await libraryCount()
  page.once('dialog', (d) => d.accept('3'))
  await page.locator('[data-zone="library"]').click({ button: 'right' })
  await page.getByRole('menuitem', { name: /Regarder les X/ }).click()
  await page.getByRole('dialog').waitFor()
  check((await page.locator('[data-pile-card]').count()) === 3, 'regarder les 3 du dessus')
  await capture('regarder-3')
  const looked = await page.locator('[data-pile-card]').first().getAttribute('data-pile-card')
  await page.locator('[data-pile-card]').first().getByRole('button', { name: 'Dessous', exact: true }).click()
  check((await page.locator('[data-pile-card]').count()) === 2, 'carte envoyée dessous : retirée de la liste')
  await page.getByRole('button', { name: 'Fermer' }).click()
  const libraryAfter = await libraryCount()
  check(libraryAfter === libraryBefore, `bibliothèque inchangée en taille (${libraryAfter}), ${looked} en dessous`)

  // Regard : remettre les cartes regardées dans l'ordre de son choix (flèches, puis glisser-déposer).
  const lookTop = async (n) => {
    page.once('dialog', (d) => d.accept(String(n)))
    await page.locator('[data-zone="library"]').click({ button: 'right' })
    await page.getByRole('menuitem', { name: /Regarder les X/ }).click()
    await page.locator('[data-pile-card]').nth(n - 1).waitFor()
  }
  const pileIds = () => page.locator('[data-pile-card]').evaluateAll((els) => els.map((e) => e.getAttribute('data-pile-card')))
  await lookTop(3)
  const [r1, r2, r3] = await pileIds()
  check((await page.locator('[data-pile-card]').first().locator('[data-pile-top]').count()) === 1, 'regard : repère « Dessus » sur la première carte')
  await page.locator(`[data-pile-card="${r1}"]`).getByRole('button', { name: 'Vers le dessous' }).click()
  check((await pileIds()).join() === [r2, r1, r3].join(), 'flèche → : la carte du dessus passe en deuxième')
  const r2Box = await page.locator(`[data-pile-card="${r2}"]`).boundingBox()
  await drag(page.locator(`[data-pile-card="${r3}"] [data-card-id]`), r2Box.x + r2Box.width / 2, r2Box.y + r2Box.height / 3)
  check((await pileIds()).join() === [r3, r2, r1].join(), 'glisser-déposer : la troisième carte passe dessus')
  check((await page.locator('[data-pile-away]').count()) === 0, 'regard : glissée dans la fenêtre, la fenêtre reste affichée')
  await capture('regard-ordre')
  await page.getByRole('button', { name: 'Fermer', exact: true }).click()
  await page.waitForTimeout(200)
  await lookTop(3)
  check((await pileIds()).join() === [r3, r2, r1].join(), 'regarder à nouveau : la bibliothèque a gardé l’ordre choisi')
  await page.getByRole('button', { name: 'Fermer', exact: true }).click()

  // Recherche filtrée par type : seules les créatures, puis « Tous » remet toute la bibliothèque.
  await page.locator('[data-zone="library"]').click({ button: 'right' })
  await page.getByRole('menuitem', { name: /Chercher une carte/ }).click()
  await page.getByRole('dialog').waitFor()
  const creatureButton = page.getByRole('group', { name: 'Filtrer par type' }).getByRole('button', { name: /^Créature \(\d+\)$/ })
  const creatures = Number((await creatureButton.innerText()).match(/\((\d+)\)/)[1])
  await creatureButton.click()
  const shownTypes = await page.locator('[data-pile-card] [title]').evaluateAll((els) => els.map((e) => e.getAttribute('title')))
  check(creatures > 0 && shownTypes.length === creatures && shownTypes.every((n) => ['Llanowar Elves', 'Avenger of Zendikar', 'Ange de Serra'].includes(n)),
    `filtre « Créature » : ${creatures} créatures seulement`)
  await page.getByRole('button', { name: 'Tous', exact: true }).click()
  check((await page.locator('[data-pile-card]').count()) === libraryAfter, `filtre « Tous » : toute la bibliothèque (${libraryAfter})`)
  // Le nom se cherche sans accents ni casse : « FORET » trouve « Forêt ».
  const nameFilter = page.getByPlaceholder('Filtrer par nom (FR ou EN)…')
  await nameFilter.fill('FORET')
  const shownNames = await page.locator('[data-pile-card] [title]').evaluateAll((els) => els.map((e) => e.getAttribute('title')))
  check(shownNames.length > 0 && shownNames.every((n) => ['Forêt', 'Forest'].includes(n)), `recherche « FORET » sans accent : ${shownNames.length} Forêts`)
  await nameFilter.fill('')
  await capture('recherche-filtre')
  // Recherche : une carte de la bibliothèque se glisse directement sur le champ de bataille.
  {
    const card = page.locator('[data-pile-card]').first()
    const id = await card.getAttribute('data-pile-card')
    const field = await page.locator('[data-zone="battlefield"]').boundingBox()
    await drag(card.locator('[data-card-id]'), field.x + field.width - 120, field.y + 120)
    check((await page.locator(`[data-zone="battlefield"] [data-card-id="${id}"]`).count()) === 1, 'recherche : carte de la bibliothèque glissée sur le champ de bataille')
    check((await page.locator(`[data-pile-card="${id}"]`).count()) === 0 && (await page.locator('[data-pile-card]').count()) > 0, 'recherche : la fenêtre revient, sans la carte')
  }
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
  await libraryMenu('Voir la carte du dessus (pour moi seul)')
  check(await topFaceUp(), 'voir la carte du dessus (pour moi seul) : face visible sur la pile')
  await capture('voir-dessus')
  const countBefore = await libraryCount()
  await library.locator('img').dblclick()
  await page.waitForTimeout(200)
  check(await topFaceUp() && (await libraryCount()) === countBefore - 1, 'après une pioche : la carte suivante est face visible')
  await libraryMenu('Ne plus voir la carte du dessus')
  check(!(await topFaceUp()), 'ne plus voir la carte du dessus : dos de carte')

  const commander = page.locator('[data-zone="command"] [data-card-id]').first()
  const commanderId = await commander.getAttribute('data-card-id')
  await drag(commander, battlefield.x + battlefield.width * 0.6, battlefield.y + battlefield.height * 0.5)
  const commanderOnField = page.locator(`[data-zone="battlefield"] [data-card-id="${commanderId}"]`)
  check(await commanderOnField.isVisible(), 'commandant lancé sur le champ de bataille')
  const command = await page.locator('[data-zone="command"]').boundingBox()
  await drag(commanderOnField, command.x + command.width / 2, command.y + command.height / 2)
  check((await page.locator('[data-zone="command"]').innerText()).includes('Taxe +2'), 'retour en zone de commandement : taxe +2')
  await capture('taxe')

  // Recherche fermée par Échap, case « Mélanger en fermant » laissée cochée : la bibliothèque est mélangée.
  await library.click({ button: 'right' })
  await page.getByRole('menuitem', { name: /Chercher une carte/ }).click()
  await page.getByRole('dialog').waitFor()
  check(await page.getByRole('dialog').getByRole('checkbox').isChecked(), 'recherche : « Mélanger en fermant » cochée par défaut')
  await page.locator('[data-pile-card]').first().getByRole('button', { name: 'Main', exact: true }).click()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  check((await page.locator('[data-pile-card]').count()) === 0, 'recherche : Échap ferme la fenêtre')

  await page.getByRole('button', { name: /Journal/ }).click()
  const log = await page.getByTestId('log').innerText()
  check(log.includes('Crée un jeton Soldat') && log.includes('Mulligan n°1') && !log.includes('gratuit') && log.includes('remet les 3 cartes du dessus de sa bibliothèque dans l’ordre de son choix'), 'journal en français (dont le regard)')
  check(log.includes('mélange sa bibliothèque'), 'journal : la recherche fermée par Échap mélange la bibliothèque')
  await capture('journal')
  await page.getByRole('button', { name: 'Fermer le journal' }).click()

  const handBefore = await handCount()
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('d')
  check((await handCount()) === handBefore + 1, 'touche D : pioche')
  await page.keyboard.press('Control+z')
  check((await handCount()) === handBefore, 'Ctrl+Z : annule la pioche')

  await page.getByRole('button', { name: 'Jeton', exact: true }).click()
  await page.getByRole('button', { name: 'Scryfall' }).click() // l'onglet « Du deck » s'ouvre d'abord (#41)
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

  // Taille des cartes : 150 % agrandit les cartes du champ de bataille, 100 % revient à la taille automatique.
  const fieldCard = page.locator('[data-zone="battlefield"] [data-card-id]').first()
  const widthBefore = (await fieldCard.boundingBox()).width
  await page.getByRole('button', { name: 'Réglages' }).click()
  await page.getByLabel('Taille des cartes').selectOption('1.5')
  const widthAfter = (await fieldCard.boundingBox()).width
  check(Math.abs(widthAfter / widthBefore - 1.5) < 0.05, `taille des cartes 150 % (${Math.round(widthBefore)} → ${Math.round(widthAfter)} px)`)
  await page.getByRole('button', { name: 'Fermer les réglages' }).click()
  await capture('taille-150')
  await page.getByRole('button', { name: 'Réglages' }).click()
  await page.getByLabel('Taille des cartes').selectOption('1')
  check(Math.abs((await fieldCard.boundingBox()).width - widthBefore) < 1, 'taille des cartes 100 % : taille d’origine')
  await page.getByRole('button', { name: 'Fermer les réglages' }).click()

  // ── Réglage « Piles dans la colonne » : l'ancienne disposition, avec le cimetière en cascade ──
  const oldLayout = async (on) => {
    await page.getByRole('button', { name: 'Réglages' }).click()
    await page.getByLabel('Piles dans la colonne (ancienne disposition)').setChecked(on)
    await page.getByRole('button', { name: 'Fermer les réglages' }).click()
  }
  await oldLayout(true)
  check((await page.locator('[data-pile-tiles]').count()) === 0 && (await page.locator('[data-column] [data-zone="library"]').count()) === 1,
    'piles dans la colonne : bibliothèque dans la colonne, plus de vignettes')

  // Cimetière en cascade : les 6 dernières, la plus récente en bas.
  const graveyard = page.locator('[data-column] [data-zone="graveyard"]')
  const graveyardBefore = Number(await graveyard.getAttribute('data-count'))
  for (let i = 0; i < 7; i++) await page.keyboard.press('d')
  let lastDumped = null
  for (let i = 0; i < 7; i++) {
    const card = page.locator('[data-zone="hand"] [data-card-id]').first()
    lastDumped = await card.getAttribute('data-card-id')
    const box = await graveyard.boundingBox()
    await drag(card, box.x + box.width / 2, box.y + box.height / 2)
  }
  const cascade = graveyard.locator('[data-card-id]')
  check(Number(await graveyard.getAttribute('data-count')) === graveyardBefore + 7, 'cimetière : 7 cartes déposées')
  check((await cascade.count()) === 6 && (await cascade.last().getAttribute('data-card-id')) === lastDumped, 'cascade : 6 dernières cartes, la plus récente en bas')
  await capture('cimetiere')
  await page.locator('[data-column]').getByRole('button', { name: 'Cim.' }).click()
  check((await page.getByRole('dialog').innerText()).includes('Cimetière'), 'case Cim. : ouvre tout le cimetière')
  await page.keyboard.press('Escape')
  await oldLayout(false)
  check((await page.locator('[data-pile-tiles]').count()) === 1, 'réglage décoché : retour aux vignettes à côté de la main')

  // ── Vie basse : en rouge à 10 ou moins ──
  const life = page.locator('[data-column] [data-testid="player-life"]')
  const lifeButton = (name) => page.locator('[data-column] [data-panel]').getByRole('button', { name }).first()
  const toTen = Number(await life.innerText()) - 10
  for (let i = 0; i < Math.floor(toTen / 5); i++) await lifeButton('moins : points de vie').click({ modifiers: ['Shift'] })
  for (let i = 0; i < toTen % 5; i++) await lifeButton('moins : points de vie').click()
  check((await life.innerText()) === '10' && (await life.getAttribute('class')).includes('text-dc-red-light'), 'vie à 10 : en rouge')
  await capture('vie-basse')
  await lifeButton('plus : points de vie').click()
  check((await life.innerText()) === '11' && !(await life.getAttribute('class')).includes('text-dc-red-light'), 'vie à 11 : couleur normale')

  // ── Marqueurs en liste (bulle « ⋯ ») : poison, prédéfinis à 0, ajout à la volée, interrupteurs ──
  await page.locator('[data-column]').getByRole('button', { name: /^Compteurs de / }).click()
  const bubble = page.locator('[data-bubble]')
  const marker = (key) => bubble.locator(`[data-marker="${key}"]`)
  const markerValue = async (key) => Number(await marker(key).getByTestId(`marker-${key}`).innerText())
  const presets = ['Énergie', 'Expérience', 'Rad', 'Tickets']
  check((await marker('poison').count()) === 1 && (await Promise.all(presets.map((n) => markerValue(`counter:${n}`)))).every((v) => v === 0),
    'liste : poison et les 4 marqueurs prédéfinis, à 0')
  await marker('counter:Énergie').getByRole('button', { name: 'plus : Énergie' }).click()
  await marker('counter:Énergie').getByRole('button', { name: 'plus : Énergie' }).click({ modifiers: ['Shift'] })
  check((await markerValue('counter:Énergie')) === 6, 'Énergie : + puis Maj+ = 6')
  check((await page.locator('[data-column] [data-badge="counter:Énergie"]').innerText()) === 'Énergie 6', 'badge « Énergie 6 » sous le portrait')
  check((await page.locator('[data-column] [data-badge="counter:Rad"]').count()) === 0, 'pas de badge pour un marqueur à 0')
  const newMarker = bubble.getByRole('textbox', { name: 'Nouveau marqueur' })
  await newMarker.fill('Éclat')
  await newMarker.press('Enter')
  await marker('counter:Éclat').waitFor()
  check((await markerValue('counter:Éclat')) === 1 && (await newMarker.inputValue()) === '', 'nouveau marqueur « Éclat » créé à 1 (Entrée), champ vidé')
  const rowsBefore = await bubble.locator('[data-marker]').count()
  await newMarker.fill('energie')
  await bubble.getByRole('button', { name: 'Ajouter le marqueur' }).click()
  check((await bubble.getByTestId('marker-error').innerText()) === 'Le marqueur « Énergie » existe déjà.' && (await bubble.locator('[data-marker]').count()) === rowsBefore,
    'doublon « energie » : message, rien de créé')
  await newMarker.fill('   ')
  await newMarker.press('Enter')
  check((await bubble.locator('[data-marker]').count()) === rowsBefore && (await bubble.getByTestId('marker-error').count()) === 0, 'nom vide : rien de créé, sans message')
  const monarch = bubble.getByRole('switch', { name: 'Monarque' })
  await monarch.click()
  check((await monarch.getAttribute('aria-checked')) === 'true' && (await page.locator('[data-column] [data-badge="monarch"]').count()) === 1, 'interrupteur Monarque : activé, badge affiché')
  await capture('marqueurs')
  await monarch.click()
  check((await monarch.getAttribute('aria-checked')) === 'false', 'interrupteur Monarque : désactivé')
  await page.keyboard.press('Escape')

  // ── Réserve de mana : en bas à gauche de mon champ de bataille, les 6 couleurs même à 0 ──
  const pool = page.locator('[data-board] [data-zone="battlefield"] [data-testid="mana-pool"]')
  const manaCount = async (c) => Number(await pool.locator(`[data-mana="${c}"]`).getAttribute('data-count'))
  const symbol = (name) => pool.getByRole('button', { name, exact: true })
  check((await pool.locator('[data-mana]').count()) === 6 && (await manaCount('G')) === 0, 'réserve : 6 symboles sur mon champ de bataille, à 0')
  check((await page.getByTestId('top-bar').getByTestId('mana-pool').count()) === 0, 'réserve : plus dans la barre du haut')
  const myFieldBox = await page.locator('[data-board] [data-zone="battlefield"]').boundingBox()
  const poolBox = await pool.boundingBox()
  check(poolBox.x - myFieldBox.x < 20 && myFieldBox.y + myFieldBox.height - (poolBox.y + poolBox.height) < 20, 'réserve : en bas à gauche du champ de bataille')
  await symbol('Vert plus').click()
  await symbol('Vert plus').click()
  check((await manaCount('G')) === 2, 'clic : +1 (2 verts)')
  await symbol('Bleu plus').click({ modifiers: ['Shift'] })
  check((await manaCount('U')) === 5, 'Maj+clic : +5 (5 bleus)')
  await symbol('Bleu plus').click({ button: 'right' })
  check((await manaCount('U')) === 4 && !(await page.getByRole('menu').isVisible()), 'clic droit : −1 (4 bleus), pas de menu')
  await capture('mana')
  await page.getByTestId('mana-total').click()
  const manaDialog = page.getByRole('dialog', { name: 'Réserve de mana' })
  check(await manaDialog.isVisible() && (await page.getByTestId('mana-total').innerText()).includes('6'), 'bouton du total (Σ 6) : détail ouvert')
  await manaDialog.getByRole('button', { name: 'Bleu moins' }).click()
  check((await manaCount('U')) === 3, 'détail : − retire 1 bleu')
  await capture('mana-detail')
  await page.keyboard.press('Escape')
  check(!(await manaDialog.isVisible()), 'Échap ferme le détail de la réserve')
  // Dépôt par-dessus la réserve : la carte arrive sur le champ de bataille.
  const onPool = page.locator('[data-zone="hand"] [data-card-id]').first()
  const onPoolId = await onPool.getAttribute('data-card-id')
  const pb = await pool.boundingBox()
  await drag(onPool, pb.x + pb.width / 2, pb.y + pb.height / 2)
  check((await page.locator(`[data-zone="battlefield"] [data-card-id="${onPoolId}"]`).count()) === 1, 'dépôt sur la réserve : carte sur le champ de bataille')
  await page.getByRole('button', { name: /Fin de tour/ }).click()
  check((await manaCount('G')) === 0 && (await manaCount('U')) === 0 && (await pool.locator('[data-mana]').count()) === 6, 'tour suivant : réserve vidée, 6 symboles à 0')

  // ── Vignettes à côté de la main : dépôt au cimetière, pioche, ouverture du cimetière ──
  const tileGrave = tiles.locator('[data-zone="graveyard"]')
  const graveBefore = Number(await tileGrave.getAttribute('data-count'))
  const dumped = page.locator('[data-zone="hand"] [data-card-id]').first()
  const dumpedId = await dumped.getAttribute('data-card-id')
  const gb = await tileGrave.boundingBox()
  await drag(dumped, gb.x + gb.width / 2, gb.y + gb.height / 2)
  check(Number(await tileGrave.getAttribute('data-count')) === graveBefore + 1 && (await tileGrave.locator('[data-pile-face]').getAttribute('data-pile-face')) === dumpedId,
    'vignette Cim. : dépôt, la dernière carte affichée face visible')
  const handBeforeDraw = await handCount()
  await tiles.locator('[data-zone="library"] [data-card-id]').dblclick()
  await page.waitForTimeout(300)
  check((await handCount()) === handBeforeDraw + 1, 'vignette Bib. : double-clic pioche')
  await capture('piles-a-cote-main')
  await tileGrave.click()
  check((await page.getByRole('dialog').innerText()).includes('Cimetière'), 'vignette Cim. : un clic ouvre tout le cimetière')
  await page.keyboard.press('Escape')

  // ── Cimetière en liste dans ma colonne : la plus récente en haut, nom et haut de l'illustration ──
  const list = page.locator('[data-column] [data-graveyard-list]')
  const listBox = await list.boundingBox()
  const columnNow = await page.locator('[data-column]').boundingBox()
  check(listBox && listBox.y + listBox.height <= columnNow.y + columnNow.height + 1 && listBox.height > 200,
    'cimetière en liste : dans ma colonne, sous la ligne portrait, sur la hauteur restante')
  check(Number(await list.getAttribute('data-count')) === Number(await tileGrave.getAttribute('data-count')), 'cimetière en liste : même nombre que la vignette Cim.')
  const firstRow = list.locator('[data-card-id]').first()
  check((await firstRow.getAttribute('data-card-id')) === dumpedId, 'cimetière en liste : la dernière carte arrivée en haut')
  check((await firstRow.getByTestId('graveyard-list-name').innerText()).trim().length > 0 && (await firstRow.locator('img').count()) === 1,
    'cimetière en liste : nom de la carte et haut de son illustration')
  const rowBox = await firstRow.boundingBox()
  check(rowBox.height < 70, `cimetière en liste : une ligne compacte (${Math.round(rowBox.height)} px)`)
  const toList = page.locator('[data-zone="hand"] [data-card-id]').first()
  const toListId = await toList.getAttribute('data-card-id')
  await drag(toList, listBox.x + listBox.width / 2, listBox.y + listBox.height - 20)
  check((await list.locator('[data-card-id]').first().getAttribute('data-card-id')) === toListId, 'cimetière en liste : dépôt direct sur la liste')
  await capture('cimetiere-liste')
  const backId = await list.locator('[data-card-id]').nth(1).getAttribute('data-card-id')
  const fb = await page.locator('[data-zone="battlefield"]').boundingBox()
  // Pas seulement la plus récente : une carte plus ancienne de la liste se glisse aussi.
  await drag(list.locator('[data-card-id]').nth(1), fb.x + 150, fb.y + 120)
  check((await page.locator(`[data-zone="battlefield"] [data-card-id="${backId}"]`).count()) === 1, 'cimetière en liste : une carte se glisse vers le champ de bataille')
  // La carte de la vignette Cim. se glisse aussi (identifiant de glisser à part), sans gêner la liste.
  const faceId = await tileGrave.locator('[data-pile-face]').getAttribute('data-pile-face')
  await drag(tileGrave.locator('[data-pile-face] [data-card-id]'), fb.x + 260, fb.y + 120)
  check((await page.locator(`[data-zone="battlefield"] [data-card-id="${faceId}"]`).count()) === 1, 'vignette Cim. : la dernière carte se glisse vers le champ de bataille')
  const againId = await list.locator('[data-card-id]').first().getAttribute('data-card-id')
  await drag(list.locator('[data-card-id]').first(), fb.x + 370, fb.y + 120)
  check((await page.locator(`[data-zone="battlefield"] [data-card-id="${againId}"]`).count()) === 1, 'cimetière en liste : toujours glissable après la vignette')
  // Remises au cimetière (la liste garde assez de cartes pour défiler plus bas) ; la dernière posée est par-dessus.
  for (const id of [againId, faceId]) await drag(page.locator(`[data-zone="battlefield"] [data-card-id="${id}"]`), listBox.x + listBox.width / 2, listBox.y + listBox.height - 20)
  await list.click({ position: { x: 20, y: 6 } })
  check((await page.getByRole('dialog').innerText()).includes('Cimetière'), 'cimetière en liste : un clic ouvre tout le cimetière')
  // Fenêtre du cimetière : une carte se glisse directement sur le champ de bataille ; la fenêtre s'efface puis revient.
  const fromModal = page.locator('[data-pile-card]').first()
  const fromModalId = await fromModal.getAttribute('data-pile-card')
  const mb = await fromModal.locator('[data-card-id]').boundingBox()
  await page.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2)
  await page.mouse.down()
  await page.mouse.move(mb.x + mb.width / 2 + 10, mb.y + mb.height / 2 + 10, { steps: 5 })
  check((await page.locator('[data-pile-away]').count()) === 1, 'fenêtre du cimetière : effacée pendant le glisser')
  await page.mouse.move(fb.x + 480, fb.y + 120, { steps: 15 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  check((await page.locator(`[data-zone="battlefield"] [data-card-id="${fromModalId}"]`).count()) === 1, 'fenêtre du cimetière : carte glissée sur le champ de bataille')
  check((await page.locator('[data-pile-away]').count()) === 0 && (await page.locator(`[data-pile-card="${fromModalId}"]`).count()) === 0,
    'fenêtre du cimetière : de retour, sans la carte glissée')
  await capture('cimetiere-fenetre-glisser')
  await page.keyboard.press('Escape')
  await drag(page.locator(`[data-zone="battlefield"] [data-card-id="${fromModalId}"]`), listBox.x + listBox.width / 2, listBox.y + listBox.height - 20)

  // Réglage « Image du cimetière » : hauteur de l'illustration ; la liste défile quand elle dépasse.
  check(Math.round((await list.locator('[data-graveyard-art]').first().boundingBox()).height) === 36, 'image du cimetière : moyenne (36 px) par défaut')
  const artSize = async (label) => {
    await page.getByRole('button', { name: 'Réglages' }).click()
    await page.getByLabel('Image du cimetière').selectOption({ label })
    await page.getByRole('button', { name: 'Fermer les réglages' }).click()
  }
  await artSize('Très grande')
  check(Math.round((await list.locator('[data-graveyard-art]').first().boundingBox()).height) === 90, 'image du cimetière : très grande (90 px)')
  const scroller = list.getByTestId('graveyard-list-scroll')
  const overflow = await scroller.evaluate((e) => e.scrollHeight > e.clientHeight + 10)
  check(overflow, 'image du cimetière très grande : la liste dépasse la colonne')
  const oldest = list.locator('[data-card-id]').last()
  const sb = await scroller.boundingBox()
  check((await oldest.boundingBox()).y > sb.y + sb.height, 'avant défilement : la carte la plus ancienne est cachée en bas')
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2)
  await page.mouse.wheel(0, 3000)
  await page.waitForTimeout(300)
  const ob = await oldest.boundingBox()
  check(ob.y >= sb.y - 1 && ob.y + ob.height <= sb.y + sb.height + 1, 'molette : la liste défile jusqu’à la carte la plus ancienne')
  await capture('cimetiere-liste-defile')
  await artSize('Petite')
  check(Math.round((await list.locator('[data-graveyard-art]').first().boundingBox()).height) === 16, 'image du cimetière : petite (16 px)')
  await artSize('Moyenne')

  // ── « Nouvelle partie » en cours de jeu : la table repart du tour 1 avec une main neuve ──
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: /Nouvelle partie/ }).click()
  await page.waitForTimeout(300)
  check((await page.getByTestId('turn').innerText()) === 'Tour 1' && (await battlefieldCount()) === 0 && (await handCount()) === 7
    && await page.locator('[data-testid="mulligan-banner"]').isVisible(), 'nouvelle partie : tour 1, champ de bataille vide, 7 cartes, mulligan proposé')

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ' : ' + errors.join(' | ') : ''}`)
  console.log('\nTout est OK')
} finally {
  await browser.close()
}
