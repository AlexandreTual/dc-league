import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendJson } from './formStyles'

describe('sendJson', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renvoie les données quand la réponse est correcte', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'd1' }), { status: 200 })))
    expect(await sendJson('/api/x', 'POST', { a: 1 })).toEqual({ error: null, data: { id: 'd1' } })
  })

  it("renvoie le message d'erreur de l'API", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Nom déjà pris' }), { status: 400 })))
    expect((await sendJson('/api/x', 'POST')).error).toBe('Nom déjà pris')
  })

  it('renvoie un message en français pour une page 500 en HTML', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Internal Server Error</html>', { status: 500 })))
    expect((await sendJson('/api/x', 'DELETE')).error).toBe('Une erreur est survenue')
  })

  it('renvoie « Erreur réseau » quand la requête échoue', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))
    expect((await sendJson('/api/x', 'GET')).error).toBe('Erreur réseau')
  })
})
