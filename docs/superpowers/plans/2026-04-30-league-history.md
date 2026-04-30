# League History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-season system with per-league player deck tracking and a public history page.

**Architecture:** Add `leagues` + `league_players` tables to SQLite. All match/playoff queries scope to an active league. A public `/history` page lists archived seasons with full results. The commander card image displays as a tooltip on player names.

**Tech Stack:** Next.js 14 App Router, SQLite (better-sqlite3), Tailwind CSS, TypeScript, Lucide icons.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `next.config.mjs` | Add `assets.moxfield.net` image domain |
| Modify | `lib/leaderboard.ts` | Add optional deck fields to `Player` type |
| Modify | `lib/db.ts` | New tables, migration, updated query signatures |
| Create | `lib/db-leagues.ts` | League + league_players CRUD |
| Create | `app/api/leagues/route.ts` | GET list, POST create |
| Create | `app/api/leagues/[id]/close/route.ts` | POST close season |
| Modify | `app/api/players/route.ts` | POST/DELETE go through `league_players` |
| Modify | `app/api/matches/generate/route.ts` | Pass `leagueId` to `insertMatches` |
| Modify | `app/api/playoffs/route.ts` | Scope all queries to active league |
| Create | `components/PlayerName.tsx` | Name + commander card tooltip (hover/tap) |
| Modify | `components/LeaderboardTable.tsx` | Use `PlayerName`, accept deck fields |
| Modify | `components/MatchCard.tsx` | Use `PlayerName` |
| Modify | `components/Navbar.tsx` | Add Historique link |
| Modify | `app/page.tsx` | Fetch league + deck data, merge into leaderboard |
| Modify | `app/admin/page.tsx` | Fetch `activeLeague` + `leaguePlayers` |
| Modify | `app/admin/AdminDashboard.tsx` | Season management UI + commander fields |
| Create | `app/history/page.tsx` | List archived seasons |
| Create | `app/history/[id]/page.tsx` | Season detail: standings + matches + bracket |

---

## Task 1: Config + Player type

**Files:**
- Modify: `next.config.mjs`
- Modify: `lib/leaderboard.ts`

- [ ] **Step 1: Update `next.config.mjs` to allow moxfield.net images**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.moxfield.com' },
      { protocol: 'https', hostname: '**.moxfield.net' },
    ],
  },
};
export default nextConfig;
```

- [ ] **Step 2: Add deck fields to `Player` type in `lib/leaderboard.ts`**

Replace the `Player` type (lines 1-7):

```ts
export type Player = {
  id: string
  name: string
  avatar_url: string | null
  created_at: string
  moxfield_url?: string | null        // populated from league_players for display
  commander_image_url?: string | null  // populated from league_players for display
}
```

- [ ] **Step 3: Run build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add next.config.mjs lib/leaderboard.ts
git commit -m "feat: add moxfield.net image domain + commander_image_url to Player type"
```

---

## Task 2: DB schema — leagues + league_players + migration

**Files:**
- Modify: `lib/db.ts`

The `getDb()` function needs three changes:
1. Add `leagues` and `league_players` tables to the `CREATE TABLE IF NOT EXISTS` block
2. Add `league_id` column to `matches` and `playoffs` (idempotent ALTER TABLE)
3. Migrate orphaned rows (matches without `league_id`) to a default "Saison 1"

- [ ] **Step 1: Export `getDb` so `lib/db-leagues.ts` can import it**

Change `function getDb()` to `export function getDb()` in `lib/db.ts`.

- [ ] **Step 2: Extend the SQL schema block in `getDb()`**

Inside the `db['exec']` call (the large `CREATE TABLE IF NOT EXISTS` block), add these two tables after the `players` table definition:

```sql
CREATE TABLE IF NOT EXISTS leagues (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at    TEXT,
  is_active   INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS league_players (
  league_id           TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id           TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  moxfield_url        TEXT,
  commander_image_url TEXT,
  PRIMARY KEY (league_id, player_id)
);
```

- [ ] **Step 3: Add ALTER TABLE + migration block after the schema exec call and before `g.__sqlite = db`**

```ts
  // Add league_id to existing tables — idempotent, throws if column already exists
  try { db.prepare('ALTER TABLE matches ADD COLUMN league_id TEXT REFERENCES leagues(id)').run() } catch {}
  try { db.prepare('ALTER TABLE playoffs ADD COLUMN league_id TEXT REFERENCES leagues(id)').run() } catch {}

  // Migrate orphaned rows to a default "Saison 1"
  const orphaned = db
    .prepare('SELECT COUNT(*) as n FROM matches WHERE league_id IS NULL')
    .get() as { n: number }

  if (orphaned.n > 0) {
    const legacyId = uuid()
    db.transaction(() => {
      db.prepare(
        `INSERT INTO leagues (id, name, started_at, is_active) VALUES (?, 'Saison 1', datetime('now'), 1)`
      ).run(legacyId)
      db.prepare('UPDATE matches SET league_id = ? WHERE league_id IS NULL').run(legacyId)
      db.prepare('UPDATE playoffs SET league_id = ? WHERE league_id IS NULL').run(legacyId)
      const oldPlayers = db
        .prepare('SELECT id, moxfield_url FROM players WHERE moxfield_url IS NOT NULL')
        .all() as Array<{ id: string; moxfield_url: string }>
      const ins = db.prepare(
        'INSERT OR IGNORE INTO league_players (league_id, player_id, moxfield_url) VALUES (?, ?, ?)'
      )
      for (const p of oldPlayers) ins.run(legacyId, p.id, p.moxfield_url)
    })()
  }
```

Note: `ALTER TABLE ... ADD COLUMN` via `prepare().run()` is used instead of `db.exec()` to keep each statement idempotent and catchable individually.

- [ ] **Step 4: Run build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts
git commit -m "feat: add leagues + league_players schema with migration"
```

---

## Task 3: Update match/playoff DB functions to accept `leagueId`

**Files:**
- Modify: `lib/db.ts`

- [ ] **Step 1: Replace `listMatches`**

```ts
export function listMatches(leagueId: string, orderByRound = true): Result<DbMatch[]> {
  try {
    const sql = orderByRound
      ? 'SELECT * FROM matches WHERE league_id = ? ORDER BY round_number ASC, created_at ASC'
      : 'SELECT * FROM matches WHERE league_id = ? ORDER BY created_at ASC'
    const rows = getDb().prepare(sql).all(leagueId) as Record<string, unknown>[]
    return ok(rows.map(normalizeMatch))
  } catch (e) {
    return err((e as Error).message)
  }
}
```

- [ ] **Step 2: Replace `listCompletedMatches`**

```ts
export function listCompletedMatches(leagueId: string): Result<DbMatch[]> {
  try {
    const rows = getDb()
      .prepare('SELECT * FROM matches WHERE league_id = ? AND is_completed = 1')
      .all(leagueId) as Record<string, unknown>[]
    return ok(rows.map(normalizeMatch))
  } catch (e) {
    return err((e as Error).message)
  }
}
```

- [ ] **Step 3: Replace `countMatches` and `countCompletedMatches`**

```ts
export function countMatches(leagueId: string): Result<number> {
  try {
    const row = getDb()
      .prepare('SELECT COUNT(*) as n FROM matches WHERE league_id = ?')
      .get(leagueId) as { n: number }
    return ok(row.n)
  } catch (e) {
    return err((e as Error).message)
  }
}

export function countCompletedMatches(leagueId: string): Result<number> {
  try {
    const row = getDb()
      .prepare('SELECT COUNT(*) as n FROM matches WHERE league_id = ? AND is_completed = 1')
      .get(leagueId) as { n: number }
    return ok(row.n)
  } catch (e) {
    return err((e as Error).message)
  }
}
```

- [ ] **Step 4: Replace `insertMatches`**

```ts
export function insertMatches(
  matches: Array<{ player1_id: string; player2_id: string; round_number: number }>,
  leagueId: string
): Result<DbMatch[]> {
  try {
    const db = getDb()
    const insert = db.prepare(
      'INSERT INTO matches (id, player1_id, player2_id, round_number, league_id) VALUES (?, ?, ?, ?, ?)'
    )
    const ids: string[] = []
    db.transaction(() => {
      for (const m of matches) {
        const id = uuid()
        ids.push(id)
        insert.run(id, m.player1_id, m.player2_id, m.round_number, leagueId)
      }
    })()
    const rows = db
      .prepare(`SELECT * FROM matches WHERE id IN (${ids.map(() => '?').join(',')})`)
      .all(...ids) as Record<string, unknown>[]
    return ok(rows.map(normalizeMatch))
  } catch (e) {
    return err((e as Error).message)
  }
}
```

- [ ] **Step 5: Replace `deleteAllMatches`**

```ts
export function deleteAllMatches(leagueId: string): Result<true> {
  try {
    getDb().prepare('DELETE FROM matches WHERE league_id = ?').run(leagueId)
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}
```

- [ ] **Step 6: Replace `listPlayoffs`, `hasPlayoffs`, `generateSemifinals`, `deleteAllPlayoffs`**

```ts
export function listPlayoffs(leagueId: string): Result<DbPlayoff[]> {
  try {
    const rows = getDb()
      .prepare('SELECT * FROM playoffs WHERE league_id = ? ORDER BY created_at ASC')
      .all(leagueId) as Record<string, unknown>[]
    const sorted = rows
      .map(normalizePlayoff)
      .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))
    return ok(sorted)
  } catch (e) {
    return err((e as Error).message)
  }
}

export function hasPlayoffs(leagueId: string): Result<boolean> {
  try {
    const row = getDb()
      .prepare('SELECT COUNT(*) as n FROM playoffs WHERE league_id = ?')
      .get(leagueId) as { n: number }
    return ok(row.n > 0)
  } catch (e) {
    return err((e as Error).message)
  }
}

export function generateSemifinals(
  leagueId: string,
  rank1Id: string, rank2Id: string, rank3Id: string, rank4Id: string
): Result<DbPlayoff[]> {
  try {
    const db = getDb()
    const insert = db.prepare(
      'INSERT INTO playoffs (id, stage, player1_id, player2_id, league_id) VALUES (?, ?, ?, ?, ?)'
    )
    const ids: string[] = []
    db.transaction(() => {
      const id1 = uuid(); ids.push(id1)
      insert.run(id1, 'semi1', rank1Id, rank4Id, leagueId)
      const id2 = uuid(); ids.push(id2)
      insert.run(id2, 'semi2', rank2Id, rank3Id, leagueId)
    })()
    const rows = db
      .prepare(`SELECT * FROM playoffs WHERE id IN (${ids.map(() => '?').join(',')})`)
      .all(...ids) as Record<string, unknown>[]
    return ok(rows.map(normalizePlayoff))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function deleteAllPlayoffs(leagueId: string): Result<true> {
  try {
    getDb().prepare('DELETE FROM playoffs WHERE league_id = ?').run(leagueId)
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}
```

- [ ] **Step 7: Replace `updatePlayoffScore` to read `league_id` from the row**

```ts
export function updatePlayoffScore(
  id: string,
  score_p1: number,
  score_p2: number
): Result<{ match: DbPlayoff; generated: DbPlayoff[] }> {
  try {
    const db = getDb()
    db.prepare(
      'UPDATE playoffs SET score_p1 = ?, score_p2 = ?, is_completed = 1 WHERE id = ?'
    ).run(score_p1, score_p2, id)

    const updatedRow = db.prepare('SELECT * FROM playoffs WHERE id = ?')
      .get(id) as Record<string, unknown>
    const updated = normalizePlayoff(updatedRow)
    const leagueId = updatedRow.league_id as string

    let generated: DbPlayoff[] = []
    if (updated.stage === 'semi1' || updated.stage === 'semi2') {
      const semi1 = db.prepare("SELECT * FROM playoffs WHERE stage = 'semi1' AND league_id = ?")
        .get(leagueId) as Record<string, unknown> | undefined
      const semi2 = db.prepare("SELECT * FROM playoffs WHERE stage = 'semi2' AND league_id = ?")
        .get(leagueId) as Record<string, unknown> | undefined
      const finalExists = db
        .prepare("SELECT id FROM playoffs WHERE stage = 'final' AND league_id = ?")
        .get(leagueId)

      if (semi1 && semi2 && !finalExists) {
        const s1 = normalizePlayoff(semi1)
        const s2 = normalizePlayoff(semi2)
        if (s1.is_completed && s2.is_completed) {
          const p1WonSemi1 = (s1.score_p1 ?? 0) >= (s1.score_p2 ?? 0)
          const winner1 = p1WonSemi1 ? s1.player1_id : s1.player2_id
          const loser1  = p1WonSemi1 ? s1.player2_id : s1.player1_id
          const p1WonSemi2 = (s2.score_p1 ?? 0) >= (s2.score_p2 ?? 0)
          const winner2 = p1WonSemi2 ? s2.player1_id : s2.player2_id
          const loser2  = p1WonSemi2 ? s2.player2_id : s2.player1_id

          const ins = db.prepare(
            'INSERT INTO playoffs (id, stage, player1_id, player2_id, league_id) VALUES (?, ?, ?, ?, ?)'
          )
          const genIds: string[] = []
          db.transaction(() => {
            const fId = uuid(); genIds.push(fId)
            ins.run(fId, 'final', winner1, winner2, leagueId)
            const tId = uuid(); genIds.push(tId)
            ins.run(tId, 'third_place', loser1, loser2, leagueId)
          })()
          const genRows = db
            .prepare(`SELECT * FROM playoffs WHERE id IN (${genIds.map(() => '?').join(',')})`)
            .all(...genIds) as Record<string, unknown>[]
          generated = genRows.map(normalizePlayoff)
        }
      }
    }
    return ok({ match: updated, generated })
  } catch (e) {
    return err((e as Error).message)
  }
}
```

- [ ] **Step 8: Run build**

```bash
npm run build
```

Expected: TypeScript errors in API routes (old signatures) — fixed in Tasks 6 & 7.

- [ ] **Step 9: Commit**

```bash
git add lib/db.ts
git commit -m "feat: scope match/playoff queries to leagueId"
```

---

## Task 4: Create `lib/db-leagues.ts`

**Files:**
- Create: `lib/db-leagues.ts`

- [ ] **Step 1: Create the file**

```ts
import { getDb } from './db'
import type { DbMatch, DbPlayoff } from './db'
import crypto from 'crypto'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DbLeague = {
  id: string
  name: string
  started_at: string
  ended_at: string | null
  is_active: boolean
}

export type DbLeaguePlayer = {
  league_id: string
  player_id: string
  moxfield_url: string | null
  commander_image_url: string | null
}

export type DbLeaguePlayerWithName = DbLeaguePlayer & {
  name: string
  avatar_url: string | null
}

type Ok<T> = { data: T; error: null }
type Err = { data: null; error: string }
type Result<T> = Ok<T> | Err
function ok<T>(data: T): Ok<T> { return { data, error: null } }
function err(msg: string): Err { return { data: null, error: msg } }
function uuid() { return crypto.randomUUID() }

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeLeague(row: Record<string, unknown>): DbLeague {
  return {
    id: row.id as string,
    name: row.name as string,
    started_at: row.started_at as string,
    ended_at: (row.ended_at as string) ?? null,
    is_active: Number(row.is_active) === 1,
  }
}

function normalizeLeaguePlayer(row: Record<string, unknown>): DbLeaguePlayer {
  return {
    league_id: row.league_id as string,
    player_id: row.player_id as string,
    moxfield_url: (row.moxfield_url as string) ?? null,
    commander_image_url: (row.commander_image_url as string) ?? null,
  }
}

function normalizeLeaguePlayerWithName(row: Record<string, unknown>): DbLeaguePlayerWithName {
  return {
    ...normalizeLeaguePlayer(row),
    name: row.name as string,
    avatar_url: (row.avatar_url as string) ?? null,
  }
}

// ── Leagues ───────────────────────────────────────────────────────────────────

export function listLeagues(): Result<DbLeague[]> {
  try {
    const rows = getDb()
      .prepare('SELECT * FROM leagues ORDER BY started_at DESC')
      .all() as Record<string, unknown>[]
    return ok(rows.map(normalizeLeague))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function listArchivedLeagues(): Result<DbLeague[]> {
  try {
    const rows = getDb()
      .prepare('SELECT * FROM leagues WHERE is_active = 0 ORDER BY ended_at DESC')
      .all() as Record<string, unknown>[]
    return ok(rows.map(normalizeLeague))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function getActiveLeague(): Result<DbLeague | null> {
  try {
    const row = getDb()
      .prepare('SELECT * FROM leagues WHERE is_active = 1 LIMIT 1')
      .get() as Record<string, unknown> | undefined
    return ok(row ? normalizeLeague(row) : null)
  } catch (e) {
    return err((e as Error).message)
  }
}

export function createLeague(name: string): Result<DbLeague> {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT id FROM leagues WHERE is_active = 1').get()
    if (existing) return err('Une ligue est déjà active.')
    const id = uuid()
    db.prepare(
      `INSERT INTO leagues (id, name, started_at, is_active) VALUES (?, ?, datetime('now'), 1)`
    ).run(id, name)
    const row = db.prepare('SELECT * FROM leagues WHERE id = ?').get(id) as Record<string, unknown>
    return ok(normalizeLeague(row))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function closeLeague(id: string): Result<DbLeague> {
  try {
    const db = getDb()
    db.prepare(
      `UPDATE leagues SET is_active = 0, ended_at = datetime('now') WHERE id = ?`
    ).run(id)
    const row = db.prepare('SELECT * FROM leagues WHERE id = ?').get(id) as Record<string, unknown>
    return ok(normalizeLeague(row))
  } catch (e) {
    return err((e as Error).message)
  }
}

// ── League Players ─────────────────────────────────────────────────────────────

export function listLeaguePlayers(leagueId: string): Result<DbLeaguePlayerWithName[]> {
  try {
    const rows = getDb()
      .prepare(`
        SELECT lp.*, p.name, p.avatar_url
        FROM league_players lp
        JOIN players p ON p.id = lp.player_id
        WHERE lp.league_id = ?
        ORDER BY p.name ASC
      `)
      .all(leagueId) as Record<string, unknown>[]
    return ok(rows.map(normalizeLeaguePlayerWithName))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function upsertLeaguePlayer(
  leagueId: string,
  playerId: string,
  data: { moxfield_url?: string | null; commander_image_url?: string | null }
): Result<DbLeaguePlayer> {
  try {
    const db = getDb()
    db.prepare(`
      INSERT INTO league_players (league_id, player_id, moxfield_url, commander_image_url)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(league_id, player_id) DO UPDATE SET
        moxfield_url = excluded.moxfield_url,
        commander_image_url = excluded.commander_image_url
    `).run(leagueId, playerId, data.moxfield_url ?? null, data.commander_image_url ?? null)

    const row = db
      .prepare('SELECT * FROM league_players WHERE league_id = ? AND player_id = ?')
      .get(leagueId, playerId) as Record<string, unknown>
    return ok(normalizeLeaguePlayer(row))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function removeLeaguePlayer(leagueId: string, playerId: string): Result<true> {
  try {
    getDb()
      .prepare('DELETE FROM league_players WHERE league_id = ? AND player_id = ?')
      .run(leagueId, playerId)
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

// ── History Detail ─────────────────────────────────────────────────────────────

export function getLeagueDetail(id: string): Result<{
  league: DbLeague
  leaguePlayers: DbLeaguePlayerWithName[]
  matches: DbMatch[]
  playoffs: DbPlayoff[]
} | null> {
  try {
    const db = getDb()
    const leagueRow = db
      .prepare('SELECT * FROM leagues WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined
    if (!leagueRow) return ok(null)

    const { data: leaguePlayers } = listLeaguePlayers(id)

    const matchRows = db
      .prepare('SELECT * FROM matches WHERE league_id = ? ORDER BY round_number ASC, created_at ASC')
      .all(id) as Record<string, unknown>[]

    const STAGE_ORDER = ['semi1', 'semi2', 'final', 'third_place']
    const playoffRows = db
      .prepare('SELECT * FROM playoffs WHERE league_id = ? ORDER BY created_at ASC')
      .all(id) as Record<string, unknown>[]

    const matches: DbMatch[] = matchRows.map((row) => ({
      id: row.id as string,
      player1_id: row.player1_id as string,
      player2_id: row.player2_id as string,
      score_p1: row.score_p1 != null ? Number(row.score_p1) : null,
      score_p2: row.score_p2 != null ? Number(row.score_p2) : null,
      is_completed: Number(row.is_completed) === 1,
      round_number: Number(row.round_number),
      created_at: row.created_at as string,
    }))

    const playoffs: DbPlayoff[] = playoffRows
      .map((row) => ({
        id: row.id as string,
        stage: row.stage as DbPlayoff['stage'],
        player1_id: (row.player1_id as string) ?? null,
        player2_id: (row.player2_id as string) ?? null,
        score_p1: row.score_p1 != null ? Number(row.score_p1) : null,
        score_p2: row.score_p2 != null ? Number(row.score_p2) : null,
        is_completed: Number(row.is_completed) === 1,
        created_at: row.created_at as string,
      }))
      .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))

    return ok({
      league: normalizeLeague(leagueRow),
      leaguePlayers: leaguePlayers ?? [],
      matches,
      playoffs,
    })
  } catch (e) {
    return err((e as Error).message)
  }
}
```

- [ ] **Step 2: Run build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add lib/db-leagues.ts lib/db.ts
git commit -m "feat: add db-leagues with league/league_players CRUD"
```

---

## Task 5: API routes — leagues

**Files:**
- Create: `app/api/leagues/route.ts`
- Create: `app/api/leagues/[id]/close/route.ts`

- [ ] **Step 1: Create `app/api/leagues/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import { listLeagues, createLeague } from '@/lib/db-leagues'

export async function GET() {
  const { data, error } = listLeagues()
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { name } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Le nom de la saison est requis' }, { status: 400 })
  }
  const { data, error } = createLeague(name.trim())
  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/leagues/[id]/close/route.ts`** (create directories: `mkdir -p app/api/leagues/\[id\]/close`)

```ts
import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import { closeLeague } from '@/lib/db-leagues'
import { countMatches, countCompletedMatches, hasPlayoffs, listPlayoffs } from '@/lib/db'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { id } = params

  const { data: total } = countMatches(id)
  const { data: completed } = countCompletedMatches(id)
  if ((total ?? 0) > 0 && total !== completed) {
    return NextResponse.json(
      { error: `Il reste ${(total ?? 0) - (completed ?? 0)} match(s) de ligue à jouer.` },
      { status: 400 }
    )
  }

  const { data: hasP } = hasPlayoffs(id)
  if (hasP) {
    const { data: poffs } = listPlayoffs(id)
    const allDone = poffs?.every((p) => p.is_completed) ?? false
    if (!allDone) {
      return NextResponse.json(
        { error: 'Des matchs de playoffs ne sont pas encore joués.' },
        { status: 400 }
      )
    }
  }

  const { data, error } = closeLeague(id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 3: Run build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add app/api/leagues/
git commit -m "feat: add leagues API (list, create, close)"
```

---

## Task 6: Update `app/api/players/route.ts`

**Files:**
- Modify: `app/api/players/route.ts`
- Modify: `lib/db.ts` (update `insertPlayer` signature)

- [ ] **Step 1: Update `insertPlayer` in `lib/db.ts` — remove `moxfield_url` param**

```ts
export function insertPlayer(data: { name: string }): Result<DbPlayer> {
  try {
    const id = uuid()
    getDb()
      .prepare('INSERT INTO players (id, name) VALUES (?, ?)')
      .run(id, data.name)
    const row = getDb()
      .prepare('SELECT * FROM players WHERE id = ?')
      .get(id) as Record<string, unknown>
    return ok(normalizePlayer(row))
  } catch (e) {
    return err((e as Error).message)
  }
}
```

- [ ] **Step 2: Replace `app/api/players/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import { listPlayers, insertPlayer, deletePlayer, countMatches } from '@/lib/db'
import { getActiveLeague, upsertLeaguePlayer } from '@/lib/db-leagues'

export async function GET() {
  const { data, error } = listPlayers()
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data: league, error: leagueErr } = getActiveLeague()
  if (leagueErr) return NextResponse.json({ error: leagueErr }, { status: 500 })
  if (!league) {
    return NextResponse.json(
      { error: "Aucune ligue active. Créez une saison d'abord." },
      { status: 400 }
    )
  }

  const { name, moxfield_url, commander_image_url } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
  }

  const { data: count, error: countErr } = countMatches(league.id)
  if (countErr) return NextResponse.json({ error: countErr }, { status: 500 })
  if (count && count > 0) {
    return NextResponse.json(
      { error: "La ligue a déjà été générée. Impossible d'ajouter un joueur." },
      { status: 400 }
    )
  }

  const { data: player, error: playerErr } = insertPlayer({ name: name.trim() })
  if (playerErr) return NextResponse.json({ error: playerErr }, { status: 500 })

  const { error: lpErr } = upsertLeaguePlayer(league.id, player!.id, {
    moxfield_url: moxfield_url?.trim() || null,
    commander_image_url: commander_image_url?.trim() || null,
  })
  if (lpErr) return NextResponse.json({ error: lpErr }, { status: 500 })

  return NextResponse.json(
    {
      ...player,
      moxfield_url: moxfield_url?.trim() || null,
      commander_image_url: commander_image_url?.trim() || null,
    },
    { status: 201 }
  )
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data: league } = getActiveLeague()
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  if (league) {
    const { data: count, error: countErr } = countMatches(league.id)
    if (countErr) return NextResponse.json({ error: countErr }, { status: 500 })
    if (count && count > 0) {
      return NextResponse.json(
        { error: 'La ligue a déjà été générée. Impossible de supprimer un joueur.' },
        { status: 400 }
      )
    }
  }

  const { error } = deletePlayer(id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Run build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add app/api/players/route.ts lib/db.ts
git commit -m "feat: players API creates league_players record for active league"
```

---

## Task 7: Update matches + playoffs API routes

**Files:**
- Modify: `app/api/matches/generate/route.ts`
- Modify: `app/api/playoffs/route.ts`

- [ ] **Step 1: Replace `app/api/matches/generate/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import { generateRoundRobinMatches } from '@/lib/leaderboard'
import { countMatches, listPlayers, insertMatches, deleteAllMatches, deleteAllPlayoffs } from '@/lib/db'
import { getActiveLeague } from '@/lib/db-leagues'

export async function POST() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { data: league } = getActiveLeague()
  if (!league) return NextResponse.json({ error: 'Aucune ligue active.' }, { status: 400 })

  const { data: existing, error: countErr } = countMatches(league.id)
  if (countErr) return NextResponse.json({ error: countErr }, { status: 500 })
  if (existing && existing > 0) {
    return NextResponse.json({ error: 'Les matchs ont déjà été générés.' }, { status: 400 })
  }

  const { data: players, error: playersErr } = listPlayers()
  if (playersErr) return NextResponse.json({ error: playersErr }, { status: 500 })
  if (!players || players.length < 2) {
    return NextResponse.json(
      { error: 'Il faut au moins 2 joueurs pour générer la ligue.' },
      { status: 400 }
    )
  }

  const matchDefs = generateRoundRobinMatches(players.map((p) => p.id))
  const { data, error } = insertMatches(matchDefs, league.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true, count: data?.length ?? 0 }, { status: 201 })
}

export async function DELETE() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { data: league } = getActiveLeague()
  if (!league) return NextResponse.json({ error: 'Aucune ligue active.' }, { status: 400 })

  const { error } = deleteAllMatches(league.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  deleteAllPlayoffs(league.id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Replace `app/api/playoffs/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import {
  listPlayoffs, hasPlayoffs, generateSemifinals, deleteAllPlayoffs,
  countMatches, countCompletedMatches, listPlayers, listCompletedMatches,
} from '@/lib/db'
import { computeLeaderboard, Player, Match } from '@/lib/leaderboard'
import { getActiveLeague } from '@/lib/db-leagues'

export async function GET() {
  const { data: league } = getActiveLeague()
  if (!league) return NextResponse.json([])
  const { data, error } = listPlayoffs(league.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { data: league } = getActiveLeague()
  if (!league) return NextResponse.json({ error: 'Aucune ligue active.' }, { status: 400 })

  const { data: total } = countMatches(league.id)
  const { data: completed } = countCompletedMatches(league.id)
  if (!total || total === 0) {
    return NextResponse.json({ error: 'Aucun match de ligue généré.' }, { status: 400 })
  }
  if (total !== completed) {
    return NextResponse.json(
      { error: `Il reste ${(total ?? 0) - (completed ?? 0)} match(s) de ligue à jouer.` },
      { status: 400 }
    )
  }
  const { data: already } = hasPlayoffs(league.id)
  if (already) {
    return NextResponse.json({ error: 'Les playoffs ont déjà été générés.' }, { status: 400 })
  }

  const { data: players } = listPlayers()
  const { data: matches } = listCompletedMatches(league.id)
  const leaderboard = computeLeaderboard(
    (players ?? []) as Player[],
    (matches ?? []) as Match[]
  )
  if (leaderboard.length < 4) {
    return NextResponse.json(
      { error: 'Il faut au moins 4 joueurs pour générer les playoffs.' },
      { status: 400 }
    )
  }

  const [rank1, rank2, rank3, rank4] = leaderboard
  const { data, error } = generateSemifinals(league.id, rank1.id, rank2.id, rank3.id, rank4.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { data: league } = getActiveLeague()
  if (!league) return NextResponse.json({ error: 'Aucune ligue active.' }, { status: 400 })
  const { error } = deleteAllPlayoffs(league.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Run build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add app/api/matches/generate/route.ts app/api/playoffs/route.ts
git commit -m "feat: scope matches/playoffs API routes to active league"
```

---

## Task 8: `PlayerName` component

**Files:**
- Create: `components/PlayerName.tsx`

- [ ] **Step 1: Create `components/PlayerName.tsx`**

```tsx
'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'

interface Props {
  name: string
  commanderImageUrl?: string | null
  className?: string
}

export default function PlayerName({ name, commanderImageUrl, className = '' }: Props) {
  const [visible, setVisible] = useState(false)
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>()

  if (!commanderImageUrl) {
    return <span className={className}>{name}</span>
  }

  return (
    <span
      className={`relative inline-block cursor-pointer ${className}`}
      onMouseEnter={() => { clearTimeout(hideTimeout.current); setVisible(true) }}
      onMouseLeave={() => { hideTimeout.current = setTimeout(() => setVisible(false), 150) }}
      onClick={() => setVisible((v) => !v)}
    >
      <span className="border-b border-dashed border-dc-gold/60">{name}</span>
      {visible && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none block">
          <Image
            src={commanderImageUrl}
            alt={`Commandant de ${name}`}
            width={180}
            height={251}
            className="rounded-xl shadow-xl border border-dc-gold/20"
            unoptimized={commanderImageUrl.includes('?')}
          />
        </span>
      )}
    </span>
  )
}
```

- [ ] **Step 2: Run build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add components/PlayerName.tsx
git commit -m "feat: PlayerName component with commander card tooltip"
```

---

## Task 9: Update `LeaderboardTable` + `MatchCard`

**Files:**
- Modify: `components/LeaderboardTable.tsx`
- Modify: `components/MatchCard.tsx`

- [ ] **Step 1: Update `LeaderboardTable.tsx`**

At the top, add import:
```ts
import PlayerName from './PlayerName'
```

Replace the `Props` interface:
```tsx
interface Props {
  players: (PlayerStats & { moxfield_url?: string | null; commander_image_url?: string | null })[]
  totalPlayers: number
}
```

Replace the Name + Moxfield block (the `<div className="flex-1 min-w-0">` section, lines 68-84):

```tsx
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <PlayerName
                    name={player.name}
                    commanderImageUrl={player.commander_image_url}
                    className="font-fantasy font-semibold text-dc-text truncate"
                  />
                  {player.moxfield_url && (
                    <a
                      href={player.moxfield_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-dc-muted hover:text-dc-gold transition-colors shrink-0"
                      title="Voir le deck sur Moxfield"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <div className="text-dc-muted text-xs mt-0.5">
                  {player.played}/{totalPlayers - 1} matchs joués
                </div>
              </div>
```

- [ ] **Step 2: Update `MatchCard.tsx`**

Add import at the top:
```ts
import PlayerName from './PlayerName'
```

Replace the player1 name div (inside `flex-1 text-right`):
```tsx
          <PlayerName
            name={match.player1.name}
            commanderImageUrl={match.player1.commander_image_url}
            className={`font-fantasy font-semibold text-sm md:text-base ${p1Won ? 'text-dc-gold' : 'text-dc-text'}`}
          />
```

Replace the player2 name div (inside the second `flex-1`):
```tsx
          <PlayerName
            name={match.player2.name}
            commanderImageUrl={match.player2.commander_image_url}
            className={`font-fantasy font-semibold text-sm md:text-base ${p2Won ? 'text-dc-gold' : 'text-dc-text'}`}
          />
```

- [ ] **Step 3: Run build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add components/LeaderboardTable.tsx components/MatchCard.tsx
git commit -m "feat: add commander card tooltip to leaderboard and match cards"
```

---

## Task 10: Update home page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx`**

```tsx
import { computeLeaderboard } from '@/lib/leaderboard'
import { listPlayers, listCompletedMatches, countMatches } from '@/lib/db'
import { getActiveLeague, listLeaguePlayers } from '@/lib/db-leagues'
import LeaderboardTable from '@/components/LeaderboardTable'
import { Sword, Trophy } from 'lucide-react'

export const revalidate = 0

export default async function HomePage() {
  const { data: league } = getActiveLeague()
  const { data: players } = listPlayers()
  const { data: completedMatches } = league ? listCompletedMatches(league.id) : { data: [] }
  const { data: totalMatchCount } = league ? countMatches(league.id) : { data: 0 }
  const { data: leaguePlayers } = league ? listLeaguePlayers(league.id) : { data: [] }

  const leaderboard = computeLeaderboard(players ?? [], completedMatches ?? [])
  const deckMap = new Map((leaguePlayers ?? []).map((lp) => [lp.player_id, lp]))
  const leaderboardWithDecks = leaderboard.map((p) => ({
    ...p,
    moxfield_url: deckMap.get(p.id)?.moxfield_url ?? null,
    commander_image_url: deckMap.get(p.id)?.commander_image_url ?? null,
  }))

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3">
          <div className="gold-divider w-16" />
          <Trophy className="w-6 h-6 text-dc-gold" />
          <div className="gold-divider w-16" />
        </div>
        <h1 className="font-fantasy text-3xl md:text-4xl font-bold text-dc-gold">
          Commander League
        </h1>
        <p className="text-dc-muted text-sm">
          {league ? `${league.name} · ` : ''}Duel Commander · Round Robin · Top 4
        </p>

        {(totalMatchCount ?? 0) > 0 && (
          <div className="inline-flex items-center gap-2 bg-dc-surface border border-dc-border rounded-full px-4 py-1.5 text-sm">
            <Sword className="w-3.5 h-3.5 text-dc-gold" />
            <span className="text-dc-muted">
              <span className="text-dc-text font-semibold">{completedMatches?.length ?? 0}</span>
              {' '}/ {totalMatchCount} matchs joués
            </span>
          </div>
        )}
      </div>

      {!league ? (
        <div className="text-center py-16 text-dc-muted">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Aucune saison active pour le moment.</p>
        </div>
      ) : (
        <LeaderboardTable
          players={leaderboardWithDecks}
          totalPlayers={players?.length ?? 0}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run build + commit**

```bash
npm run build
git add app/page.tsx
git commit -m "feat: home page shows active league name and deck tooltips"
```

---

## Task 11: Admin page + AdminDashboard

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `app/admin/AdminDashboard.tsx`

### `app/admin/page.tsx`

- [ ] **Step 1: Replace `app/admin/page.tsx`**

```tsx
import { listPlayers, listMatches, listPlayoffs, countMatches, countCompletedMatches } from '@/lib/db'
import { Player, Match } from '@/lib/leaderboard'
import { getActiveLeague, listLeaguePlayers } from '@/lib/db-leagues'
import AdminDashboard from './AdminDashboard'

export const revalidate = 0

export default async function AdminPage() {
  const { data: activeLeague } = getActiveLeague()
  const { data: players } = listPlayers()
  const { data: matches } = activeLeague ? listMatches(activeLeague.id, true) : { data: [] }
  const { data: playoffs } = activeLeague ? listPlayoffs(activeLeague.id) : { data: [] }
  const { data: total } = activeLeague ? countMatches(activeLeague.id) : { data: 0 }
  const { data: completed } = activeLeague ? countCompletedMatches(activeLeague.id) : { data: 0 }
  const { data: leaguePlayers } = activeLeague ? listLeaguePlayers(activeLeague.id) : { data: [] }
  const allRRCompleted = (total ?? 0) > 0 && total === completed

  return (
    <AdminDashboard
      initialPlayers={(players ?? []) as unknown as Player[]}
      initialMatches={(matches ?? []) as unknown as Match[]}
      initialPlayoffs={playoffs ?? []}
      allRRCompleted={allRRCompleted}
      activeLeague={activeLeague ?? null}
      leaguePlayers={leaguePlayers ?? []}
    />
  )
}
```

### `app/admin/AdminDashboard.tsx`

- [ ] **Step 2: Update imports in `AdminDashboard.tsx`**

Add to the existing import block:
```ts
import type { DbLeague } from '@/lib/db'
import type { DbLeaguePlayerWithName } from '@/lib/db-leagues'
import { Archive } from 'lucide-react'
```

- [ ] **Step 3: Update `Props` interface** (replace lines 22-27)

```ts
interface Props {
  initialPlayers: Player[]
  initialMatches: Match[]
  initialPlayoffs: DbPlayoff[]
  allRRCompleted: boolean
  activeLeague: DbLeague | null
  leaguePlayers: DbLeaguePlayerWithName[]
}
```

- [ ] **Step 4: Update component signature** (line 29)

```ts
export default function AdminDashboard({
  initialPlayers, initialMatches, initialPlayoffs, allRRCompleted,
  activeLeague, leaguePlayers: initialLeaguePlayers,
}: Props) {
```

- [ ] **Step 5: Add new state variables** after the existing state declarations (after `const [toast, setToast] = useState('')`)

```ts
  const [newCommanderImage, setNewCommanderImage] = useState('')
  const [league, setLeague] = useState<DbLeague | null>(activeLeague)
  const [leaguePlayers, setLeaguePlayers] = useState(initialLeaguePlayers)
  const [newLeagueName, setNewLeagueName] = useState('')
  const [createLeagueLoading, setCreateLeagueLoading] = useState(false)
  const [closeLoading, setCloseLoading] = useState(false)
```

- [ ] **Step 6: Add `handleCreateLeague` + `handleCloseLeague`** after `handleLogout`

```ts
  async function handleCreateLeague(e: React.FormEvent) {
    e.preventDefault()
    if (!newLeagueName.trim()) return
    setCreateLeagueLoading(true)
    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLeagueName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(`Erreur : ${data.error}`)
      } else {
        setLeague(data)
        setNewLeagueName('')
        showToast(`Saison "${data.name}" créée !`)
        router.refresh()
      }
    } finally {
      setCreateLeagueLoading(false)
    }
  }

  async function handleCloseLeague() {
    if (!league) return
    if (!confirm(`Clôturer la saison "${league.name}" ? Elle passera en archive.`)) return
    setCloseLoading(true)
    try {
      const res = await fetch(`/api/leagues/${league.id}/close`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        showToast(`Erreur : ${data.error}`)
      } else {
        setLeague(null)
        setMatches([])
        setPlayoffs([])
        setPlayers([])
        showToast(`Saison "${data.name}" archivée !`)
        router.refresh()
      }
    } finally {
      setCloseLoading(false)
    }
  }
```

- [ ] **Step 7: Update `handleAddPlayer` fetch body** to include `commander_image_url`

In the `fetch('/api/players', ...)` call, change the body to:
```ts
        body: JSON.stringify({
          name: newName.trim(),
          moxfield_url: newMoxfield.trim() || null,
          commander_image_url: newCommanderImage.trim() || null,
        }),
```

After `setNewMoxfield('')`, also add `setNewCommanderImage('')`.

- [ ] **Step 8: Add league name to header stats line** (replace the `<p className="text-dc-muted text-xs">` line ~285)

```tsx
            <p className="text-dc-muted text-xs">
              {league ? `${league.name} · ` : ''}{players.length} joueurs · {completedCount}/{matches.length} matchs joués
            </p>
```

- [ ] **Step 9: Add "Clôturer la saison" button in the header button group**, before the logout button

```tsx
          {league && allRRCompleted && playoffs.length > 0 && playoffs.every((p) => p.is_completed) && (
            <button
              onClick={handleCloseLeague}
              disabled={closeLoading}
              className="flex items-center gap-1.5 text-dc-muted hover:text-dc-gold text-xs px-3 py-2 border border-dc-border/50 rounded-lg transition-all hover:border-dc-gold/30 disabled:opacity-40"
            >
              <Archive className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Clôturer la saison</span>
            </button>
          )}
```

- [ ] **Step 10: Add "Nouvelle saison" section before Section 1** (before `{/* Section 1: Add player */}`)

```tsx
      {/* No active league — create one */}
      {!league && (
        <div className="bg-dc-surface border border-dc-gold/20 rounded-2xl p-5 space-y-4">
          <h2 className="font-fantasy font-bold text-dc-gold flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Nouvelle saison
          </h2>
          <p className="text-dc-muted text-sm">Aucune saison active. Créez-en une pour commencer.</p>
          <form onSubmit={handleCreateLeague} className="flex gap-3">
            <input
              type="text"
              value={newLeagueName}
              onChange={(e) => setNewLeagueName(e.target.value)}
              placeholder="ex: Saison 1"
              className="flex-1 bg-dc-bg border border-dc-border rounded-xl px-4 py-2.5 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 transition-colors text-sm"
            />
            <button
              type="submit"
              disabled={!newLeagueName.trim() || createLeagueLoading}
              className="flex items-center gap-2 bg-dc-gold/20 hover:bg-dc-gold/30 border border-dc-gold/40 text-dc-gold px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            >
              {createLeagueLoading ? 'Création…' : 'Créer'}
            </button>
          </form>
        </div>
      )}
```

- [ ] **Step 11: Guard Section 1 and Section 2 with `league &&`**

Change `{!leagueStarted && (` to `{league && !leagueStarted && (` for both sections.

- [ ] **Step 12: Add `commander_image_url` input field to the player form**

Change the form grid from `sm:grid-cols-2` to `sm:grid-cols-3` and add a third input after the Moxfield URL input:

```tsx
              <div>
                <label className="block text-dc-muted text-xs mb-1">Image du commandant</label>
                <input
                  type="url"
                  value={newCommanderImage}
                  onChange={(e) => setNewCommanderImage(e.target.value)}
                  placeholder="https://assets.moxfield.net/cards/..."
                  className="w-full bg-dc-bg border border-dc-border rounded-xl px-4 py-2.5 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 transition-colors text-sm"
                />
              </div>
```

- [ ] **Step 13: Run build**

```bash
npm run build
```

Fix any TypeScript errors (e.g., `DbLeague` import path — use `lib/db-leagues` not `lib/db`).

- [ ] **Step 14: Commit**

```bash
git add app/admin/page.tsx app/admin/AdminDashboard.tsx
git commit -m "feat: admin UI supports league creation, closure, and commander image field"
```

---

## Task 12: History pages

**Files:**
- Create: `app/history/page.tsx`
- Create: `app/history/[id]/page.tsx`

- [ ] **Step 1: Create `app/history/page.tsx`**

```tsx
import Link from 'next/link'
import { listArchivedLeagues } from '@/lib/db-leagues'
import { Clock, Trophy } from 'lucide-react'

export const revalidate = 0

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default async function HistoryPage() {
  const { data: leagues } = listArchivedLeagues()

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3">
          <div className="gold-divider w-16" />
          <Clock className="w-6 h-6 text-dc-gold" />
          <div className="gold-divider w-16" />
        </div>
        <h1 className="font-fantasy text-3xl font-bold text-dc-gold">Historique</h1>
        <p className="text-dc-muted text-sm">Saisons archivées</p>
      </div>

      {(!leagues || leagues.length === 0) ? (
        <div className="text-center py-16 text-dc-muted">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Aucune saison archivée pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leagues.map((league) => (
            <Link
              key={league.id}
              href={`/history/${league.id}`}
              className="flex items-center justify-between bg-dc-surface border border-dc-border rounded-xl p-4 hover:border-dc-gold/40 transition-all group"
            >
              <div>
                <p className="font-fantasy font-semibold text-dc-text group-hover:text-dc-gold transition-colors">
                  {league.name}
                </p>
                <p className="text-dc-muted text-xs mt-0.5">
                  {formatDate(league.started_at)}
                  {league.ended_at && ` → ${formatDate(league.ended_at)}`}
                </p>
              </div>
              <Trophy className="w-4 h-4 text-dc-muted group-hover:text-dc-gold transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/history/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { getLeagueDetail } from '@/lib/db-leagues'
import { listPlayers } from '@/lib/db'
import { computeLeaderboard } from '@/lib/leaderboard'
import LeaderboardTable from '@/components/LeaderboardTable'
import MatchCard from '@/components/MatchCard'
import { Clock, Trophy, Award } from 'lucide-react'
import type { Player, Match } from '@/lib/leaderboard'

export const revalidate = 0

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

const stageLabels: Record<string, string> = {
  semi1: 'Demi-finale 1 · 1er vs 4ème',
  semi2: 'Demi-finale 2 · 2ème vs 3ème',
  final: 'Grande Finale',
  third_place: 'Petite Finale · 3ème place',
}

export default async function HistoryDetailPage({ params }: { params: { id: string } }) {
  const { data: detail } = getLeagueDetail(params.id)
  if (!detail) notFound()

  const { league, leaguePlayers, matches, playoffs } = detail
  const { data: allPlayers } = listPlayers()

  const participantIds = new Set(leaguePlayers.map((lp) => lp.player_id))
  const participants = (allPlayers ?? []).filter((p) => participantIds.has(p.id))

  const deckMap = new Map(leaguePlayers.map((lp) => [lp.player_id, lp]))
  const leaderboard = computeLeaderboard(participants as Player[], matches as Match[])
  const leaderboardWithDecks = leaderboard.map((p) => ({
    ...p,
    moxfield_url: deckMap.get(p.id)?.moxfield_url ?? null,
    commander_image_url: deckMap.get(p.id)?.commander_image_url ?? null,
  }))

  const playerMap: Record<string, Player> = {}
  for (const p of participants) {
    playerMap[p.id] = {
      ...(p as Player),
      moxfield_url: deckMap.get(p.id)?.moxfield_url ?? null,
      commander_image_url: deckMap.get(p.id)?.commander_image_url ?? null,
    }
  }

  const rounds: Record<number, typeof matches> = {}
  for (const m of matches) {
    if (!rounds[m.round_number]) rounds[m.round_number] = []
    rounds[m.round_number].push(m)
  }

  return (
    <div className="space-y-10">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <div className="gold-divider w-16" />
          <Trophy className="w-6 h-6 text-dc-gold" />
          <div className="gold-divider w-16" />
        </div>
        <h1 className="font-fantasy text-3xl font-bold text-dc-gold">{league.name}</h1>
        <p className="text-dc-muted text-sm flex items-center justify-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {formatDate(league.started_at)}
          {league.ended_at && ` → ${formatDate(league.ended_at)}`}
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-fantasy font-bold text-dc-text text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-dc-gold" /> Classement final
        </h2>
        <LeaderboardTable players={leaderboardWithDecks} totalPlayers={participants.length} />
      </section>

      {playoffs.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-fantasy font-bold text-dc-gold text-lg flex items-center gap-2">
            <Award className="w-5 h-5" /> Playoffs
          </h2>
          <div className="space-y-3">
            {playoffs.map((po) => {
              const p1 = po.player1_id ? playerMap[po.player1_id] : null
              const p2 = po.player2_id ? playerMap[po.player2_id] : null
              if (!p1 || !p2) return null
              return (
                <div key={po.id}>
                  <MatchCard
                    match={{
                      id: po.id,
                      player1_id: po.player1_id!,
                      player2_id: po.player2_id!,
                      score_p1: po.score_p1,
                      score_p2: po.score_p2,
                      is_completed: po.is_completed,
                      round_number: 0,
                      player1: p1,
                      player2: p2,
                    }}
                  />
                  <p className={`text-xs mt-1 ml-1 ${po.stage === 'final' ? 'text-dc-gold/70' : 'text-dc-muted'}`}>
                    {stageLabels[po.stage]}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="space-y-6">
        <h2 className="font-fantasy font-bold text-dc-text text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-dc-gold" /> Matchs Round Robin
        </h2>
        {Object.entries(rounds)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([round, roundMatches]) => (
            <div key={round}>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-xs font-bold px-3 py-1 rounded-full border bg-dc-surface border-dc-border text-dc-muted">
                  Round {round}
                </div>
                <div className="flex-1 h-px bg-dc-border/50" />
              </div>
              <div className="space-y-2">
                {roundMatches.map((match) => {
                  const p1 = playerMap[match.player1_id]
                  const p2 = playerMap[match.player2_id]
                  if (!p1 || !p2) return null
                  return (
                    <MatchCard
                      key={match.id}
                      match={{ ...match, player1: p1, player2: p2 } as Match & { player1: Player; player2: Player }}
                    />
                  )
                })}
              </div>
            </div>
          ))}
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Run build + commit**

```bash
npm run build
git add app/history/
git commit -m "feat: add history pages (list + season detail with full results)"
```

---

## Task 13: Navbar

**Files:**
- Modify: `components/Navbar.tsx`

- [ ] **Step 1: Add Clock import and Historique link**

```ts
import { Sword, Calendar, BookOpen, Shield, Trophy, Clock } from 'lucide-react'

const navLinks = [
  { href: '/', label: 'Classement', icon: Sword },
  { href: '/calendar', label: 'Calendrier', icon: Calendar },
  { href: '/playoffs', label: 'Playoffs', icon: Trophy },
  { href: '/history', label: 'Historique', icon: Clock },
  { href: '/rules', label: 'Règles', icon: BookOpen },
  { href: '/admin', label: 'Admin', icon: Shield },
]
```

- [ ] **Step 2: Run build + commit**

```bash
npm run build
git add components/Navbar.tsx
git commit -m "feat: add Historique link to navbar"
```

---

## Task 14: Integration test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Smoke test — no active league**

- Navigate to `/` → shows "Aucune saison active"
- Navigate to `/admin` → shows "Nouvelle saison" form

- [ ] **Step 3: Create a league and add players**

- In `/admin`, create "Saison Test"
- Add 2+ players with a `commander_image_url` (use `https://assets.moxfield.net/cards/card-kpvQd-normal.webp?299799499`)

- [ ] **Step 4: Test commander tooltip**

- Go to `/` → hover a player name → commander card appears above
- On mobile-size viewport → tap player name → card shows/hides

- [ ] **Step 5: Full league flow**

- Generate matches → set scores → generate playoffs → set all playoff scores
- Verify "Clôturer la saison" button appears in admin header

- [ ] **Step 6: Close season and verify history**

- Click "Clôturer la saison"
- Go to `/history` → season listed
- Click the season → full results with commander tooltips

- [ ] **Step 7: Production build**

```bash
npm run build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: complete league history system with commander card tooltips"
```
