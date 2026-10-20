import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ErrorPage from './error'
import GlobalError from './global-error'

vi.mock('./globals.css', () => ({}))

const reset = () => {}

describe("pages d'erreur", () => {
  it('affichent le code reçu à transmettre', () => {
    const error = Object.assign(new Error('boom'), { digest: '1234567890' })
    for (const page of [ErrorPage, GlobalError]) {
      const html = renderToStaticMarkup(createElement(page, { error, reset }))
      expect(html).toContain('Code à transmettre')
      expect(html).toContain('1234567890')
      expect(html).not.toContain('boom')
    }
  })

  it("n'affichent pas de code quand il n'y en a pas", () => {
    const html = renderToStaticMarkup(createElement(ErrorPage, { error: new Error('boom'), reset }))
    expect(html).not.toContain('Code à transmettre')
  })
})
