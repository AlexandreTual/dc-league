import { describe, expect, it, vi } from 'vitest'
import { FULLSCREEN_REFUSED, isFullscreen, toggleFullscreen, type FullscreenDoc } from './fullscreen'

function fakeDoc(over: Partial<FullscreenDoc> = {}, request = vi.fn(async () => {})): FullscreenDoc {
  return {
    fullscreenElement: null,
    exitFullscreen: vi.fn(async () => {}),
    documentElement: { requestFullscreen: request },
    ...over,
  }
}

describe('toggleFullscreen', () => {
  it('entre en plein écran sur toute la page', async () => {
    const doc = fakeDoc()
    expect(await toggleFullscreen(doc)).toBeNull()
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalled()
  })

  it('en sort quand on y est déjà', async () => {
    const doc = fakeDoc({ fullscreenElement: {} })
    expect(await toggleFullscreen(doc)).toBeNull()
    expect(doc.exitFullscreen).toHaveBeenCalled()
  })

  it('refus du navigateur : message en français', async () => {
    const doc = fakeDoc({}, vi.fn(async () => { throw new Error('denied') }))
    expect(await toggleFullscreen(doc)).toBe(FULLSCREEN_REFUSED)
  })

  it('API absente (iPhone) : même message, sans planter', async () => {
    const doc = fakeDoc({ documentElement: {} })
    expect(await toggleFullscreen(doc)).toBe(FULLSCREEN_REFUSED)
  })
})

describe('isFullscreen', () => {
  it('suit fullscreenElement', () => {
    expect(isFullscreen(fakeDoc())).toBe(false)
    expect(isFullscreen(fakeDoc({ fullscreenElement: {} }))).toBe(true)
  })
})
