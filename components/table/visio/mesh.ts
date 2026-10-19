// Visio : une connexion WebRTC directe avec chaque autre joueur en visio (2 à 5 joueurs), signalisation par le serveur de jeu.
// Un seul des deux pairs ouvre la connexion (isOfferer) ; chaque connexion a dès le départ une voie audio et une voie
// vidéo : couper la caméra ou le micro ne renégocie rien. Descriptions envoyées une fois les candidats réunis (pas de
// candidats au fil de l'eau : peu de messages, sous la limite de débit du serveur).
import { isOfferer, newPeerId, parseSignal, type Signal } from '@/lib/visio/protocol'
import type { RtcServerMessage } from '@/lib/game/room'
import type { VisioChannel } from '../source'

export type Remote = {
  peer: string
  player: string
  stream: MediaStream
  cam: boolean
  mic: boolean
  state: RTCPeerConnectionState
}

type Connection = Remote & { pc: RTCPeerConnection; offerer: boolean }

const GATHER_TIMEOUT_MS = 3000

/** Attend la fin de la collecte des candidats (au plus quelques secondes). */
function gathered(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      pc.removeEventListener('icegatheringstatechange', check)
      resolve()
    }
    const check = () => pc.iceGatheringState === 'complete' && done()
    const timer = setTimeout(done, GATHER_TIMEOUT_MS)
    pc.addEventListener('icegatheringstatechange', check)
  })
}

export class VisioMesh {
  readonly peer = newPeerId()
  /** Joueurs en visio (connus par join, present, hello, state), même quand je n'y suis pas : pour le bouton. */
  readonly present = new Map<string, string>()
  private connections = new Map<string, Connection>()
  private local: MediaStream | null = null
  private joined = false
  cam = false
  mic = false

  constructor(
    private channel: VisioChannel,
    private onChange: () => void,
    private iceServers: () => RTCIceServer[],
  ) {}

  get inCall(): boolean {
    return this.joined
  }

  get localStream(): MediaStream | null {
    return this.local
  }

  remotes(): Remote[] {
    return [...this.connections.values()].map(({ peer, player, stream, cam, mic, state }) => ({ peer, player, stream, cam, mic, state }))
  }

  /** Demande qui est déjà en visio (à l'ouverture de la table). */
  ask(): void {
    this.channel.send(undefined, { kind: 'who', peer: this.peer })
  }

  /** Entre en visio avec ce flux (null : sans caméra ni micro, je vois et j'entends les autres). */
  join(stream: MediaStream | null): void {
    this.local = stream
    this.cam = !!stream?.getVideoTracks().length
    this.mic = !!stream?.getAudioTracks().length
    this.joined = true
    this.announce()
    this.onChange()
  }

  /** Annonce ma présence (à l'entrée, et après une reconnexion au serveur). */
  announce(): void {
    if (this.joined) this.channel.send(undefined, { kind: 'join', peer: this.peer, cam: this.cam, mic: this.mic })
  }

  leave(): void {
    if (!this.joined) return
    this.channel.send(undefined, { kind: 'leave', peer: this.peer })
    this.joined = false
    for (const c of this.connections.values()) c.pc.close()
    this.connections.clear()
    for (const t of this.local?.getTracks() ?? []) t.stop()
    this.local = null
    this.cam = this.mic = false
    this.onChange()
  }

  setCam(on: boolean): void {
    const track = this.local?.getVideoTracks()[0]
    if (!track) return
    track.enabled = on
    this.cam = on
    this.sendState()
  }

  setMic(on: boolean): void {
    const track = this.local?.getAudioTracks()[0]
    if (!track) return
    track.enabled = on
    this.mic = on
    this.sendState()
  }

  /** Oublie les joueurs qui ne sont plus connectés à la partie. */
  keepOnly(online: string[]): void {
    let changed = false
    for (const [peer, player] of this.present) {
      if (!online.includes(player)) {
        this.present.delete(peer)
        changed = true
      }
    }
    for (const c of this.connections.values()) {
      if (!online.includes(c.player)) {
        this.close(c.peer)
        changed = true
      }
    }
    if (changed) this.onChange()
  }

  receive(message: RtcServerMessage): void {
    const signal = parseSignal(message.data)
    if (!signal || signal.peer === this.peer) return
    if ('toPeer' in signal && signal.toPeer !== undefined && signal.toPeer !== this.peer) return
    void this.handle(message.from, signal).catch((e) => console.error('Visio :', e))
  }

  // ── Interne ──────────────────────────────────────────────────────────────

  private async handle(from: string, s: Signal): Promise<void> {
    switch (s.kind) {
      case 'who':
        if (this.joined) this.channel.send(from, { kind: 'present', peer: this.peer, toPeer: s.peer, cam: this.cam, mic: this.mic })
        return
      case 'leave':
        this.present.delete(s.peer)
        this.close(s.peer)
        this.onChange()
        return
      case 'present':
      case 'state':
        this.present.set(s.peer, from)
        this.update(s.peer, s.cam, s.mic)
        this.onChange()
        return
      case 'join':
        this.forgetOtherPeersOf(from, s.peer)
        this.present.set(s.peer, from)
        this.onChange()
        if (!this.joined) return
        if (this.alive(s.peer)) return this.update(s.peer, s.cam, s.mic)
        this.close(s.peer)
        if (isOfferer(this.peer, s.peer)) return this.call(from, s.peer, s.cam, s.mic)
        this.channel.send(from, { kind: 'hello', peer: this.peer, toPeer: s.peer, cam: this.cam, mic: this.mic })
        return
      case 'hello':
        this.present.set(s.peer, from)
        if (this.joined && !this.alive(s.peer) && isOfferer(this.peer, s.peer)) {
          this.close(s.peer)
          await this.call(from, s.peer, s.cam, s.mic)
        }
        this.onChange()
        return
      case 'offer': {
        if (!this.joined || isOfferer(this.peer, s.peer)) return
        this.present.set(s.peer, from)
        const c = this.connections.get(s.peer) ?? this.open(from, s.peer, false, true, true)
        await c.pc.setRemoteDescription({ type: 'offer', sdp: s.sdp })
        for (const t of c.pc.getTransceivers()) {
          const kind = t.receiver.track.kind
          t.direction = 'sendrecv'
          await t.sender.replaceTrack((kind === 'video' ? this.local?.getVideoTracks()[0] : this.local?.getAudioTracks()[0]) ?? null)
        }
        await c.pc.setLocalDescription(await c.pc.createAnswer())
        await gathered(c.pc)
        if (c.pc.localDescription) this.channel.send(from, { kind: 'answer', peer: this.peer, toPeer: s.peer, sdp: c.pc.localDescription.sdp })
        return
      }
      case 'answer': {
        const c = this.connections.get(s.peer)
        if (c?.offerer && c.pc.signalingState === 'have-local-offer') await c.pc.setRemoteDescription({ type: 'answer', sdp: s.sdp })
        return
      }
    }
  }

  /** J'ouvre la connexion : une voie audio et une voie vidéo, puis l'offre. */
  private async call(player: string, peer: string, cam: boolean, mic: boolean): Promise<void> {
    const c = this.open(player, peer, true, cam, mic)
    const video = this.local?.getVideoTracks()[0]
    const audio = this.local?.getAudioTracks()[0]
    c.pc.addTransceiver(audio ?? 'audio', { direction: 'sendrecv' })
    c.pc.addTransceiver(video ?? 'video', { direction: 'sendrecv' })
    await this.offer(c)
  }

  private async offer(c: Connection, iceRestart = false): Promise<void> {
    await c.pc.setLocalDescription(await c.pc.createOffer({ iceRestart }))
    await gathered(c.pc)
    if (c.pc.localDescription && this.connections.get(c.peer) === c) {
      this.channel.send(c.player, { kind: 'offer', peer: this.peer, toPeer: c.peer, sdp: c.pc.localDescription.sdp })
    }
  }

  private open(player: string, peer: string, offerer: boolean, cam: boolean, mic: boolean): Connection {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers() })
    const c: Connection = { peer, player, pc, offerer, stream: new MediaStream(), cam, mic, state: 'new' }
    pc.ontrack = (e) => {
      c.stream.addTrack(e.track)
      // Nouveau flux : les éléments vidéo le reprennent.
      c.stream = new MediaStream(c.stream.getTracks())
      this.onChange()
    }
    pc.onconnectionstatechange = () => {
      if (this.connections.get(peer) !== c) return
      c.state = pc.connectionState
      // Réseau changé ou coupure : celui qui a ouvert relance la recherche d'un chemin.
      if (pc.connectionState === 'failed' && c.offerer) void this.offer(c, true).catch(() => {})
      this.onChange()
    }
    this.connections.set(peer, c)
    return c
  }

  private alive(peer: string): boolean {
    const state = this.connections.get(peer)?.pc.connectionState
    return state !== undefined && state !== 'failed' && state !== 'closed'
  }

  private close(peer: string): void {
    this.connections.get(peer)?.pc.close()
    this.connections.delete(peer)
  }

  /** Un joueur qui revient avec une nouvelle page (rechargement) remplace l'ancienne. */
  private forgetOtherPeersOf(player: string, peer: string): void {
    for (const [p, owner] of this.present) if (owner === player && p !== peer) this.present.delete(p)
    for (const c of [...this.connections.values()]) if (c.player === player && c.peer !== peer) this.close(c.peer)
  }

  private update(peer: string, cam: boolean, mic: boolean): void {
    const c = this.connections.get(peer)
    if (!c) return
    c.cam = cam
    c.mic = mic
  }

  private sendState(): void {
    this.channel.send(undefined, { kind: 'state', peer: this.peer, cam: this.cam, mic: this.mic })
    this.onChange()
  }
}
