import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Les scripts navigateur passent tous par scripts/browser.mjs pour trouver Chromium (#254).
const dir = path.join(__dirname, '..', 'scripts')
const scripts = readdirSync(dir).filter((f) => f.endsWith('.mjs') && f !== 'browser.mjs')

describe('scripts navigateur', () => {
  it('trouve des scripts à contrôler', () => {
    expect(scripts.length).toBeGreaterThan(10)
  })

  it.each(scripts)('%s lance Chromium via scripts/browser.mjs', (file) => {
    const source = readFileSync(path.join(dir, file), 'utf8')
    expect(source).not.toMatch(/chromium\s*\.\s*launch/)
    expect(source).not.toMatch(/CHROMIUM_PATH/)
  })

  it('browser.mjs lit CHROME puis CHROMIUM_PATH', () => {
    const source = readFileSync(path.join(dir, 'browser.mjs'), 'utf8')
    expect(source).toMatch(/process\.env\.CHROME \?\? process\.env\.CHROMIUM_PATH \?\?/)
  })
})
