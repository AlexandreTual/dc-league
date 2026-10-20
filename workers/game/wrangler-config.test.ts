import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const config = readFileSync(fileURLToPath(new URL('./wrangler.toml', import.meta.url)), 'utf8')

describe('configuration du Worker de jeu', () => {
  it('garde ses journaux (Workers Logs)', () => {
    expect(config).toMatch(/^\[observability\]\s*\nenabled = true$/m)
  })
})
