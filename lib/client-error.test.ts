import { describe, it, expect } from 'vitest'
import { clientErrorEntry, clientErrorReport } from './client-error'

describe("erreurs des pages d'erreur", () => {
  it('reprend le message, le code et la page', () => {
    const error = Object.assign(new Error('boom'), { digest: '4242' })
    expect(clientErrorReport(error, '/ligues/x')).toEqual({ message: 'boom', digest: '4242', path: '/ligues/x' })
    expect(clientErrorReport(new TypeError(''), '/')).toEqual({ message: 'TypeError', digest: null, path: '/' })
  })

  it('transforme le corps reçu en ligne du journal', () => {
    expect(clientErrorEntry({ message: 'boom', digest: '4242', path: '/ligues/x' }, 'u1')).toEqual({
      source: 'navigateur', message: 'boom', digest: '4242', path: '/ligues/x', userId: 'u1',
    })
    expect(clientErrorEntry({ message: 'boom', digest: 12, path: ['x'] }, null)).toEqual({
      source: 'navigateur', message: 'boom', digest: null, path: null, userId: null,
    })
  })

  it('refuse un corps sans message', () => {
    expect(clientErrorEntry({}, null)).toBeNull()
    expect(clientErrorEntry({ message: '  ' }, null)).toBeNull()
    expect(clientErrorEntry({ message: 3 }, null)).toBeNull()
  })
})
