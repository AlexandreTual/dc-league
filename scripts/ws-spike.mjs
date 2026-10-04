// Vérifie, dans un vrai navigateur, que le site transmet une WebSocket au Durable Object de la table.
// Usage : node scripts/ws-spike.mjs <url-de-base> <cookie dc_session>
import { chromium } from 'playwright-core'

const [base = 'http://localhost:8788', session] = process.argv.slice(2)
if (!session) throw new Error('cookie dc_session manquant')

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
try {
  const context = await browser.newContext()
  await context.addCookies([{ name: 'dc_session', value: session, url: base }])
  const page = await context.newPage()
  await page.goto(base)
  const reply = await page.evaluate((url) => new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    setTimeout(() => reject(new Error('pas de réponse en 10 s')), 10_000)
    ws.onopen = () => ws.send('ping')
    ws.onmessage = (e) => { resolve(e.data); ws.close() }
    ws.onerror = () => reject(new Error('erreur WebSocket'))
  }), `${base.replace(/^http/, 'ws')}/api/games/t1/ws`)
  console.log(`écho reçu : ${reply}`)
} finally {
  await browser.close()
}
