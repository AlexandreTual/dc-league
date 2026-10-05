import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createToaster } from './toast'

describe('createToaster', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('efface le message après le délai', () => {
    const set = vi.fn()
    const toaster = createToaster(set, 3000)
    toaster.show('Score enregistré')
    expect(set).toHaveBeenLastCalledWith('Score enregistré')
    vi.advanceTimersByTime(3000)
    expect(set).toHaveBeenLastCalledWith('')
  })

  it("le minuteur d'un toast précédent n'efface pas le suivant", () => {
    const set = vi.fn()
    const toaster = createToaster(set, 3000)
    toaster.show('premier')
    vi.advanceTimersByTime(2000)
    toaster.show('second')
    vi.advanceTimersByTime(1500)
    expect(set).toHaveBeenLastCalledWith('second')
    vi.advanceTimersByTime(1500)
    expect(set).toHaveBeenLastCalledWith('')
  })

  it('dispose annule le minuteur en cours', () => {
    const set = vi.fn()
    const toaster = createToaster(set, 3000)
    toaster.show('message')
    toaster.dispose()
    vi.advanceTimersByTime(5000)
    expect(set).toHaveBeenCalledTimes(1)
  })
})
