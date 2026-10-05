import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLongPress, LONG_PRESS_MS, menuPosition, previewBox } from './touch'

describe('createLongPress', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('déclenche après le délai, au point de départ', () => {
    const fire = vi.fn()
    const press = createLongPress(fire)
    press.start(100, 200)
    vi.advanceTimersByTime(LONG_PRESS_MS - 1)
    expect(fire).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fire).toHaveBeenCalledWith(100, 200)
  })

  it('un petit tremblement ne l’annule pas', () => {
    const fire = vi.fn()
    const press = createLongPress(fire)
    press.start(100, 200)
    press.move(105, 205)
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(fire).toHaveBeenCalledOnce()
  })

  it('annulé si le doigt bouge de plus de 8 px', () => {
    const fire = vi.fn()
    const press = createLongPress(fire)
    press.start(100, 200)
    press.move(100, 209)
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(fire).not.toHaveBeenCalled()
  })

  it('annulé si le doigt se lève avant le délai', () => {
    const fire = vi.fn()
    const press = createLongPress(fire)
    press.start(100, 200)
    vi.advanceTimersByTime(200)
    press.cancel()
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(fire).not.toHaveBeenCalled()
  })

  it('un nouvel appui remplace le précédent', () => {
    const fire = vi.fn()
    const press = createLongPress(fire)
    press.start(1, 1)
    vi.advanceTimersByTime(300)
    press.start(50, 60)
    vi.advanceTimersByTime(300)
    expect(fire).not.toHaveBeenCalled()
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(fire).toHaveBeenCalledOnce()
    expect(fire).toHaveBeenCalledWith(50, 60)
  })
})

describe('menuPosition', () => {
  const screen = { width: 375, height: 812 }

  it('au pointeur quand le menu tient', () => {
    expect(menuPosition({ x: 20, y: 30 }, { width: 240, height: 200 }, screen)).toEqual({ left: 20, top: 30, maxHeight: 796 })
  })

  it('remonte et se décale pour rester dans l’écran', () => {
    expect(menuPosition({ x: 300, y: 700 }, { width: 240, height: 200 }, screen)).toEqual({ left: 127, top: 604, maxHeight: 796 })
  })

  it('menu plus haut que l’écran (paysage) : en haut, jamais au-dessus, hauteur bornée', () => {
    const landscape = { width: 812, height: 375 }
    expect(menuPosition({ x: 400, y: 300 }, { width: 240, height: 600 }, landscape)).toEqual({ left: 400, top: 8, maxHeight: 359 })
  })

  it('écran plus étroit que le menu : collé à la marge gauche', () => {
    expect(menuPosition({ x: 100, y: 10 }, { width: 240, height: 100 }, { width: 200, height: 400 }).left).toBe(8)
  })
})

describe('previewBox', () => {
  it('grand écran : à sa place habituelle (rien d’imposé)', () => {
    expect(previewBox({ width: 1440, height: 900 })).toBeNull()
  })

  it('téléphone : centré et borné à l’écran, au format d’une carte', () => {
    const box = previewBox({ width: 375, height: 812 })!
    expect(box.width).toBeLessThanOrEqual(375 - 32)
    expect(box.height).toBeLessThanOrEqual(812 - 32)
    expect(box.left).toBeCloseTo((375 - box.width) / 2)
    expect(box.top).toBeCloseTo((812 - box.height) / 2)
    expect(box.width / box.height).toBeCloseTo(63 / 88, 2)
  })

  it('téléphone en paysage : limité par la hauteur', () => {
    const box = previewBox({ width: 812, height: 375 })!
    expect(box.height).toBe(375 - 32)
    expect(box.left).toBeCloseTo((812 - box.width) / 2)
  })
})
