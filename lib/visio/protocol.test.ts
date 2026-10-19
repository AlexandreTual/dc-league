import { describe, it, expect } from 'vitest'
import {
  PANEL_DEFAULT_WIDTH, PANEL_MAX_WIDTH, PANEL_MIN_WIDTH, VISIO_MSG, clampPanelWidth, isOfferer, loadPanelWidth,
  mediaErrorMessage, newPeerId, parseSignal, savePanelWidth, tileColumns,
} from './protocol'

const A = 'aaaaaaaa'
const B = 'bbbbbbbb'

describe('parseSignal', () => {
  it('accepte chaque sorte de message', () => {
    expect(parseSignal({ kind: 'join', peer: A, cam: true, mic: false })).toEqual({ kind: 'join', peer: A, cam: true, mic: false })
    expect(parseSignal({ kind: 'present', peer: A, toPeer: B, cam: true, mic: true })).toEqual({ kind: 'present', peer: A, toPeer: B, cam: true, mic: true })
    expect(parseSignal({ kind: 'hello', peer: A, toPeer: B, cam: false, mic: true })).toEqual({ kind: 'hello', peer: A, toPeer: B, cam: false, mic: true })
    expect(parseSignal({ kind: 'offer', peer: A, toPeer: B, sdp: 'v=0' })).toEqual({ kind: 'offer', peer: A, toPeer: B, sdp: 'v=0' })
    expect(parseSignal({ kind: 'leave', peer: A, extra: 1 })).toEqual({ kind: 'leave', peer: A })
    expect(parseSignal({ kind: 'who', peer: A })).toEqual({ kind: 'who', peer: A })
  })

  it('refuse les messages malformés ou inconnus', () => {
    expect(parseSignal(null)).toBeNull()
    expect(parseSignal({ kind: 'join', peer: 'A!', cam: true, mic: true })).toBeNull()
    expect(parseSignal({ kind: 'join', peer: A, cam: 'oui', mic: true })).toBeNull()
    expect(parseSignal({ kind: 'hello', peer: A, cam: true, mic: true })).toBeNull()
    expect(parseSignal({ kind: 'offer', peer: A, toPeer: B })).toBeNull()
    expect(parseSignal({ kind: 'answer', peer: A, toPeer: B, sdp: 'x'.repeat(20_000) })).toBeNull()
    expect(parseSignal({ kind: 'chat', peer: A })).toBeNull()
  })
})

it('un seul des deux pairs ouvre la connexion', () => {
  expect(isOfferer(A, B)).toBe(true)
  expect(isOfferer(B, A)).toBe(false)
})

it('identifiant de pair valide', () => {
  expect(parseSignal({ kind: 'who', peer: newPeerId() })).not.toBeNull()
  expect(newPeerId(() => 0)).toBe('0'.repeat(16))
})

describe('fenêtre', () => {
  it('borne la largeur à la place disponible', () => {
    expect(clampPanelWidth(50, 1200)).toBe(PANEL_MIN_WIDTH)
    expect(clampPanelWidth(5000, 1200)).toBe(PANEL_MAX_WIDTH)
    expect(clampPanelWidth(5000, 500)).toBe(484)
    expect(clampPanelWidth(300.4, 1200)).toBe(300)
    expect(clampPanelWidth(300, 100)).toBe(PANEL_MIN_WIDTH)
  })

  it('une colonne pour un adversaire, deux au-delà', () => {
    expect(tileColumns(1)).toBe(1)
    expect(tileColumns(2)).toBe(2)
    expect(tileColumns(4)).toBe(2)
  })

  it('retient la largeur, défaut si absente ou stockage indisponible', () => {
    const data = new Map<string, string>()
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
    expect(loadPanelWidth(storage)).toBe(PANEL_DEFAULT_WIDTH)
    savePanelWidth(storage, 333.6)
    expect(loadPanelWidth(storage)).toBe(334)
    const broken = { getItem: () => { throw new Error('bloqué') }, setItem: () => { throw new Error('bloqué') } }
    expect(loadPanelWidth(broken)).toBe(PANEL_DEFAULT_WIDTH)
    expect(() => savePanelWidth(broken, 300)).not.toThrow()
  })
})

it('messages d’erreur de la caméra en français', () => {
  expect(mediaErrorMessage({ name: 'NotAllowedError' })).toBe(VISIO_MSG.denied)
  expect(mediaErrorMessage({ name: 'NotFoundError' })).toBe(VISIO_MSG.noDevice)
  expect(mediaErrorMessage(new Error('x'))).toBe(VISIO_MSG.failed)
})
