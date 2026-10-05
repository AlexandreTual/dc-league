import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { generateRoundRobinMatches } from './leaderboard'
import {
  ERREURS_LIGUE, generateSemifinals, insertMatches, listMatches, listPlayoffs, resetMatchScore, resetPlayoffScore,
  statusForError, updateMatchScore, updatePlayoffScore,
} from './db'
import { createLeague } from './db-leagues'

let db: D1Database

const players = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`)

beforeEach(async () => {
  db = createTestDb()
  await db.batch([
    ...players(20).map((id) => db.prepare('INSERT INTO players (id, name) VALUES (?, ?)').bind(id, `Joueur ${id}`)),
    db.prepare("INSERT INTO leagues (id, name) VALUES ('l1', 'Saison 1')"),
  ])
})

describe('insertMatches', () => {
  it('génère une ligue de 15 joueurs (105 matchs) malgré la limite de paramètres de D1', async () => {
    const defs = generateRoundRobinMatches(players(15))
    expect(defs).toHaveLength(105)
    const { data, error } = await insertMatches(db, defs, 'l1')
    expect(error).toBeNull()
    expect(data).toHaveLength(105)
    expect((await listMatches(db, 'l1')).data).toHaveLength(105)
  })
})

describe('doubles clics', () => {
  it('insertMatches refuse une deuxième génération, même simultanée', async () => {
    const defs = generateRoundRobinMatches(players(4))
    const [a, b] = await Promise.all([insertMatches(db, defs, 'l1'), insertMatches(db, defs, 'l1')])
    expect([a.error, b.error].filter(Boolean)).toEqual([ERREURS_LIGUE.matchesExist])
    expect((await listMatches(db, 'l1')).data).toHaveLength(6)
  })

  it('generateSemifinals ne crée les demi-finales qu’une fois', async () => {
    const [a, b] = await Promise.all([
      generateSemifinals(db, 'l1', 'p1', 'p2', 'p3', 'p4'),
      generateSemifinals(db, 'l1', 'p1', 'p2', 'p3', 'p4'),
    ])
    expect([a.error, b.error].filter(Boolean)).toEqual([ERREURS_LIGUE.playoffsExist])
    expect((await listPlayoffs(db, 'l1')).data!.map((p) => p.stage)).toEqual(['semi1', 'semi2'])
  })

  it('createLeague ne crée qu’une ligue active', async () => {
    await db.prepare("UPDATE leagues SET is_active = 0 WHERE id = 'l1'").run()
    const [a, b] = await Promise.all([createLeague(db, 'Saison 2'), createLeague(db, 'Saison 2 bis')])
    expect([a.error, b.error].filter(Boolean)).toEqual(['Une ligue est déjà active.'])
    const row = await db.prepare('SELECT COUNT(*) AS n FROM leagues WHERE is_active = 1').first<{ n: number }>()
    expect(row?.n).toBe(1)
  })

  it('la finale n’est créée qu’une fois quand les deux demi-finales sont saisies en même temps', async () => {
    const semis = (await generateSemifinals(db, 'l1', 'p1', 'p2', 'p3', 'p4')).data!
    await Promise.all(semis.map((s) => updatePlayoffScore(db, s.id, 2, 0)))
    expect((await listPlayoffs(db, 'l1')).data!.map((p) => p.stage)).toEqual(['semi1', 'semi2', 'final', 'third_place'])
    await Promise.all(semis.map((s) => updatePlayoffScore(db, s.id, 2, 0)))
    expect((await listPlayoffs(db, 'l1')).data!.map((p) => p.stage)).toEqual(['semi1', 'semi2', 'final', 'third_place'])
  })
})

describe('ligue close et match inconnu', () => {
  async function ligueClose() {
    const [m] = (await insertMatches(db, generateRoundRobinMatches(players(4)), 'l1')).data!
    const semis = (await generateSemifinals(db, 'l1', 'p1', 'p2', 'p3', 'p4')).data!
    await updateMatchScore(db, m.id, 2, 0)
    await updatePlayoffScore(db, semis[0].id, 2, 0)
    await db.prepare("UPDATE leagues SET is_active = 0, ended_at = datetime('now') WHERE id = 'l1'").run()
    return { m, semi: semis[0] }
  }

  it('refuse de modifier ou réinitialiser le score d’un match de ligue close', async () => {
    const { m } = await ligueClose()
    expect((await updateMatchScore(db, m.id, 0, 2)).error).toBe(ERREURS_LIGUE.leagueClosed)
    expect((await resetMatchScore(db, m.id)).error).toBe(ERREURS_LIGUE.leagueClosed)
    expect((await listMatches(db, 'l1')).data!.find((x) => x.id === m.id)).toMatchObject({ score_p1: 2, score_p2: 0 })
  })

  it('refuse de modifier ou réinitialiser un score de playoffs de ligue close', async () => {
    const { semi } = await ligueClose()
    expect((await updatePlayoffScore(db, semi.id, 0, 2)).error).toBe(ERREURS_LIGUE.leagueClosed)
    expect((await resetPlayoffScore(db, semi.id)).error).toBe(ERREURS_LIGUE.leagueClosed)
    expect((await listPlayoffs(db, 'l1')).data!.find((x) => x.id === semi.id)).toMatchObject({ score_p1: 2, score_p2: 0 })
  })

  it('renvoie une erreur en français pour un match inconnu', async () => {
    expect((await updateMatchScore(db, 'inconnu', 2, 0)).error).toBe(ERREURS_LIGUE.matchNotFound)
    expect((await resetMatchScore(db, 'inconnu')).error).toBe(ERREURS_LIGUE.matchNotFound)
    expect((await updatePlayoffScore(db, 'inconnu', 2, 0)).error).toBe(ERREURS_LIGUE.playoffNotFound)
    expect((await resetPlayoffScore(db, 'inconnu')).error).toBe(ERREURS_LIGUE.playoffNotFound)
  })

  it('associe un statut HTTP à chaque erreur', () => {
    expect(statusForError(ERREURS_LIGUE.matchNotFound)).toBe(404)
    expect(statusForError(ERREURS_LIGUE.playoffNotFound)).toBe(404)
    expect(statusForError(ERREURS_LIGUE.leagueClosed)).toBe(409)
    expect(statusForError(ERREURS_LIGUE.finalScored)).toBe(409)
    expect(statusForError(ERREURS_LIGUE.matchesExist)).toBe(409)
    expect(statusForError('SQLITE_BUSY')).toBe(500)
  })

  it('les scores d’une ligue active restent modifiables', async () => {
    const [m] = (await insertMatches(db, generateRoundRobinMatches(players(4)), 'l1')).data!
    expect((await updateMatchScore(db, m.id, 2, 1)).data).toMatchObject({ score_p1: 2, score_p2: 1, is_completed: true })
    expect((await resetMatchScore(db, m.id)).data).toMatchObject({ score_p1: null, is_completed: false })
  })
})

describe('correction d’une demi-finale', () => {
  // semi1 : p1 contre p4, semi2 : p2 contre p3.
  async function demiFinalesJouees() {
    const semis = (await generateSemifinals(db, 'l1', 'p1', 'p2', 'p3', 'p4')).data!
    const s1 = semis.find((p) => p.stage === 'semi1')!
    const s2 = semis.find((p) => p.stage === 'semi2')!
    await updatePlayoffScore(db, s1.id, 2, 0)
    await updatePlayoffScore(db, s2.id, 2, 1)
    return { s1, s2 }
  }
  const stage = async (s: string) => (await listPlayoffs(db, 'l1')).data!.find((p) => p.stage === s)!

  it('met à jour la finale et la petite finale quand le vainqueur change', async () => {
    const { s1 } = await demiFinalesJouees()
    expect(await stage('final')).toMatchObject({ player1_id: 'p1', player2_id: 'p2' })
    expect(await stage('third_place')).toMatchObject({ player1_id: 'p4', player2_id: 'p3' })

    const { data, error } = await updatePlayoffScore(db, s1.id, 1, 2)
    expect(error).toBeNull()
    const final = await stage('final')
    const third = await stage('third_place')
    expect(final).toMatchObject({ player1_id: 'p4', player2_id: 'p2' })
    expect(third).toMatchObject({ player1_id: 'p1', player2_id: 'p3' })
    expect(data!.generated.map((p) => p.id).sort()).toEqual([final.id, third.id].sort())
    expect((await listPlayoffs(db, 'l1')).data).toHaveLength(4)
  })

  it('ne touche à rien si le vainqueur ne change pas', async () => {
    const { s1 } = await demiFinalesJouees()
    const final = await stage('final')
    await updatePlayoffScore(db, final.id, 2, 0)
    const { data, error } = await updatePlayoffScore(db, s1.id, 2, 1)
    expect(error).toBeNull()
    expect(data!.generated).toEqual([])
    expect(await stage('semi1')).toMatchObject({ score_p1: 2, score_p2: 1 })
    expect(await stage('final')).toMatchObject({ player1_id: 'p1', player2_id: 'p2', score_p1: 2 })
  })

  it('refuse la correction si la finale a déjà un score', async () => {
    const { s1 } = await demiFinalesJouees()
    await updatePlayoffScore(db, (await stage('final')).id, 2, 0)
    expect((await updatePlayoffScore(db, s1.id, 0, 2)).error).toBe(ERREURS_LIGUE.finalScored)
    expect(await stage('semi1')).toMatchObject({ score_p1: 2, score_p2: 0 })
    expect(await stage('final')).toMatchObject({ player1_id: 'p1', player2_id: 'p2' })
  })

  it('refuse la correction si la petite finale a déjà un score', async () => {
    const { s2 } = await demiFinalesJouees()
    await updatePlayoffScore(db, (await stage('third_place')).id, 2, 0)
    expect((await updatePlayoffScore(db, s2.id, 0, 2)).error).toBe(ERREURS_LIGUE.finalScored)
    expect(await stage('semi2')).toMatchObject({ score_p1: 2, score_p2: 1 })
  })
})
