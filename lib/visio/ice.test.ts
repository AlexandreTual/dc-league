import { describe, it, expect } from 'vitest'
import { DEFAULT_ICE_SERVERS, iceServersFor, parseTurnResponse } from './ice'

describe('parseTurnResponse', () => {
  it('lit une liste ou un objet, écarte le port 53', () => {
    const json = {
      iceServers: [
        { urls: ['stun:stun.cloudflare.com:3478'] },
        { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:53?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'u', credential: 'c' },
      ],
    }
    expect(parseTurnResponse(json)).toEqual([
      { urls: ['stun:stun.cloudflare.com:3478'] },
      { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'u', credential: 'c' },
    ])
    expect(parseTurnResponse({ iceServers: { urls: 'turn:x:3478', username: 'u', credential: 'c' } })).toEqual([{ urls: ['turn:x:3478'], username: 'u', credential: 'c' }])
  })

  it('null pour une réponse inattendue', () => {
    expect(parseTurnResponse(null)).toBeNull()
    expect(parseTurnResponse({ iceServers: [{ urls: 3 }] })).toBeNull()
    expect(parseTurnResponse({ iceServers: [{ urls: ['turn:x:53'] }] })).toBeNull()
  })
})

describe('iceServersFor', () => {
  it('STUN seuls sans clés, sans appel', async () => {
    let called = false
    expect(await iceServersFor({}, (async () => { called = true; return new Response() }) as typeof fetch)).toBe(DEFAULT_ICE_SERVERS)
    expect(called).toBe(false)
  })

  it('ajoute les relais TURN de Cloudflare', async () => {
    const calls: [string, RequestInit][] = []
    const fetcher = (async (url: string, init: RequestInit) => {
      calls.push([url, init])
      return Response.json({ iceServers: [{ urls: ['turn:t:3478'], username: 'u', credential: 'c' }] })
    }) as unknown as typeof fetch
    const servers = await iceServersFor({ TURN_KEY_ID: 'cle', TURN_KEY_API_TOKEN: 'jeton' }, fetcher)
    expect(servers).toEqual([...DEFAULT_ICE_SERVERS, { urls: ['turn:t:3478'], username: 'u', credential: 'c' }])
    expect(calls[0][0]).toBe('https://rtc.live.cloudflare.com/v1/turn/keys/cle/credentials/generate-ice-servers')
    expect((calls[0][1].headers as Record<string, string>).Authorization).toBe('Bearer jeton')
  })

  it('STUN seuls si Cloudflare échoue', async () => {
    const failing = (async () => new Response('non', { status: 401 })) as unknown as typeof fetch
    const throwing = (async () => { throw new Error('réseau') }) as unknown as typeof fetch
    expect(await iceServersFor({ TURN_KEY_ID: 'a', TURN_KEY_API_TOKEN: 'b' }, failing)).toBe(DEFAULT_ICE_SERVERS)
    expect(await iceServersFor({ TURN_KEY_ID: 'a', TURN_KEY_API_TOKEN: 'b' }, throwing)).toBe(DEFAULT_ICE_SERVERS)
  })
})
