// Visio entre joueurs d'une partie en ligne : messages de signalisation WebRTC (relayés par le serveur de jeu).
// Chaque page en visio a un identifiant tiré au hasard (`peer`) : un rechargement donne un nouveau pair.

/**
 * - `join` (à tous) : j'entre en visio ; `present` (à un joueur) : réponse à `who`, je suis en visio.
 * - `who` (à tous) : qui est en visio ? (à l'ouverture de la table, pour le bouton) ;
 * - `hello` (à un pair) : réponse à `join`, je suis aussi en visio, à toi d'ouvrir la connexion ;
 * - `offer` / `answer` (à un pair) : description de session, candidats compris ;
 * - `state` (à tous) : caméra ou micro coupé ; `leave` (à tous) : je quitte la visio.
 */
export type Signal =
  | { kind: 'join' | 'present' | 'state'; peer: string; cam: boolean; mic: boolean; toPeer?: string }
  | { kind: 'hello'; peer: string; toPeer: string; cam: boolean; mic: boolean }
  | { kind: 'offer' | 'answer'; peer: string; toPeer: string; sdp: string }
  | { kind: 'who' | 'leave'; peer: string }

const MAX_SDP = 12_000
const isPeer = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9]{6,32}$/.test(v)

/** Signal valide, ou null (message d'un client plus récent ou malformé : ignoré). */
export function parseSignal(data: unknown): Signal | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (!isPeer(d.peer)) return null
  const peer = d.peer
  switch (d.kind) {
    case 'who':
    case 'leave':
      return { kind: d.kind, peer }
    case 'join':
    case 'present':
    case 'state':
    case 'hello': {
      if (typeof d.cam !== 'boolean' || typeof d.mic !== 'boolean') return null
      if (d.kind === 'hello') return isPeer(d.toPeer) ? { kind: 'hello', peer, toPeer: d.toPeer, cam: d.cam, mic: d.mic } : null
      const signal: Signal = { kind: d.kind, peer, cam: d.cam, mic: d.mic }
      return isPeer(d.toPeer) ? { ...signal, toPeer: d.toPeer } : signal
    }
    case 'offer':
    case 'answer':
      if (!isPeer(d.toPeer) || typeof d.sdp !== 'string' || d.sdp.length > MAX_SDP) return null
      return { kind: d.kind, peer, toPeer: d.toPeer, sdp: d.sdp }
    default:
      return null
  }
}

/** Entre deux pairs, un seul ouvre la connexion (le plus petit identifiant) : jamais d'offres croisées. */
export const isOfferer = (me: string, them: string): boolean => me < them

export function newPeerId(random: () => number = Math.random): string {
  let id = ''
  for (let i = 0; i < 16; i++) id += Math.floor(random() * 36).toString(36)
  return id
}

// ── Fenêtre ──────────────────────────────────────────────────────────────────

export const PANEL_MIN_WIDTH = 160
export const PANEL_MAX_WIDTH = 720
export const PANEL_DEFAULT_WIDTH = 240

/** Largeur de la fenêtre de visio, bornée et jamais plus large que la place disponible (moins une marge). */
export function clampPanelWidth(width: number, available: number): number {
  const max = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, available - 16))
  return Math.round(Math.min(max, Math.max(PANEL_MIN_WIDTH, width)))
}

/** Colonnes de vignettes : une seule pour un adversaire, deux au-delà. */
export const tileColumns = (count: number): number => (count <= 1 ? 1 : 2)

const WIDTH_KEY = 'dc-visio-largeur'

export function loadPanelWidth(storage: Pick<Storage, 'getItem'> | undefined): number {
  try {
    const n = Number(storage?.getItem(WIDTH_KEY))
    return Number.isFinite(n) && n > 0 ? n : PANEL_DEFAULT_WIDTH
  } catch {
    return PANEL_DEFAULT_WIDTH
  }
}

export function savePanelWidth(storage: Pick<Storage, 'setItem'> | undefined, width: number): void {
  try {
    storage?.setItem(WIDTH_KEY, String(Math.round(width)))
  } catch {
    // stockage indisponible (navigation privée) : la largeur repart du défaut
  }
}

/** Place de la fenêtre dans la zone de jeu : écart à droite et en haut (accrochée par son coin haut droit). */
export type PanelPosition = { right: number; top: number }

const PANEL_MARGIN = 8
export const PANEL_DEFAULT_POSITION: PanelPosition = { right: PANEL_MARGIN, top: PANEL_MARGIN }

/** Garde la fenêtre entière dans la zone de jeu ; trop grande, elle se colle en haut à droite. */
export function clampPanelPosition(pos: PanelPosition, size: { width: number; height: number }, area: { width: number; height: number }): PanelPosition {
  const clamp = (v: number, max: number) => Math.round(Math.max(PANEL_MARGIN, Math.min(max, v)))
  return {
    right: clamp(pos.right, area.width - size.width - PANEL_MARGIN),
    top: clamp(pos.top, area.height - size.height - PANEL_MARGIN),
  }
}

const POSITION_KEY = 'dc-visio-position'

export function loadPanelPosition(storage: Pick<Storage, 'getItem'> | undefined): PanelPosition {
  try {
    const raw = JSON.parse(storage?.getItem(POSITION_KEY) ?? 'null') as Partial<PanelPosition> | null
    const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
    return raw && ok(raw.right) && ok(raw.top) ? { right: raw.right, top: raw.top } : PANEL_DEFAULT_POSITION
  } catch {
    return PANEL_DEFAULT_POSITION
  }
}

export function savePanelPosition(storage: Pick<Storage, 'setItem'> | undefined, pos: PanelPosition): void {
  try {
    storage?.setItem(POSITION_KEY, JSON.stringify({ right: Math.round(pos.right), top: Math.round(pos.top) }))
  } catch {
    // stockage indisponible : la fenêtre repart en haut à droite
  }
}

// ── Accès à la caméra ────────────────────────────────────────────────────────

export const VISIO_MSG = {
  denied: 'Accès à la caméra et au micro refusé : autorise-les dans les réglages du navigateur, puis relance la visio.',
  noDevice: 'Aucune caméra ni micro trouvé : tu vois et entends les autres sans être vu.',
  insecure: 'La visio demande une connexion sécurisée (https).',
  failed: 'Caméra ou micro indisponible (déjà utilisé par une autre application ?) : tu vois et entends les autres sans être vu.',
}

/** Message à afficher pour une erreur de getUserMedia. */
export function mediaErrorMessage(error: unknown): string {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name: unknown }).name) : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return VISIO_MSG.denied
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return VISIO_MSG.noDevice
  return VISIO_MSG.failed
}
