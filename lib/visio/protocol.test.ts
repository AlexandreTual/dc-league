import { describe, it, expect } from 'vitest'
import {
  PANEL_DEFAULT_POSITION, PANEL_DEFAULT_WIDTH, PANEL_MAX_WIDTH, PANEL_MIN_WIDTH, VISIO_MSG, clampPanelPosition, clampPanelWidth, isOfferer,
  loadPanelPosition, loadPanelWidth, savePanelPosition,
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

describe('position de la fenêtre', () => {
  const area = { width: 1000, height: 700 }
  const size = { width: 240, height: 200 }

  it('reste dans la zone de jeu, à 8 px des bords au moins', () => {
    expect(clampPanelPosition({ right: 100, top: 50 }, size, area)).toEqual({ right: 100, top: 50 })
    expect(clampPanelPosition({ right: -50, top: -20 }, size, area)).toEqual({ right: 8, top: 8 })
    expect(clampPanelPosition({ right: 5000, top: 5000 }, size, area)).toEqual({ right: 752, top: 492 })
    expect(clampPanelPosition({ right: 100.6, top: 50.2 }, size, area)).toEqual({ right: 101, top: 50 })
  })

  it('fenêtre plus grande que la zone : collée en haut à droite', () => {
    expect(clampPanelPosition({ right: 300, top: 300 }, { width: 1200, height: 900 }, area)).toEqual({ right: 8, top: 8 })
  })

  it('retient la position, défaut en haut à droite si absente ou invalide', () => {
    const data = new Map<string, string>()
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
    expect(loadPanelPosition(storage)).toEqual(PANEL_DEFAULT_POSITION)
    savePanelPosition(storage, { right: 320.4, top: 40 })
    expect(loadPanelPosition(storage)).toEqual({ right: 320, top: 40 })
    data.set('dc-visio-position', '{"right":"a"}')
    expect(loadPanelPosition(storage)).toEqual(PANEL_DEFAULT_POSITION)
    const broken = { getItem: () => { throw new Error('bloqué') }, setItem: () => { throw new Error('bloqué') } }
    expect(loadPanelPosition(broken)).toEqual(PANEL_DEFAULT_POSITION)
    expect(() => savePanelPosition(broken, { right: 8, top: 8 })).not.toThrow()
  })
})
