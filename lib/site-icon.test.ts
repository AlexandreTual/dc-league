import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Déclarés dans les metadata de app/layout.tsx (onglet du navigateur, raccourci sur mobile).
describe('icône du site', () => {
  it('public/icon.svg est un SVG carré aux couleurs du site', () => {
    const svg = readFileSync(join(__dirname, '../public/icon.svg'), 'utf8')
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64">/)
    expect(svg).toContain('#c9a84c')
    expect(svg).toContain('#0a0a0f')
  })

  it('public/apple-icon.png est une image PNG de 180×180', () => {
    const png = readFileSync(join(__dirname, '../public/apple-icon.png'))
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(180)
    expect(png.readUInt32BE(20)).toBe(180)
  })
})
