import { describe, it, expect } from 'vitest'
import { DUNGEON_IDS, DUNGEONS, VENTURE_DUNGEONS, dungeonDone, dungeonText, firstRoom, isDungeonId, roomOf, roomText, ventureStep } from './dungeons'

describe('données des donjons', () => {
  it('quatre donjons, dont trois au choix (jamais Les Souterrains)', () => {
    expect(DUNGEON_IDS).toEqual(['phandelver', 'annihilation', 'madMage', 'undercity'])
    expect(VENTURE_DUNGEONS).toEqual(['phandelver', 'annihilation', 'madMage'])
    expect(DUNGEONS.undercity.name).toBe('Les Souterrains')
    expect(isDungeonId('madMage')).toBe(true)
    expect(isDungeonId('toString')).toBe(false)
  })

  it('chaque salle mène à des salles existantes de l’étage suivant, et une seule dernière salle', () => {
    for (const id of DUNGEON_IDS) {
      const d = DUNGEONS[id]
      const ids = new Set(d.rooms.map((r) => r.id))
      expect(ids.size).toBe(d.rooms.length)
      for (const r of d.rooms) {
        expect(r.text.length).toBeGreaterThan(0)
        for (const n of r.next) {
          expect(ids.has(n)).toBe(true)
          expect(roomOf(id, n)!.row).toBeGreaterThan(r.row)
        }
      }
      expect(d.rooms.filter((r) => r.next.length === 0)).toHaveLength(1)
      expect(firstRoom(id).row).toBe(0)
    }
  })

  it('plan des cartes : liaisons de la Mine oubliée, de la Tombe, du Mage dément et des Souterrains', () => {
    const links = (id: keyof typeof DUNGEONS) => Object.fromEntries(DUNGEONS[id].rooms.map((r) => [r.nameEn, r.next.map((n) => roomOf(id, n)!.nameEn)]))
    expect(links('phandelver')).toEqual({
      'Cave Entrance': ['Goblin Lair', 'Mine Tunnels'],
      'Goblin Lair': ['Storeroom', 'Dark Pool'],
      'Mine Tunnels': ['Dark Pool', 'Fungi Cavern'],
      Storeroom: ['Temple of Dumathoin'],
      'Dark Pool': ['Temple of Dumathoin'],
      'Fungi Cavern': ['Temple of Dumathoin'],
      'Temple of Dumathoin': [],
    })
    expect(links('annihilation')).toEqual({
      'Trapped Entry': ['Veils of Fear', 'Oubliette'],
      'Veils of Fear': ['Sandfall Cell'],
      Oubliette: ['Cradle of the Death God'],
      'Sandfall Cell': ['Cradle of the Death God'],
      'Cradle of the Death God': [],
    })
    expect(DUNGEONS.madMage.rooms).toHaveLength(9)
    expect(links('madMage')['Lost Level']).toEqual(['Runestone Caverns', "Muiral's Graveyard"])
    expect(links('undercity')).toEqual({
      'Secret Entrance': ['Forge', 'Lost Well'],
      Forge: ['Trap!', 'Arena'],
      'Lost Well': ['Arena', 'Stash'],
      'Trap!': ['Archives'],
      Arena: ['Archives', 'Catacombs'],
      Stash: ['Catacombs'],
      Archives: ['Throne of the Dead Three'],
      Catacombs: ['Throne of the Dead Three'],
      'Throne of the Dead Three': [],
    })
  })
})

describe('ventureStep', () => {
  it('sans donjon : choix du donjon, ou entrée dans Les Souterrains', () => {
    expect(ventureStep(undefined, 'dungeon')).toEqual({ kind: 'choose' })
    expect(ventureStep(undefined, 'undercity')).toEqual({ kind: 'enter', dungeon: 'undercity' })
  })

  it('donjon en cours : avance dans celui-là, même avec l’initiative', () => {
    expect(ventureStep({ id: 'phandelver', room: 'cave' }, 'dungeon')).toEqual({ kind: 'advance', dungeon: 'phandelver', next: ['goblinLair', 'mineTunnels'] })
    expect(ventureStep({ id: 'phandelver', room: 'goblinLair' }, 'undercity')).toEqual({ kind: 'advance', dungeon: 'phandelver', next: ['storeroom', 'darkPool'] })
    expect(ventureStep({ id: 'undercity', room: 'secret' }, 'dungeon')).toEqual({ kind: 'advance', dungeon: 'undercity', next: ['forge', 'well'] })
  })

  it('donjon terminé (dernière salle) : on recommence', () => {
    expect(dungeonDone({ id: 'phandelver', room: 'temple' })).toBe(true)
    expect(dungeonDone({ id: 'phandelver', room: 'cave' })).toBe(false)
    expect(ventureStep({ id: 'phandelver', room: 'temple' }, 'dungeon')).toEqual({ kind: 'choose' })
    expect(ventureStep({ id: 'phandelver', room: 'temple' }, 'undercity')).toEqual({ kind: 'enter', dungeon: 'undercity' })
  })

  it('salle inconnue (donnée abîmée) : traitée comme sans donjon', () => {
    expect(ventureStep({ id: 'phandelver', room: 'nope' }, 'dungeon')).toEqual({ kind: 'choose' })
  })
})

describe('noms et textes dans la langue des cartes', () => {
  it('français imprimé ou anglais officiel (Oracle), sans lettre accentuée en anglais', () => {
    expect(dungeonText('phandelver', 'fr')).toEqual({ name: 'Mine oubliée de Phancreux', the: 'la Mine oubliée de Phancreux', short: 'Phancreux' })
    expect(dungeonText('madMage', 'en')).toEqual({ name: 'Dungeon of the Mad Mage', the: 'Dungeon of the Mad Mage', short: 'Mad Mage' })
    expect(roomText(roomOf('undercity', 'trap')!, 'en')).toEqual({ name: 'Trap!', text: 'Target player loses 5 life.' })
    expect(roomText(roomOf('undercity', 'trap')!, 'fr')).toEqual({ name: 'Piège !', text: 'Un joueur ciblé perd 5 points de vie.' })
    for (const id of DUNGEON_IDS) {
      expect(dungeonText(id, 'en').short).not.toMatch(/[À-ÿ]/)
      for (const r of DUNGEONS[id].rooms) expect(`${r.nameEn} ${r.textEn}`).not.toMatch(/[À-ÿ]/)
    }
  })
})
