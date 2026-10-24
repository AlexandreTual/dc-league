import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

// Le Worker de jeu n'est redéployé que si la fusion touche un fichier couvert
// par les `paths` de l'Action : chaque fichier du dépôt qu'il importe (même
// indirectement) doit donc l'être, sinon le Worker de production garde
// l'ancien code (issue #202).
const racine = path.resolve(__dirname, '..', '..')
const workflow = path.join(racine, '.github/workflows/deploy-game-worker.yml')
const entree = path.join(racine, 'workers/game/index.ts')

/** Motifs de `on.push.paths` (lecture simple du YAML, sans dépendance). */
function motifsDuWorkflow(): string[] {
  const lignes = readFileSync(workflow, 'utf8').split('\n')
  const debut = lignes.findIndex((l) => /^\s+paths:\s*$/.test(l))
  if (debut < 0) throw new Error('`paths:` introuvable dans le workflow')
  const motifs: string[] = []
  for (const ligne of lignes.slice(debut + 1)) {
    const m = ligne.match(/^\s+-\s+['"]?([^'"]+?)['"]?\s*$/)
    if (!m) break
    motifs.push(m[1])
  }
  return motifs
}

/** Glob GitHub Actions simplifié : `**` = n'importe quel chemin, `*` = un segment. */
function versRegex(motif: string): RegExp {
  const echappe = motif.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const corps = echappe.replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*')
  return new RegExp(`^${corps}$`)
}

/** Fichiers du dépôt atteints depuis l'entrée du Worker (imports, y compris de types). */
function fermetureDesImports(): string[] {
  const options: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    resolveJsonModule: true,
    allowJs: true,
    baseUrl: racine,
    paths: { '@/*': ['./*'] },
  }
  const vus = new Set<string>()
  const aVisiter = [entree]
  while (aVisiter.length) {
    const fichier = aVisiter.pop()!
    if (vus.has(fichier)) continue
    vus.add(fichier)
    const { importedFiles } = ts.preProcessFile(readFileSync(fichier, 'utf8'), true, true)
    for (const { fileName } of importedFiles) {
      const r = ts.resolveModuleName(fileName, fichier, options, ts.sys).resolvedModule
      if (!r || r.isExternalLibraryImport) continue
      const cible = path.resolve(r.resolvedFileName)
      if (cible.includes(`${path.sep}node_modules${path.sep}`)) continue
      aVisiter.push(cible)
    }
  }
  return [...vus].map((f) => path.relative(racine, f).split(path.sep).join('/')).sort()
}

describe('déclenchement du déploiement du Worker de jeu', () => {
  it('lit les motifs et trouve des imports hors de workers/', () => {
    expect(motifsDuWorkflow()).toContain('workers/**')
    expect(fermetureDesImports().some((f) => f.startsWith('lib/'))).toBe(true)
  })

  it('chaque fichier importé par le Worker est couvert par un motif `paths`', () => {
    const motifs = motifsDuWorkflow().map(versRegex)
    const oublies = fermetureDesImports().filter((f) => !motifs.some((m) => m.test(f)))
    expect(oublies).toEqual([])
  })
})
