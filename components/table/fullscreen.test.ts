import { describe, expect, it, vi } from 'vitest'
import { en, fr } from '@/lib/i18n/messages'
import { isFullscreen, toggleFullscreen, type FullscreenDoc } from './fullscreen'

const FULLSCREEN_REFUSED = 'Le navigateur a refusé le plein écran.'

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
    expect(await toggleFullscreen(doc, fr)).toBeNull()
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalled()
  })

  it('en sort quand on y est déjà', async () => {
    const doc = fakeDoc({ fullscreenElement: {} })
    expect(await toggleFullscreen(doc, fr)).toBeNull()
    expect(doc.exitFullscreen).toHaveBeenCalled()
  })

  it('refus du navigateur : message en français', async () => {
    const doc = fakeDoc({}, vi.fn(async () => { throw new Error('denied') }))
    expect(await toggleFullscreen(doc, fr)).toBe(FULLSCREEN_REFUSED)
  })

  it('API absente (iPhone) : même message, sans planter', async () => {
    const doc = fakeDoc({ documentElement: {} })
    expect(await toggleFullscreen(doc, fr)).toBe(FULLSCREEN_REFUSED)
  })

  it('en anglais : message en anglais', async () => {
    const doc = fakeDoc({ documentElement: {} })
    expect(await toggleFullscreen(doc, en)).toBe('Your browser blocked full screen.')
  })
})

describe('isFullscreen', () => {
  it('suit fullscreenElement', () => {
    expect(isFullscreen(fakeDoc())).toBe(false)
    expect(isFullscreen(fakeDoc({ fullscreenElement: {} }))).toBe(true)
  })
})
