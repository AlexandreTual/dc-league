import type { GameAction, Seed } from './types'

/**
 * Ancien générateur mulberry32 (état de 32 bits) : gardé uniquement pour rejouer les parties
 * commencées avec une graine numérique. Trop petit pour cacher le hasard (force brute en 2³²).
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Générateur sfc32 : état de 128 bits. */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  const next = () => {
    const t = (((a + b) | 0) + d) | 0
    d = (d + 1) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }
  for (let i = 0; i < 15; i++) next()
  return next
}

/** 128 bits tirés d'un texte quelconque (cyrb128), pour une graine qui n'est pas en hexadécimal. */
function hash128(text: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}

const HEX_128 = /^[0-9a-f]{32}$/

/**
 * Même graine, même suite de valeurs dans [0, 1).
 * Graine numérique : ancien générateur 32 bits (parties existantes) ; graine texte : sfc32, 128 bits.
 */
export function createRng(seed: Seed): () => number {
  if (typeof seed === 'number') return mulberry32(seed)
  const words = HEX_128.test(seed)
    ? ([0, 8, 16, 24].map((i) => parseInt(seed.slice(i, i + 8), 16)) as [number, number, number, number])
    : hash128(seed)
  return sfc32(...words)
}

/** Nouvelle graine de 128 bits tirée par le générateur cryptographique (32 chiffres hexadécimaux). */
export function randomSeed(): string {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => n.toString(16).padStart(8, '0')).join('')
}

/** Début de partie : une graine pour l'ordre du tour, une graine indépendante par joueur, et le premier joueur choisi s'il y en a un. */
export function startAction(playerIds: readonly string[], seed: () => Seed = randomSeed, first?: string): Extract<GameAction, { type: 'start' }> {
  const turnSeed = seed()
  const action: Extract<GameAction, { type: 'start' }> = { type: 'start', actor: 'server', seed: turnSeed, seeds: Object.fromEntries(playerIds.map((id) => [id, seed()])) }
  return first === undefined ? action : { ...action, first }
}

/** Mélange de Fisher-Yates sur une copie, déterministe pour une graine donnée. */
export function shuffle<T>(items: readonly T[], seed: Seed): T[] {
  const rng = createRng(seed)
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
