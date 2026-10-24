import { describe, it, expect } from 'vitest'
import { computeLeaderboard, generateRoundRobinMatches, type Match, type Player } from './leaderboard'

function joueur(id: string): Player {
  return { id, name: id.toUpperCase(), avatar_url: null, created_at: '2026-01-01' }
}

let n = 0
function match(p1: string, p2: string, s1: number | null, s2: number | null, termine = true): Match {
  return { id: `m${++n}`, player1_id: p1, player2_id: p2, score_p1: s1, score_p2: s2, is_completed: termine, round_number: 1 }
}

function ligne(classement: ReturnType<typeof computeLeaderboard>, id: string) {
  return classement.find((s) => s.id === id)!
}

/** Classement d'une ligue quelconque : ces tests ne touchent pas au départage des égalités parfaites. */
const classer = (joueurs: Player[], matchs: Match[]) => computeLeaderboard(joueurs, matchs, 'ligue')

describe('computeLeaderboard', () => {
  it('compte 3 points pour une victoire, 1 pour un nul, 0 pour une défaite', () => {
    const c = classer([joueur('a'), joueur('b'), joueur('c')], [
      match('a', 'b', 2, 0),
      match('b', 'c', 1, 1),
      match('c', 'a', 2, 1),
    ])
    expect(ligne(c, 'a')).toMatchObject({ points: 3, wins: 1, losses: 1, draws: 0, played: 2, gw: 3, gl: 2 })
    expect(ligne(c, 'b')).toMatchObject({ points: 1, wins: 0, losses: 1, draws: 1, played: 2, gw: 1, gl: 3 })
    expect(ligne(c, 'c')).toMatchObject({ points: 4, wins: 1, losses: 0, draws: 1, played: 2, gw: 3, gl: 2 })
    expect(c.map((s) => s.id)).toEqual(['c', 'a', 'b'])
  })

  it('départage à points égaux par la différence de manches, puis par le nombre de victoires', () => {
    // a et b : 3 points chacun ; a gagne 2-0 (+2), b gagne 2-1 (+1) → a devant
    const c = classer([joueur('b'), joueur('a'), joueur('c'), joueur('d')], [
      match('a', 'c', 2, 0),
      match('b', 'd', 2, 1),
    ])
    expect(c.map((s) => s.id)).toEqual(['a', 'b', 'd', 'c'])

    // e et f : 3 points et différence 0 ; e a une victoire, f a trois nuls → e devant
    const d = classer([joueur('f'), joueur('e'), joueur('x'), joueur('y'), joueur('z')], [
      match('e', 'x', 2, 0),
      match('e', 'y', 0, 2),
      match('f', 'x', 1, 1),
      match('f', 'y', 1, 1),
      match('f', 'z', 1, 1),
    ])
    expect(ligne(d, 'e')).toMatchObject({ points: 3, gw: 2, gl: 2, wins: 1 })
    expect(ligne(d, 'f')).toMatchObject({ points: 3, gw: 3, gl: 3, wins: 0 })
    expect(d.map((s) => s.id).indexOf('e')).toBeLessThan(d.map((s) => s.id).indexOf('f'))
  })

  it('ignore un match non terminé, même avec un score saisi', () => {
    const c = classer([joueur('a'), joueur('b')], [
      match('a', 'b', 2, 0, false),
      match('a', 'b', null, null, false),
    ])
    for (const s of c) expect(s).toMatchObject({ points: 0, played: 0, gw: 0, gl: 0 })
  })

  it('ignore un match où figure un joueur non inscrit', () => {
    const c = classer([joueur('a'), joueur('b')], [
      match('a', 'intrus', 2, 0),
      match('intrus', 'b', 2, 0),
    ])
    expect(c.map((s) => s.id).sort()).toEqual(['a', 'b'])
    for (const s of c) expect(s).toMatchObject({ points: 0, played: 0 })
  })

  it('garde un joueur sans match, à zéro', () => {
    const c = classer([joueur('a'), joueur('b'), joueur('c')], [match('a', 'b', 2, 0)])
    expect(ligne(c, 'c')).toMatchObject({ points: 0, wins: 0, losses: 0, draws: 0, played: 0 })
    expect(c.map((s) => s.id)).toEqual(['a', 'c', 'b'])
  })

  it('compte un score manquant comme 0 sur un match terminé', () => {
    const c = classer([joueur('a'), joueur('b')], [match('a', 'b', 1, null)])
    expect(ligne(c, 'a')).toMatchObject({ points: 3, gw: 1, gl: 0 })
    expect(ligne(c, 'b')).toMatchObject({ points: 0, losses: 1 })
  })
})

describe('computeLeaderboard : départage des égalités parfaites', () => {
  const ordre = (c: ReturnType<typeof computeLeaderboard>) => c.map((s) => s.id)

  it('à deux, la confrontation directe départage, quel que soit le tirage', () => {
    // a et b : 4 points, différence 0, 1 victoire ; b a battu a
    const matchs = [match('a', 'b', 1, 2), match('a', 'c', 2, 1), match('b', 'c', 1, 1), match('c', 'd', 1, 1), match('a', 'd', 1, 1), match('b', 'd', 1, 2)]
    for (const ligue of ['l1', 'l2', 'l3', 'l4', 'l5', 'l6']) {
      const c = computeLeaderboard([joueur('a'), joueur('b'), joueur('c'), joueur('d')], matchs, ligue)
      expect(ligne(c, 'a')).toMatchObject({ points: 4, gw: 4, gl: 4, wins: 1 })
      expect(ligne(c, 'b')).toMatchObject({ points: 4, gw: 4, gl: 4, wins: 1 })
      expect(ordre(c).indexOf('b')).toBeLessThan(ordre(c).indexOf('a'))
    }
  })

  it('match nul ou non joué entre eux : tirage fixe, stable et indépendant de l’ordre des joueurs', () => {
    const nul = [match('a', 'b', 1, 1)]
    const nonJoue = [match('a', 'b', null, null, false)]
    for (const matchs of [nul, nonJoue]) {
      const tirages = new Set<string>()
      for (let i = 0; i < 20; i++) {
        const ligue = `ligue-${i}`
        const premier = ordre(computeLeaderboard([joueur('a'), joueur('b')], matchs, ligue))
        expect(ordre(computeLeaderboard([joueur('b'), joueur('a')], matchs, ligue))).toEqual(premier)
        expect(ordre(computeLeaderboard([joueur('a'), joueur('b')], matchs, ligue))).toEqual(premier)
        tirages.add(premier.join(''))
      }
      // une autre ligue peut donner l'autre ordre
      expect(tirages).toEqual(new Set(['ab', 'ba']))
    }
  })

  it('à trois, mini-classement aux points sur leurs seuls matchs entre eux, puis tirage pour ceux qui restent', () => {
    // a, b, c : 6 points, +2, 2 victoires chacun. Entre eux : a bat b et c, b-c non joué
    // → a 6 points, b et c 0 : a devant, puis tirage fixe entre b et c.
    const matchs = [
      match('a', 'b', 2, 1), match('a', 'c', 2, 1),
      match('b', 'd', 2, 1), match('b', 'e', 2, 0),
      match('c', 'd', 2, 1), match('c', 'e', 2, 0),
    ]
    const ordres = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const c = computeLeaderboard([joueur('c'), joueur('b'), joueur('d'), joueur('e'), joueur('a')], matchs, `ligue-${i}`)
      for (const id of ['a', 'b', 'c']) expect(ligne(c, id)).toMatchObject({ points: 6, wins: 2 })
      for (const id of ['a', 'b', 'c']) expect(ligne(c, id).gw - ligne(c, id).gl).toBe(2)
      expect(ordre(c).slice(0, 3)[0]).toBe('a')
      ordres.add(ordre(c).slice(0, 3).join(''))
    }
    expect(ordres).toEqual(new Set(['abc', 'acb']))
  })

  it('à trois en cycle parfait (a > b > c > a) : tirage fixe, stable et indépendant de l’ordre des joueurs', () => {
    const matchs = [match('a', 'b', 2, 1), match('b', 'c', 2, 1), match('c', 'a', 2, 1)]
    const ordres = new Set<string>()
    for (let i = 0; i < 40; i++) {
      const ligue = `ligue-${i}`
      const c1 = ordre(computeLeaderboard([joueur('a'), joueur('b'), joueur('c')], matchs, ligue))
      expect(ordre(computeLeaderboard([joueur('c'), joueur('a'), joueur('b')], matchs, ligue))).toEqual(c1)
      ordres.add(c1.join(''))
    }
    expect(ordres.size).toBeGreaterThan(1)
  })

  it('ne change rien aux critères points, différence de manches et victoires', () => {
    const c = computeLeaderboard([joueur('b'), joueur('a'), joueur('c'), joueur('d')], [
      match('a', 'c', 2, 0),
      match('b', 'd', 2, 1),
    ], 'ligue')
    expect(ordre(c)).toEqual(['a', 'b', 'd', 'c'])
  })
})

describe('generateRoundRobinMatches', () => {
  const ids = (k: number) => Array.from({ length: k }, (_, i) => `p${i + 1}`)

  for (let k = 2; k <= 13; k++) {
    it(`${k} joueurs : chaque paire une fois, personne deux fois dans une ronde`, () => {
      const joueurs = ids(k)
      const matchs = generateRoundRobinMatches(joueurs)

      expect(matchs).toHaveLength((k * (k - 1)) / 2)
      const paires = new Set(matchs.map((m) => [m.player1_id, m.player2_id].sort().join(':')))
      expect(paires.size).toBe(matchs.length)
      for (const m of matchs) {
        expect(m.player1_id).not.toBe(m.player2_id)
        expect(joueurs).toContain(m.player1_id)
        expect(joueurs).toContain(m.player2_id)
      }

      const rondes = [...new Set(matchs.map((m) => m.round_number))].sort((a, b) => a - b)
      const attendu = k % 2 === 0 ? k - 1 : k
      expect(rondes).toEqual(Array.from({ length: attendu }, (_, i) => i + 1))

      const exempts: string[] = []
      for (const r of rondes) {
        const presents = matchs.filter((m) => m.round_number === r).flatMap((m) => [m.player1_id, m.player2_id])
        expect(new Set(presents).size).toBe(presents.length)
        const absents = joueurs.filter((j) => !presents.includes(j))
        expect(absents).toHaveLength(k % 2)
        exempts.push(...absents)
      }
      // n impair : chacun est exempt une seule fois
      if (k % 2 === 1) expect([...exempts].sort()).toEqual([...joueurs].sort())
    })
  }
})
