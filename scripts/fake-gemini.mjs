// Faux serveur Gemini pour les vérifications locales de l'assistant IA (aucune requête ne part chez Google).
// Le site doit être lancé avec, dans `.dev.vars` :
//   GEMINI_API_KEY=test
//   GEMINI_BASE_URL=http://localhost:8790
// Réponses : « Réponse de test pour : <question> » (avec une liste et du gras), HTTP 429 si la question contient
// `#quota`, 35 s d'attente (plus que le délai du site) si elle contient `#lent`.
// Usage seul : node scripts/fake-gemini.mjs [port]   — ou importé : startFakeGemini(port).
import http from 'node:http'
import { fileURLToPath } from 'node:url'

export const FAKE_GEMINI_PORT = 8790

/** Démarre le faux serveur ; `requests` garde chaque requête reçue (adresse, en-tête de clé, corps). */
export function startFakeGemini(port = FAKE_GEMINI_PORT) {
  const requests = []
  const server = http.createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      let body = {}
      try { body = JSON.parse(raw) } catch { /* corps illisible : réponse vide */ }
      requests.push({ url: req.url, key: req.headers['x-goog-api-key'], body })
      const last = body.contents?.at(-1)?.parts?.[0]?.text ?? ''
      const question = last.split('\n').at(-1)
      res.setHeader('content-type', 'application/json')
      if (question.includes('#panne')) {
        res.statusCode = 503
        return res.end(JSON.stringify({ error: { status: 'UNAVAILABLE' } }))
      }
      if (question.includes('#quota')) {
        res.statusCode = 429
        return res.end(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED' } }))
      }
      const answer = `Réponse de test pour : ${question}\n\n- **Étape 1** : la carte arrive sur la pile\n- Étape 2 : <b>pas de HTML</b>`
      const reply = () => res.end(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: answer }] }, finishReason: 'STOP' }] }))
      setTimeout(reply, question.includes('#lent') ? 35_000 : 300)
    })
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, () => resolve({ requests, close: () => new Promise((r) => server.close(r)) }))
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? FAKE_GEMINI_PORT)
  await startFakeGemini(port)
  console.log(`Faux Gemini sur http://localhost:${port}`)
}
