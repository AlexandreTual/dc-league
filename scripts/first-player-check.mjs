// Qui commence (issue #100) dans de vrais navigateurs : premier joueur choisi par l'hôte, puis tirage au sort.
// Prérequis : ceux de scripts/online-check.mjs (Worker, site, données de seed-online.mjs).
// Usage : node scripts/first-player-check.mjs <url-de-base> <dossier-captures>
import { chromium } from 'playwright-core'
import { PLAYERS, tokenOf } from './seed-online.mjs'

const [base = 'http://localhost:8788', outDir = '.'] = process.argv.slice(2)
const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const [ANA, BASTIEN, CHLOE] = PLAYERS

const browser = await chromium.launch({ executablePath })
const errors = []

function check(condition, message) {
  if (!condition) throw new Error(`ÉCHEC : ${message}`)
  console.log(`✓ ${message}`)
}

async function openAs(player, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 500 })
  await context.addCookies([{ name: 'dc_session', value: tokenOf(player.id), url: base }])
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(`${player.name} : ${e.message}`))
  page.on('dialog', (d) => d.accept(d.defaultValue()))
  return { ...player, page }
}

let shot = 0
async function capture(page, label) {
  shot++
  const path = `${outDir}/first-${shot}-${label}.png`
  await page.screenshot({ path })
  console.log(`📸 ${path}`)
}

/** Table créée par `host`, rejointe par les autres, decks choisis ; renvoie après le clic sur « Démarrer ». */
async function startTable(host, others, firstPlayer) {
  await host.page.goto(`${base}/salon`)
  await host.page.getByRole('combobox').nth(1).selectOption(String(others.length + 1))
  await host.page.getByRole('button', { name: 'Créer la table' }).click()
  await host.page.waitForURL(/\/tables\//)
  const url = host.page.url()
  for (const who of [host, ...others]) {
    if (who !== host) {
      await who.page.goto(url)
      await who.page.getByRole('button', { name: 'Rejoindre la table' }).click()
    }
    await who.page.getByTestId('deck-select').selectOption(`deck-${who.id}`)
    await who.page.locator(`[data-seat="${who.id}"]`).getByText(`Kenrith de ${who.name}`).waitFor()
  }
  await host.page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent === 'Démarrer la partie')
    return b && !b.disabled
  }, null, { timeout: 10_000 })
  const select = host.page.getByTestId('first-player-select')
  check((await select.inputValue()) === '', 'salle d’attente : « Tirage au sort » par défaut')
  if (firstPlayer) await select.selectOption(firstPlayer.id)
  if (firstPlayer) await capture(host.page, 'salle-attente-choix')
  await host.page.getByRole('button', { name: 'Démarrer la partie' }).click()
}

const ranks = async (page) => {
  const out = {}
  for (const panel of await page.locator('[data-panel]').all()) {
    const rank = panel.getByTestId('turn-rank')
    if (await rank.count()) out[await panel.getAttribute('data-panel')] = Number(await rank.first().innerText())
  }
  return out
}

try {
  // ── Premier joueur choisi par l'hôte (3 joueurs) ──
  const ana = await openAs(ANA)
  const bastien = await openAs(BASTIEN)
  const chloe = await openAs(CHLOE, { width: 375, height: 812 })
  await startTable(ana, [bastien, chloe], CHLOE)
  for (const who of [ana, bastien, chloe]) {
    await who.page.getByTestId('start-draw-first').waitFor({ timeout: 10_000 })
    const first = await who.page.getByTestId('start-draw-first').innerText()
    const text = await who.page.getByTestId('start-draw').innerText()
    check(first === CHLOE.name && text.includes("choisi par l'hôte"), `${who.name} : « Chloé commence (choisi par l'hôte) »`)
    const order = await who.page.getByTestId('start-draw-order').locator('li').allInnerTexts()
    check(order.length === 3 && order[0].includes(CHLOE.name), `${who.name} : ordre du tour affiché, Chloé en 1`)
  }
  await capture(chloe.page, 'choix-hote-telephone')
  await chloe.page.getByRole('button', { name: "C'est parti" }).click()
  check(!(await chloe.page.getByTestId('start-draw').isVisible()), 'Chloé : « C’est parti » ferme la fenêtre')
  await ana.page.keyboard.press('Escape')
  await ana.page.getByTestId('start-draw').waitFor({ state: 'detached' })
  check(true, 'Ana : Échap ferme la fenêtre')
  check((await ana.page.getByTestId('active-player').innerText()).includes(CHLOE.name), 'Chloé est la joueuse active')
  const r = await ranks(ana.page)
  check(r[CHLOE.id] === 1 && Object.keys(r).length === 3 && new Set(Object.values(r)).size === 3, `numéros d’ordre sur chaque joueur (${JSON.stringify(r)})`)
  await capture(ana.page, 'numeros-ordre')
  await ana.page.reload()
  await ana.page.locator('[data-panel]').first().waitFor()
  await ana.page.waitForTimeout(500)
  check(await ana.page.getByTestId('start-draw').isVisible(), 'rechargement pendant la main de départ : la fenêtre revient')
  await ana.page.mouse.click(5, 5)
  await ana.page.getByTestId('start-draw').waitFor({ state: 'detached' })
  await ana.page.getByRole('button', { name: 'Garder' }).click()
  await ana.page.reload()
  await ana.page.locator('[data-panel]').first().waitFor()
  await ana.page.waitForTimeout(500)
  check(!(await ana.page.getByTestId('start-draw').isVisible()), 'main gardée : plus de fenêtre au rechargement')

  // ── Tirage au sort (2 joueurs) ──
  await ana.page.goto(`${base}/salon`)
  await startTable(bastien, [ana])
  await bastien.page.getByTestId('start-draw').waitFor({ timeout: 10_000 })
  const rolling = await bastien.page.getByTestId('start-draw-name').isVisible()
  check(rolling, 'tirage au sort : les noms défilent')
  await capture(bastien.page, 'defilement')
  await bastien.page.getByTestId('start-draw-first').waitFor({ timeout: 6000 })
  const drawn = await bastien.page.getByTestId('start-draw-first').innerText()
  check((await bastien.page.getByTestId('start-draw').innerText()).includes('tirage au sort'), `arrêt sur ${drawn}, « tirage au sort »`)
  await capture(bastien.page, 'resultat-tirage')
  await bastien.page.getByRole('button', { name: "C'est parti" }).click()
  check((await bastien.page.getByTestId('active-player').innerText()).includes(drawn), 'le nom affiché est bien le joueur actif')

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` : ${errors.join(' | ')}` : ''}`)
} finally {
  await browser.close()
}
