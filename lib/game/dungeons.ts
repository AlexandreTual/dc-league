// Donjons de Magic (règles 309 et 701.49) : les trois de Forgotten Realms, choisis par « explorer le donjon »,
// et Les Souterrains, seulement par l'initiative. Le moteur suit le jeton de chaque joueur ; l'effet des salles
// n'est pas appliqué : leur texte est affiché, chacun l'applique à la main.
// Noms et textes des donjons et des salles : ceux des cartes officielles, en français (imprimés) et en anglais
// (Oracle) ; affichés dans la langue des cartes du lecteur, comme les cartes (`dungeonText`, `roomText`).
import type { Lang } from '@/lib/i18n/lang'

export const DUNGEON_IDS = ['phandelver', 'annihilation', 'madMage', 'undercity'] as const
export type DungeonId = (typeof DUNGEON_IDS)[number]

/** Donjons au choix d'« explorer le donjon » (jamais Les Souterrains). */
export const VENTURE_DUNGEONS: DungeonId[] = ['phandelver', 'annihilation', 'madMage']

/**
 * Salle : `next` mène à l'étage suivant (deux salles : le joueur choisit) ; `row` : étage (0 = entrée) ;
 * `x` : place horizontale sur le plan, de 0 (gauche) à 1 (droite), comme sur la carte.
 */
export type Room = { id: string; name: string; nameEn: string; text: string; textEn: string; next: string[]; row: number; x: number }
/**
 * `the` : nom précédé de son article, pour le journal (« entre dans la Mine oubliée de Phancreux ») ;
 * `short`, `shortEn` : nom court des onglets et du jeton.
 */
export type Dungeon = { id: DungeonId; name: string; the: string; nameEn: string; short: string; shortEn: string; rooms: Room[] }

/** Position d'un joueur : donjon et salle du jeton (sur la dernière salle, le donjon est terminé). */
export type DungeonPosition = { id: DungeonId; room: string }

const room = (id: string, name: string, nameEn: string, text: string, textEn: string, row: number, x: number, next: string[] = []): Room =>
  ({ id, name, nameEn, text, textEn, next, row, x })

export const DUNGEONS: Record<DungeonId, Dungeon> = {
  phandelver: {
    id: 'phandelver', name: 'Mine oubliée de Phancreux', the: 'la Mine oubliée de Phancreux', nameEn: 'Lost Mine of Phandelver', short: 'Phancreux', shortEn: 'Phandelver',
    rooms: [
      room('cave', 'Entrée du souterrain', 'Cave Entrance', 'Regard 1.', 'Scry 1.', 0, 0.5, ['goblinLair', 'mineTunnels']),
      room('goblinLair', 'Repaire de gobelins', 'Goblin Lair', 'Créez un jeton de créature 1/1 rouge Gobelin.', 'Create a 1/1 red Goblin creature token.', 1, 0.3, ['storeroom', 'darkPool']),
      room('mineTunnels', 'Tunnels de la mine', 'Mine Tunnels', 'Créez un jeton Trésor.', 'Create a Treasure token.', 1, 0.7, ['darkPool', 'fungiCavern']),
      room('storeroom', 'Réserve', 'Storeroom', 'Mettez un marqueur +1/+1 sur une créature ciblée.', 'Put a +1/+1 counter on target creature.', 2, 0.17, ['temple']),
      room('darkPool', 'Bassin obscur', 'Dark Pool', 'Chaque adversaire perd 1 point de vie et vous gagnez 1 point de vie.', 'Each opponent loses 1 life and you gain 1 life.', 2, 0.5, ['temple']),
      room('fungiCavern', 'Caverne fongique', 'Fungi Cavern', "Une créature ciblée gagne -4/-0 jusqu'à votre prochain tour.", 'Target creature gets -4/-0 until your next turn.', 2, 0.83, ['temple']),
      room('temple', 'Temple de Dumathoïn', 'Temple of Dumathoin', 'Piochez une carte.', 'Draw a card.', 3, 0.5),
    ],
  },
  annihilation: {
    id: 'annihilation', name: "Tombe de l'annihilation", the: "la Tombe de l'annihilation", nameEn: 'Tomb of Annihilation', short: 'Annihilation', shortEn: 'Annihilation',
    rooms: [
      room('trappedEntry', 'Entrée piégée', 'Trapped Entry', 'Chaque joueur perd 1 point de vie.', 'Each player loses 1 life.', 0, 0.5, ['veils', 'oubliette']),
      room('veils', 'Voiles de terreur', 'Veils of Fear', "Chaque joueur perd 2 points de vie à moins qu'il ne se défausse d'une carte.", 'Each player loses 2 life unless they discard a card.', 1, 0.28, ['sandfall']),
      room('oubliette', 'Oubliette', 'Oubliette', "Défaussez-vous d'une carte et sacrifiez un artefact, une créature et un terrain.", 'Discard a card and sacrifice an artifact, a creature, and a land.', 1, 0.72, ['cradle']),
      room('sandfall', 'Cellule ensablée', 'Sandfall Cell', "Chaque joueur perd 2 points de vie à moins qu'il ne sacrifie un artefact, une créature ou un terrain.", 'Each player loses 2 life unless they sacrifice an artifact, a creature, or a land.', 2, 0.28, ['cradle']),
      room('cradle', 'Berceau du dieu de la Mort', 'Cradle of the Death God', "Créez L'Atropal, un jeton de créature légendaire 4/4 noire Dieu et Horreur avec le contact mortel.", 'Create The Atropal, a legendary 4/4 black God Horror creature token with deathtouch.', 3, 0.5),
    ],
  },
  madMage: {
    id: 'madMage', name: 'Donjon du mage dément', the: 'le Donjon du mage dément', nameEn: 'Dungeon of the Mad Mage', short: 'Mage dément', shortEn: 'Mad Mage',
    rooms: [
      room('portal', 'Portail béant', 'Yawning Portal', 'Vous gagnez 1 point de vie.', 'You gain 1 life.', 0, 0.5, ['level']),
      room('level', 'Niveau du donjon', 'Dungeon Level', 'Regard 1.', 'Scry 1.', 1, 0.5, ['bazaar', 'caverns']),
      room('bazaar', 'Bazar gobelin', 'Goblin Bazaar', 'Créez un jeton Trésor.', 'Create a Treasure token.', 2, 0.28, ['lostLevel']),
      room('caverns', 'Cavernes tortueuses', 'Twisted Caverns', "Une créature ciblée ne peut pas attaquer jusqu'à votre prochain tour.", "Target creature can't attack until your next turn.", 2, 0.72, ['lostLevel']),
      room('lostLevel', 'Niveau perdu', 'Lost Level', 'Regard 2.', 'Scry 2.', 3, 0.5, ['runestone', 'muiral']),
      room('runestone', 'Grottes de la pierre runique', 'Runestone Caverns', 'Exilez les deux cartes du dessus de votre bibliothèque. Vous pouvez les jouer.', 'Exile the top two cards of your library. You may play them.', 4, 0.28, ['deepMines']),
      room('muiral', 'Cimetière de Muiral', "Muiral's Graveyard", 'Créez deux jetons de créature 1/1 noire Squelette.', 'Create two 1/1 black Skeleton creature tokens.', 4, 0.72, ['deepMines']),
      room('deepMines', 'Mines profondes', 'Deep Mines', 'Regard 3.', 'Scry 3.', 5, 0.5, ['lair']),
      room('lair', 'Repaire du mage dément', "Mad Wizard's Lair", "Piochez trois cartes et révélez-les. Vous pouvez lancer l'une d'entre elles sans payer son coût de mana.", 'Draw three cards and reveal them. You may cast one of them without paying its mana cost.', 6, 0.5),
    ],
  },
  undercity: {
    id: 'undercity', name: 'Les Souterrains', the: 'Les Souterrains', nameEn: 'Undercity', short: 'Souterrains', shortEn: 'Undercity',
    rooms: [
      room('secret', 'Entrée secrète', 'Secret Entrance', 'Cherchez dans votre bibliothèque une carte de terrain de base, révélez-la, mettez-la dans votre main, puis mélangez.', 'Search your library for a basic land card, reveal it, put it into your hand, then shuffle.', 0, 0.5, ['forge', 'well']),
      room('forge', 'Forge', 'Forge', 'Mettez deux marqueurs +1/+1 sur une créature ciblée.', 'Put two +1/+1 counters on target creature.', 1, 0.3, ['trap', 'arena']),
      room('well', 'Puits perdu', 'Lost Well', 'Regard 2.', 'Scry 2.', 1, 0.7, ['arena', 'stash']),
      room('trap', 'Piège !', 'Trap!', 'Un joueur ciblé perd 5 points de vie.', 'Target player loses 5 life.', 2, 0.17, ['archives']),
      room('arena', 'Arène', 'Arena', 'Incitez une créature ciblée.', 'Goad target creature.', 2, 0.5, ['archives', 'catacombs']),
      room('stash', 'Réserve', 'Stash', 'Créez un jeton Trésor.', 'Create a Treasure token.', 2, 0.83, ['catacombs']),
      room('archives', 'Archives', 'Archives', 'Piochez une carte.', 'Draw a card.', 3, 0.3, ['throne']),
      room('catacombs', 'Catacombes', 'Catacombs', 'Créez un jeton de créature 4/1 noire Squelette avec la menace.', 'Create a 4/1 black Skeleton creature token with menace.', 3, 0.7, ['throne']),
      room('throne', 'Trône des Trois Funestes', 'Throne of the Dead Three',
        'Révélez les dix cartes du dessus de votre bibliothèque. Mettez sur le champ de bataille une carte de créature parmi elles avec trois marqueurs +1/+1 sur elle. Elle acquiert la défense talismanique jusqu’à votre prochain tour. Puis mélangez.', 'Reveal the top ten cards of your library. Put a creature card from among them onto the battlefield with three +1/+1 counters on it. It gains hexproof until your next turn. Then shuffle.', 4, 0.5),
    ],
  },
}

export const isDungeonId = (v: unknown): v is DungeonId => typeof v === 'string' && (DUNGEON_IDS as readonly string[]).includes(v)

export const roomOf = (dungeon: DungeonId, id: string): Room | undefined => DUNGEONS[dungeon].rooms.find((r) => r.id === id)
export const firstRoom = (dungeon: DungeonId): Room => DUNGEONS[dungeon].rooms[0]
/** Nombre d'étages du donjon. */
export const rowsOf = (dungeon: DungeonId): number => Math.max(...DUNGEONS[dungeon].rooms.map((r) => r.row)) + 1

/** Jeton sur la dernière salle : donjon terminé (il a quitté la partie). */
export function dungeonDone(position: DungeonPosition): boolean {
  const r = roomOf(position.id, position.room)
  return !!r && r.next.length === 0
}

/** Donjon commencé et pas terminé (salle connue). */
function ongoing(position: DungeonPosition | undefined): position is DungeonPosition {
  return !!position && isDungeonId(position.id) && !!roomOf(position.id, position.room) && !dungeonDone(position)
}

/** Ce que fait une exploration : choisir un donjon, entrer dans Les Souterrains, ou avancer vers l'une des salles suivantes. */
export type VentureStep = { kind: 'choose' } | { kind: 'enter'; dungeon: DungeonId } | { kind: 'advance'; dungeon: DungeonId; next: string[] }

/** `dungeon` : « explorer le donjon » ; `undercity` : « explorer Les Souterrains » (initiative). */
export function ventureStep(position: DungeonPosition | undefined, mode: 'dungeon' | 'undercity'): VentureStep {
  if (ongoing(position)) return { kind: 'advance', dungeon: position.id, next: roomOf(position.id, position.room)!.next }
  return mode === 'undercity' ? { kind: 'enter', dungeon: 'undercity' } : { kind: 'choose' }
}


/**
 * Nom d'un donjon dans la langue des cartes : `name`, `the` (avec son article, pour une phrase française ; noms
 * anglais : le nom seul) et `short` (onglets, jeton).
 */
export function dungeonText(id: DungeonId, lang: Lang): { name: string; the: string; short: string } {
  const d = DUNGEONS[id]
  return lang === 'fr' ? { name: d.name, the: d.the, short: d.short } : { name: d.nameEn, the: d.nameEn, short: d.shortEn }
}

/** Nom et texte d'une salle dans la langue des cartes. */
export function roomText(room: Room, lang: Lang): { name: string; text: string } {
  return lang === 'fr' ? { name: room.name, text: room.text } : { name: room.nameEn, text: room.textEn }
}
