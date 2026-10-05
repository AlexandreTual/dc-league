// next-on-pages recopie chaque réponse avec `new Response(body, { ...resp })`, ce qui perd la WebSocket
// d'une réponse 101 (propriété non copiée par l'étalement). Ce correctif la conserve, pour que
// /api/games/[id]/ws puisse transmettre la connexion du Durable Object au navigateur.
// Lancé par `postinstall` ; sans effet s'il est déjà appliqué ; échoue si le code visé a changé.
import { readFileSync, writeFileSync } from 'node:fs'

const file = 'node_modules/@cloudflare/next-on-pages/templates/_worker.js/handleRequest.ts'
const MARK = 'webSocket: resp.webSocket'
const BEFORE = `\t\theaders: newHeaders,\n\t});\n\n\treturn resp;`
const AFTER = `\t\theaders: newHeaders,\n\t\t${MARK},\n\t} as ResponseInit);\n\n\treturn resp;`

let source
try {
  source = readFileSync(file, 'utf8')
} catch {
  console.log('next-on-pages absent : correctif ignoré')
  process.exit(0)
}
if (source.includes(MARK)) process.exit(0)
if (!source.includes(BEFORE)) {
  console.error(`Correctif WebSocket : code inattendu dans ${file}. Vérifie la version de @cloudflare/next-on-pages.`)
  process.exit(1)
}
writeFileSync(file, source.replace(BEFORE, AFTER))
console.log('Correctif WebSocket appliqué à next-on-pages')
