import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createVitest } from 'vitest/node'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Un checkout local contient des worktrees (.claude/, .worktrees/) et des
// node_modules imbriqués : `npm test` ne doit collecter aucun de leurs tests.
const config = path.resolve(__dirname, '..', 'vitest.config.mts')

const fichiers = [
  'lib/a.test.ts',
  'test/b.test.ts',
  '.claude/worktrees/w/lib/c.test.ts',
  '.claude/worktrees/w/node_modules/p/d.test.ts',
  '.worktrees/w/lib/e.test.ts',
  'workers/game/node_modules/p/f.test.ts',
  'node_modules/p/g.test.ts',
  '.next/h.test.ts',
  '.vercel/i.test.ts',
  '.wrangler/j.test.ts',
]

describe('vitest.config.mts', () => {
  let racine: string

  beforeAll(() => {
    racine = mkdtempSync(path.join(tmpdir(), 'vitest-config-'))
    for (const f of fichiers) {
      mkdirSync(path.dirname(path.join(racine, f)), { recursive: true })
      writeFileSync(path.join(racine, f), '')
    }
  })

  afterAll(() => rmSync(racine, { recursive: true, force: true }))

  it('ne collecte que les tests du dépôt, ni worktrees ni node_modules', async () => {
    const vitest = await createVitest('test', { config, root: racine, watch: false })
    try {
      const specs = await vitest.globTestSpecifications()
      const collectes = specs.map((s) => path.relative(racine, s.moduleId).split(path.sep).join('/')).sort()
      expect(collectes).toEqual(['lib/a.test.ts', 'test/b.test.ts'])
    } finally {
      await vitest.close()
    }
  })
})
