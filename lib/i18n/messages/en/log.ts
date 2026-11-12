import type { Messages } from '../fr'

const A_CARD = 'a card'
const FACE_DOWN = 'a face-down card'
const cards = (n: number) => (n === 1 ? '1 card' : `${n} cards`)
const join = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)
const libraryOf = (p?: string) => (p === undefined ? 'their library' : `${p}'s library`)
const topCards = (n: number) => (n === 1 ? 'the top card' : `the top ${n} cards`)
const EOT = ' (until end of turn)'
const COLORS: Record<string, string> = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green' }
/** Précision en anglais : « from red and green », « from everything », « {2} », « 2 ». */
const paramText = (keyword: string, param: string) => {
  if (keyword !== 'Protection') return param
  if (param === 'all') return 'from everything'
  return `from ${join(param.split(',').map((c) => COLORS[c] ?? c))}`
}

export const log: Messages['log'] = {
  panel: {
    title: 'Game log',
    close: 'Close the game log',
    turn: 'Turn',
    drawn: 'Cards drawn',
    landsPlayed: 'Lands played',
    mulligans: 'Mulligans taken',
    library: 'Library',
    turnShort: (n) => `T${n}`,
  },
  aCard: A_CARD,
  faceDownCard: FACE_DOWN,
  zones: {
    library: 'library',
    hand: 'hand',
    battlefield: 'battlefield',
    graveyard: 'graveyard',
    exile: 'exile',
    command: 'command zone',
  },
  zone: (label, owner) => (owner === undefined ? label : `${owner}'s ${label}`),
  // Les mots-clés du moteur sont déjà les noms anglais officiels (Scryfall).
  keyword: (keyword) => keyword,
  ability: (ability) => (ability.param ? `${ability.keyword} ${paramText(ability.keyword, ability.param)}` : ability.keyword),
  abilityParam: (ability) => paramText(ability.keyword, ability.param),
  lines: {
    start: (v) => `Game start: ${v.p} goes first${v.chosen ? ' (chosen by the host)' : ''}`,
    turn: (v) => `Turn ${v.n}: ${v.p}${v.host ? ' (passed by the host)' : ''}`,
    mulligan: (v) => `Mulligan #${v.n}`,
    keep: 'Keeps their hand',
    libraryEmpty: 'Library is empty',
    draw: (v) => `Draws ${cards(v.n)}`,
    shuffle: 'Shuffles their library',
    roll: (v) => {
      if (v.sides === 2) {
        const faces = v.r.map((n) => (n === 1 ? 'Heads' : 'Tails')).join(', ')
        return v.r.length === 1 ? `Coin flip: ${faces}` : `Flips ${v.r.length} coins: ${faces}`
      }
      if (v.r.length === 1) return `Rolls a d${v.sides}: ${v.r[0]}`
      return `Rolls ${v.r.length}d${v.sides}: ${v.r.join(', ')} (total ${v.r.reduce((a, b) => a + b, 0)})`
    },
    move: (v) => {
      const where = v.gone ? ' (vanishes)'
        : v.pos === undefined ? '' : ` (${v.pos === 'bottom' ? 'bottom' : v.pos === 'top' ? 'top' : `position ${v.pos}`})`
      return `${v.c ?? A_CARD}: ${v.from} → ${v.to}${where}`
    },
    moveMany: (v) => {
      const details = [...(v.side ? [v.side] : []), ...(v.random ? ['random order'] : [])]
      const where = details.length > 0 ? ` (${details.join(', ')})` : ''
      return `${cards(v.n)}: ${v.from} → ${v.to}${where}${v.cards?.length ? `: ${v.cards.join(', ')}` : ''}`
    },
    giveControl: (v) => `gives control of ${v.c ?? FACE_DOWN} to ${v.p}`,
    counter: (v) => `${v.c ?? A_CARD}: ${{ plus: '+1/+1', minus: '-1/-1', other: 'counter' }[v.kind]} (${v.n})`,
    pt: (v) => {
      const mods = [...(v.mod ? [v.mod] : []), ...(v.turn ? [`${v.turn} this turn`] : [])]
      const shown = v.pt === undefined ? 'base power and toughness' : mods.length > 0 ? `${v.pt} (${mods.join(', ')})` : v.pt
      return `${v.c ?? FACE_DOWN}: ${shown}`
    },
    effect: (v) =>
      `gives ${join([...(v.pt ? [v.pt] : []), ...(v.ab ?? [])])} to ${join([...v.cards, ...(v.more ? [`${v.more} other cards`] : [])])}${v.eot ? EOT : ''}`,
    abilities: (v) => {
      const name = v.c ?? FACE_DOWN
      const parts: string[] = []
      if (v.add?.length) parts.push(`gives ${join(v.add)} to ${name}${v.eot ? EOT : ''}`)
      for (const c of v.chg ?? []) parts.push(`changes ${c.label} on ${name}: ${c.param}`)
      if (v.rm?.length) parts.push(`removes ${join(v.rm)} from ${name}`)
      if (v.rs?.length) parts.push(`gives ${join(v.rs)} back to ${name}`)
      return parts.join('; ')
    },
    loyalty: (v) => `${v.c ?? A_CARD}: ${v.v === undefined ? 'starting loyalty' : `loyalty ${v.v}`}`,
    createToken: (v) => `Creates a ${v.name} token${v.copy ? ' (copy)' : ''}`,
    flip: (v) => `Transforms ${v.c ?? FACE_DOWN}`,
    phaseOut: (v) => `${v.c ?? FACE_DOWN} phases out`,
    phaseIn: (v) => `${v.c ?? FACE_DOWN} phases in`,
    faceDown: 'Turns a card face down',
    faceUp: (v) => `Turns ${v.c ?? A_CARD} face up`,
    commanderTax: (v) => `Commander tax for ${v.c ?? A_CARD}: ${v.n}`,
    life: (v) => `${v.p}: life ${v.from} → ${v.to}`,
    poison: (v) => `${v.p}: poison ${v.n}`,
    playerCounter: (v) => `${v.p}: ${v.name} ${v.n}`,
    commanderDamage: (v) => `${v.p}: ${v.n} commander damage from ${v.c ?? A_CARD} (life ${v.life})`,
    monarch: (v) => `${v.p} becomes the monarch`,
    noMonarch: 'No more monarch',
    initiative: (v) => `${v.p} takes the initiative`,
    noInitiative: 'No one has the initiative',
    eliminated: (v) => `${v.p} is eliminated`,
    venture: (v) => `${v.adv ? 'ventures deeper into' : 'enters'} ${v.d.name}: ${v.r.name} — ${v.r.text}${v.total ? ` Dungeon completed (${v.total} total).` : ''}`,
    skipVenture: (v) => `doesn't venture into ${v.d.name} for now`,
    revealAll: (v) => `reveals: ${v.cards.join(', ')}`,
    revealTo: (v) => `reveals ${cards(v.n)} to ${v.to.join(', ')}`,
    revealedTo: (v) => `Revealed to ${v.to.join(', ')}: ${v.cards.join(', ')}`,
    revealTop: (v) => `reveals ${v.c ?? A_CARD}`,
    topRevealed: 'plays with the top card of their library revealed',
    topHidden: 'hides the top card of their library',
    keepMana: 'keeps their mana pool from turn to turn',
    noKeepMana: 'no longer keeps their mana pool',
    peekTop: 'may look at the top card of their library any time',
    noPeekTop: 'no longer looks at the top card',
    search: (v) => `searches ${libraryOf(v.p)}`,
    look: (v) => `looks at ${topCards(v.n)} of ${libraryOf(v.p)}`,
    seen: (v) => `You saw: ${v.cards.join(', ')}`,
    reorder: (v) => `puts ${topCards(v.n)} of ${libraryOf(v.p)} back in any order`,
    stopLook: (v) => `stops looking at ${libraryOf(v.p)}`,
    shuffleLook: (v) => {
      const count = (n: number) => (n === 1 ? 'one card' : `${n} cards`)
      const parts = [
        ...(v.top ? [`puts ${count(v.top)} on top`] : []),
        ...(v.bottom ? [`${v.top ? '' : 'puts '}${count(v.bottom)} on the bottom`] : []),
      ]
      const tail = parts.length === 0 ? '' : parts.length === 1 ? ` and ${parts[0]}` : `, ${parts[0]} and ${parts[1]}`
      return `shuffles ${libraryOf(v.p)}${tail}`
    },
  },
}
