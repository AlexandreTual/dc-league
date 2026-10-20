// Journal de partie (spec 2026-10-19-english-interface-design, « Journal de partie structuré ») : panneau, fil
// d'activité et phrases de chaque ligne écrite par le moteur. Les phrases françaises doivent redonner exactement le
// `text` écrit par le moteur (lib/game/apply.ts) : un test le vérifie pour chaque sorte de ligne.
import { abilityText, type Keyword } from '@/lib/game/abilities'

const A_CARD = 'une carte'
const FACE_DOWN = 'une carte face cachée'
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`
/** « A », « A et B », « A, B et C ». */
const join = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} et ${items.at(-1)}`)
/** Bibliothèque de l'auteur (`p` absent) ou d'un autre joueur. */
const libraryOf = (p?: string) => (p === undefined ? 'sa bibliothèque' : `la bibliothèque de ${p}`)
const topCards = (n: number) => (n === 1 ? 'la carte du dessus' : `les ${n} cartes du dessus`)
const EOT = ' (jusqu’à la fin du tour)'

export const log = {
  panel: {
    title: 'Journal',
    close: 'Fermer le journal',
    turn: 'Tour',
    drawn: 'Cartes piochées',
    landsPlayed: 'Terrains joués',
    mulligans: 'Mulligans',
    library: 'Bibliothèque',
    /** Numéro du tour devant chaque ligne. */
    turnShort: (n: number) => `T${n}`,
  },
  aCard: A_CARD,
  faceDownCard: FACE_DOWN,
  zones: {
    library: 'bibliothèque',
    hand: 'main',
    battlefield: 'champ de bataille',
    graveyard: 'cimetière',
    exile: 'exil',
    command: 'zone de commandement',
  },
  /** Zone de l'auteur de la ligne (`owner` absent) ou d'un autre joueur. */
  zone: (label: string, owner?: string) => (owner === undefined ? label : `${label} de ${owner}`),
  keyword: (keyword: Keyword) => abilityText({ keyword }),
  ability: (ability: { keyword: Keyword; param?: string }) => abilityText(ability),
  /** Précision seule d'une capacité : « contre le rouge », « {2} », « 2 ». */
  abilityParam: (ability: { keyword: Keyword; param: string }) => abilityText(ability).slice(abilityText({ keyword: ability.keyword }).length + 1),
  lines: {
    start: (v: { p: string; chosen?: 1 }) => `Début de partie : ${v.p} commence${v.chosen ? " (choisi par l'hôte)" : ''}`,
    turn: (v: { n: number; p: string; host?: 1 }) => `Tour ${v.n} : ${v.p}${v.host ? ' (passé par l’hôte)' : ''}`,
    mulligan: (v: { n: number }) => `Mulligan n°${v.n}`,
    keep: 'Garde sa main',
    libraryEmpty: 'Bibliothèque vide',
    draw: (v: { n: number }) => `Pioche ${plural(v.n, 'carte')}`,
    shuffle: 'Mélange sa bibliothèque',
    roll: (v: { sides: number; r: number[] }) => {
      if (v.sides === 2) {
        const faces = v.r.map((n) => (n === 1 ? 'Pile' : 'Face')).join(', ')
        return v.r.length === 1 ? `Pile ou face : ${faces}` : `Lance ${v.r.length} pièces : ${faces}`
      }
      if (v.r.length === 1) return `Lance un d${v.sides} : ${v.r[0]}`
      return `Lance ${v.r.length}d${v.sides} : ${v.r.join(', ')} (total ${v.r.reduce((a, b) => a + b, 0)})`
    },
    move: (v: { c?: string; from: string; to: string; pos?: 'top' | 'bottom' | number; gone?: 1 }) => {
      const where = v.gone ? ' (disparaît)'
        : v.pos === undefined ? '' : ` (${v.pos === 'bottom' ? 'dessous' : v.pos === 'top' ? 'dessus' : `position ${v.pos}`})`
      return `${v.c ?? A_CARD} : ${v.from} → ${v.to}${where}`
    },
    moveMany: (v: { n: number; from: string; to: string; side?: 'top' | 'bottom'; random?: 1; cards?: string[] }) => {
      const details = [...(v.side ? [v.side === 'top' ? 'dessus' : 'dessous'] : []), ...(v.random ? ['ordre aléatoire'] : [])]
      const where = details.length > 0 ? ` (${details.join(', ')})` : ''
      return `${plural(v.n, 'carte')} : ${v.from} → ${v.to}${where}${v.cards?.length ? ` : ${v.cards.join(', ')}` : ''}`
    },
    giveControl: (v: { c?: string; p: string }) => `donne le contrôle ${v.c === undefined ? 'd’une carte face cachée' : `de ${v.c}`} à ${v.p}`,
    counter: (v: { c?: string; kind: 'plus' | 'minus' | 'other'; n: number }) =>
      `${v.c ?? A_CARD} : ${{ plus: '+1/+1', minus: '-1/-1', other: 'compteur' }[v.kind]} (${v.n})`,
    /** `pt` absent : force et endurance d'origine ; `mod`, `turn` : modifications pour toujours et ce tour. */
    pt: (v: { c?: string; pt?: string; mod?: string; turn?: string }) => {
      const mods = [...(v.mod ? [v.mod] : []), ...(v.turn ? [`${v.turn} ce tour`] : [])]
      const shown = v.pt === undefined ? 'force et endurance d’origine' : mods.length > 0 ? `${v.pt} (${mods.join(', ')})` : v.pt
      return `${v.c ?? FACE_DOWN} : ${shown}`
    },
    effect: (v: { pt?: string; ab?: string[]; cards: string[]; more?: number; eot?: 1 }) =>
      `donne ${join([...(v.pt ? [v.pt] : []), ...(v.ab ?? [])])} à ${join([...v.cards, ...(v.more ? [`${v.more} autres cartes`] : [])])}${v.eot ? EOT : ''}`,
    abilities: (v: { c?: string; add?: string[]; eot?: 1; chg?: { label: string; param: string }[]; rm?: string[]; rs?: string[] }) => {
      const name = v.c ?? FACE_DOWN
      const parts: string[] = []
      if (v.add?.length) parts.push(`donne ${join(v.add)} à ${name}${v.eot ? EOT : ''}`)
      for (const c of v.chg ?? []) parts.push(`change ${c.label} de ${name} : ${c.param}`)
      if (v.rm?.length) parts.push(`retire ${join(v.rm)} à ${name}`)
      if (v.rs?.length) parts.push(`rend ${join(v.rs)} à ${name}`)
      return parts.join(' ; ')
    },
    loyalty: (v: { c?: string; v?: string }) => `${v.c ?? A_CARD} : ${v.v === undefined ? 'loyauté d’origine' : `loyauté ${v.v}`}`,
    createToken: (v: { name: string; copy?: 1 }) => `Crée un jeton ${v.name}${v.copy ? ' (copie)' : ''}`,
    flip: (v: { c?: string }) => `Transforme ${v.c ?? FACE_DOWN}`,
    phaseOut: (v: { c?: string }) => `${v.c ?? FACE_DOWN} passe hors phase`,
    phaseIn: (v: { c?: string }) => `${v.c ?? FACE_DOWN} revient en phase`,
    faceDown: 'Met une carte face cachée',
    faceUp: (v: { c?: string }) => `Retourne ${v.c ?? A_CARD} face visible`,
    commanderTax: (v: { c?: string; n: number }) => `Taxe de ${v.c ?? A_CARD} : ${v.n}`,
    life: (v: { p: string; from: number; to: number }) => `${v.p} ${v.from} → ${v.to}`,
    poison: (v: { p: string; n: number }) => `${v.p} : poison ${v.n}`,
    playerCounter: (v: { p: string; name: string; n: number }) => `${v.p} : ${v.name} ${v.n}`,
    commanderDamage: (v: { p: string; n: number; c?: string; life: number }) =>
      `${v.p} : ${plural(v.n, 'blessure')} de ${v.c ?? A_CARD} (vie ${v.life})`,
    monarch: (v: { p: string }) => `${v.p} devient le monarque`,
    noMonarch: 'Plus de monarque',
    initiative: (v: { p: string }) => `${v.p} prend l’initiative`,
    noInitiative: 'Plus d’initiative',
    eliminated: (v: { p: string }) => `${v.p} est éliminé`,
    revealAll: (v: { cards: string[] }) => `révèle : ${v.cards.join(', ')}`,
    revealTo: (v: { n: number; to: string[] }) => `révèle ${plural(v.n, 'carte')} à ${v.to.join(', ')}`,
    revealedTo: (v: { to: string[]; cards: string[] }) => `Révélé à ${v.to.join(', ')} : ${v.cards.join(', ')}`,
    revealTop: (v: { c?: string }) => `révèle ${v.c ?? A_CARD}`,
    topRevealed: 'joue avec la carte du dessus révélée',
    topHidden: 'cache la carte du dessus',
    keepMana: 'garde sa réserve de mana d’un tour à l’autre',
    noKeepMana: 'ne garde plus sa réserve de mana',
    peekTop: 'regarde la carte du dessus de sa bibliothèque en permanence',
    noPeekTop: 'ne regarde plus la carte du dessus',
    search: (v: { p?: string }) => `fouille ${libraryOf(v.p)}`,
    look: (v: { n: number; p?: string }) => `regarde ${topCards(v.n)} de ${libraryOf(v.p)}`,
    seen: (v: { cards: string[] }) => `Tu as vu : ${v.cards.join(', ')}`,
    reorder: (v: { n: number; p?: string }) => `remet ${topCards(v.n)} de ${libraryOf(v.p)} dans l’ordre de son choix`,
    stopLook: (v: { p?: string }) => `arrête de regarder ${libraryOf(v.p)}`,
    /** Fin d'une recherche avec mélange ; `top`, `bottom` : cartes épargnées posées dessus et dessous. */
    shuffleLook: (v: { p?: string; top?: number; bottom?: number }) => {
      const count = (n: number) => (n === 1 ? 'une carte' : `${n} cartes`)
      const parts = [
        ...(v.top ? [`met ${count(v.top)} au-dessus`] : []),
        ...(v.bottom ? [`${v.top ? '' : 'met '}${count(v.bottom)} dessous`] : []),
      ]
      const tail = parts.length === 0 ? '' : parts.length === 1 ? ` et ${parts[0]}` : `, ${parts[0]} et ${parts[1]}`
      return `mélange ${libraryOf(v.p)}${tail}`
    },
  },
}
