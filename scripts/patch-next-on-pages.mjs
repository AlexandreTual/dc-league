// Correctifs appliqués aux dépendances par `postinstall` ; sans effet s'ils sont déjà appliqués.
//
// 1. next-on-pages recopie chaque réponse avec `new Response(body, { ...resp })`, ce qui perd la WebSocket
//    d'une réponse 101 (propriété non copiée par l'étalement). Ce correctif la conserve, pour que
//    /api/games/[id]/ws puisse transmettre la connexion du Durable Object au navigateur.
//    Échoue si le code visé a changé (la version de next-on-pages est figée).
//
// 2. Next 15.5 ne retrouve plus `app/not-found.tsx` au build (le filtre reçoit un chemin relatif alors
//    qu'il attend un chemin absolu) : la route /_not-found perd `runtime = 'edge'` et next-on-pages
//    refuse alors de construire le site. Ce correctif rend le chemin absolu.
//    Simple avertissement si le code visé a changé : le build next-on-pages signalera le problème s'il existe encore.
import { readFileSync, writeFileSync } from 'node:fs'

const PATCHES = [
  {
    name: 'WebSocket (next-on-pages)',
    file: 'node_modules/@cloudflare/next-on-pages/templates/_worker.js/handleRequest.ts',
    mark: 'webSocket: resp.webSocket',
    before: `\t\theaders: newHeaders,\n\t});\n\n\treturn resp;`,
    after: `\t\theaders: newHeaders,\n\t\twebSocket: resp.webSocket,\n\t} as ResponseInit);\n\n\treturn resp;`,
    required: true,
  },
  {
    name: 'page not-found (next)',
    file: 'node_modules/next/dist/build/entries.js',
    mark: 'validFileMatcher.isRootNotFound((0, _path.join)(appDir, absolutePath))',
    before:
      'const appPaths = allAppFiles.filter((absolutePath)=>validFileMatcher.isAppRouterPage(absolutePath) || validFileMatcher.isRootNotFound(absolutePath));',
    after:
      'const appPaths = allAppFiles.filter((absolutePath)=>validFileMatcher.isAppRouterPage(absolutePath) || validFileMatcher.isRootNotFound((0, _path.join)(appDir, absolutePath)));',
    required: false,
  },
]

let failed = false
for (const p of PATCHES) {
  let source
  try {
    source = readFileSync(p.file, 'utf8')
  } catch {
    console.log(`Correctif ${p.name} : fichier absent, ignoré`)
    continue
  }
  if (source.includes(p.mark)) continue
  if (!source.includes(p.before)) {
    const message = `Correctif ${p.name} : code inattendu dans ${p.file}. Vérifie la version installée.`
    if (p.required) {
      console.error(message)
      failed = true
    } else {
      console.warn(message)
    }
    continue
  }
  writeFileSync(p.file, source.replace(p.before, p.after))
  console.log(`Correctif ${p.name} appliqué`)
}
if (failed) process.exit(1)
