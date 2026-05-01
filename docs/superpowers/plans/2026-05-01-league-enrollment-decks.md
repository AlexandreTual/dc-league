# League Enrollment & Deck System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the global player model with per-league enrollment and introduce a reusable `decks` entity so each player can track which deck they played in each league, enabling future per-deck statistics.

**Architecture:** Add a `decks` table owned by a player; add `deck_id` FK to `league_players`; introduce a "Participants" admin section where existing players are checked in/out per league and each enrolled player selects or creates a deck. Old `moxfield_url`/`commander_image_url` columns stay in `league_players` for backward-compat display of old leagues.

**Tech Stack:** Next.js 14 App Router, better-sqlite3 (SQLite), TypeScript, Tailwind CSS, Lucide icons.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `lib/db.ts` | Migration: add `decks` table + `deck_id` col; block `deletePlayer` if history exists |
| Create | `lib/db-decks.ts` | `DbDeck` type + `insertDeck`, `listPlayerDecks` functions |
| Modify | `lib/db-leagues.ts` | Add `deck_id` to types; join decks in `listLeaguePlayers`; simplify `upsertLeaguePlayer` |
| Create | `app/api/players/[id]/decks/route.ts` | GET + POST decks for a player |
| Create | `app/api/leagues/[id]/players/route.ts` | POST: enroll existing player |
| Create | `app/api/leagues/[id]/players/[playerId]/route.ts` | DELETE: unenroll; PATCH: assign deck |
| Modify | `app/api/players/route.ts` | POST: remove moxfield/image, just create+enroll; DELETE: block if has league history |
| Modify | `app/api/matches/generate/route.ts` | Use enrolled players (league_players) not all players |
| Modify | `app/admin/page.tsx` | Load and pass all decks to dashboard |
| Modify | `app/admin/AdminDashboard.tsx` | Replace "Ajouter un joueur" with "Participants" section |
| Modify | `app/history/[id]/page.tsx` | Resolve moxfield/image from deck with old-data fallback |

---

## Task 1: DB migration — `decks` table + `deck_id` column

**Files:**
- Modify: `lib/db.ts`

- [ ] **Step 1: Add `decks` table to the main `db.exec` block and add the `deck_id` migration**

In `lib/db.ts`, the `db.exec(...)` call (lines 58–104) creates all tables. Add the `decks` table inside that same block, and add the `deck_id` migration after the existing `ALTER TABLE` migrations.

Replace the entire `db.exec` block and the migrations below it (lines 58–131) with:

```typescript
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      moxfield_url TEXT,
      avatar_url   TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leagues (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      started_at  TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at    TEXT,
      is_active   INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS decks (
      id                  TEXT PRIMARY KEY,
      player_id           TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      name                TEXT NOT NULL,
      commander_image_url TEXT,
      moxfield_url        TEXT,
      created_at          TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS league_players (
      league_id           TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      player_id           TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      moxfield_url        TEXT,
      commander_image_url TEXT,
      PRIMARY KEY (league_id, player_id)
    );

    CREATE TABLE IF NOT EXISTS matches (
      id           TEXT PRIMARY KEY,
      player1_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      player2_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      score_p1     INTEGER,
      score_p2     INTEGER,
      is_completed INTEGER DEFAULT 0,
      round_number INTEGER DEFAULT 1,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playoffs (
      id           TEXT PRIMARY KEY,
      stage        TEXT NOT NULL,
      player1_id   TEXT REFERENCES players(id) ON DELETE SET NULL,
      player2_id   TEXT REFERENCES players(id) ON DELETE SET NULL,
      score_p1     INTEGER,
      score_p2     INTEGER,
      is_completed INTEGER DEFAULT 0,
      created_at   TEXT DEFAULT (datetime('now'))
    );
  `)

  // Idempotent column migrations
  try { db.prepare('ALTER TABLE matches ADD COLUMN league_id TEXT REFERENCES leagues(id)').run() } catch {}
  try { db.prepare('ALTER TABLE playoffs ADD COLUMN league_id TEXT REFERENCES leagues(id)').run() } catch {}
  try { db.prepare('ALTER TABLE league_players ADD COLUMN deck_id TEXT REFERENCES decks(id)').run() } catch {}

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

- [ ] **Step 2: Start the dev server and verify no startup errors**

```bash
cd /Users/tualalexandre/Public/Dev/perso/dc-app && npm run dev
```

Expected: Server starts, no SQLite errors in the console.

- [ ] **Step 3: Commit**

```bash
git add lib/db.ts
git commit -m "feat: add decks table and deck_id column to league_players"
```

---

## Task 2: Create `lib/db-decks.ts` — deck CRUD

**Files:**
- Create: `lib/db-decks.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/db-decks.ts
import { getDb } from './db'
import crypto from 'crypto'

export type DbDeck = {
  id: string
  player_id: string
  name: string
  commander_image_url: string | null
  moxfield_url: string | null
  created_at: string
}

type Ok<T> = { data: T; error: null }
type Err = { data: null; error: string }
type Result<T> = Ok<T> | Err
function ok<T>(data: T): Ok<T> { return { data, error: null } }
function err(msg: string): Err { return { data: null, error: msg } }
function uuid() { return crypto.randomUUID() }

function normalizeDeck(row: Record<string, unknown>): DbDeck {
  return {
    id: row.id as string,
    player_id: row.player_id as string,
    name: row.name as string,
    commander_image_url: (row.commander_image_url as string) ?? null,
    moxfield_url: (row.moxfield_url as string) ?? null,
    created_at: row.created_at as string,
  }
}

export function listPlayerDecks(playerId: string): Result<DbDeck[]> {
  try {
    const rows = getDb()
      .prepare('SELECT * FROM decks WHERE player_id = ? ORDER BY created_at ASC')
      .all(playerId) as Record<string, unknown>[]
    return ok(rows.map(normalizeDeck))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function listAllDecksGrouped(): Result<Record<string, DbDeck[]>> {
  try {
    const rows = getDb()
      .prepare('SELECT * FROM decks ORDER BY player_id, created_at ASC')
      .all() as Record<string, unknown>[]
    const grouped: Record<string, DbDeck[]> = {}
    for (const row of rows) {
      const deck = normalizeDeck(row)
      if (!grouped[deck.player_id]) grouped[deck.player_id] = []
      grouped[deck.player_id].push(deck)
    }
    return ok(grouped)
  } catch (e) {
    return err((e as Error).message)
  }
}

export function insertDeck(
  playerId: string,
  data: { name: string; commander_image_url?: string | null; moxfield_url?: string | null }
): Result<DbDeck> {
  try {
    const id = uuid()
    getDb()
      .prepare('INSERT INTO decks (id, player_id, name, commander_image_url, moxfield_url) VALUES (?, ?, ?, ?, ?)')
      .run(id, playerId, data.name.trim(), data.commander_image_url ?? null, data.moxfield_url ?? null)
    const row = getDb()
      .prepare('SELECT * FROM decks WHERE id = ?')
      .get(id) as Record<string, unknown>
    return ok(normalizeDeck(row))
  } catch (e) {
    return err((e as Error).message)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/db-decks.ts
git commit -m "feat: add db-decks.ts with deck CRUD functions"
```

---

## Task 3: Block `deletePlayer` if player has league history

**Files:**
- Modify: `lib/db.ts`

- [ ] **Step 1: Update `deletePlayer` function**

Find `deletePlayer` in `lib/db.ts` (lines 212–219) and replace it with:

```typescript
export function deletePlayer(id: string): Result<true> {
  try {
    const db = getDb()
    const inLeague = db
      .prepare('SELECT COUNT(*) as n FROM league_players WHERE player_id = ?')
      .get(id) as { n: number }
    if (inLeague.n > 0) {
      return err('Ce joueur a participé à une league et ne peut pas être supprimé.')
    }
    db.prepare('DELETE FROM players WHERE id = ?').run(id)
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/db.ts
git commit -m "feat: block player deletion if player has league history"
```

---

## Task 4: Update `lib/db-leagues.ts` for deck support

**Files:**
- Modify: `lib/db-leagues.ts`

- [ ] **Step 1: Update types at the top of the file**

Replace the `DbLeaguePlayer` and `DbLeaguePlayerWithName` type definitions (lines 15–25) with:

```typescript
export type DbLeaguePlayer = {
  league_id: string
  player_id: string
  deck_id: string | null
  moxfield_url: string | null
  commander_image_url: string | null
}

export type DbLeaguePlayerWithName = DbLeaguePlayer & {
  name: string
  avatar_url: string | null
  deck_name: string | null
  deck_moxfield_url: string | null
  deck_commander_image_url: string | null
}
```

- [ ] **Step 2: Update normalizers**

Replace `normalizeLeaguePlayer` and `normalizeLeaguePlayerWithName` (lines 46–61) with:

```typescript
function normalizeLeaguePlayer(row: Record<string, unknown>): DbLeaguePlayer {
  return {
    league_id: row.league_id as string,
    player_id: row.player_id as string,
    deck_id: (row.deck_id as string) ?? null,
    moxfield_url: (row.moxfield_url as string) ?? null,
    commander_image_url: (row.commander_image_url as string) ?? null,
  }
}

function normalizeLeaguePlayerWithName(row: Record<string, unknown>): DbLeaguePlayerWithName {
  return {
    ...normalizeLeaguePlayer(row),
    name: row.name as string,
    avatar_url: (row.avatar_url as string) ?? null,
    deck_name: (row.deck_name as string) ?? null,
    deck_moxfield_url: (row.deck_moxfield_url as string) ?? null,
    deck_commander_image_url: (row.deck_commander_image_url as string) ?? null,
  }
}
```

- [ ] **Step 3: Update `listLeaguePlayers` query to LEFT JOIN decks**

Replace `listLeaguePlayers` (lines 131–146) with:

```typescript
export function listLeaguePlayers(leagueId: string): Result<DbLeaguePlayerWithName[]> {
  try {
    const rows = getDb()
      .prepare(`
        SELECT lp.*, p.name, p.avatar_url,
               d.name AS deck_name,
               d.moxfield_url AS deck_moxfield_url,
               d.commander_image_url AS deck_commander_image_url
        FROM league_players lp
        JOIN players p ON p.id = lp.player_id
        LEFT JOIN decks d ON d.id = lp.deck_id
        WHERE lp.league_id = ?
        ORDER BY p.name ASC
      `)
      .all(leagueId) as Record<string, unknown>[]
    return ok(rows.map(normalizeLeaguePlayerWithName))
  } catch (e) {
    return err((e as Error).message)
  }
}
```

- [ ] **Step 4: Update `upsertLeaguePlayer` to use `deck_id` instead of moxfield/image**

Replace `upsertLeaguePlayer` (lines 148–170) with:

```typescript
export function upsertLeaguePlayer(
  leagueId: string,
  playerId: string,
  data: { deck_id?: string | null }
): Result<DbLeaguePlayer> {
  try {
    const db = getDb()
    db.prepare(`
      INSERT INTO league_players (league_id, player_id, deck_id)
      VALUES (?, ?, ?)
      ON CONFLICT(league_id, player_id) DO UPDATE SET
        deck_id = excluded.deck_id
    `).run(leagueId, playerId, data.deck_id ?? null)

    const row = db
      .prepare('SELECT * FROM league_players WHERE league_id = ? AND player_id = ?')
      .get(leagueId, playerId) as Record<string, unknown>
    return ok(normalizeLeaguePlayer(row))
  } catch (e) {
    return err((e as Error).message)
  }
}
```

- [ ] **Step 5: Add `enrollLeaguePlayer` function (insert only, no upsert)**

Add after `upsertLeaguePlayer`:

```typescript
export function enrollLeaguePlayer(leagueId: string, playerId: string): Result<DbLeaguePlayer> {
  try {
    const db = getDb()
    db.prepare(
      'INSERT OR IGNORE INTO league_players (league_id, player_id) VALUES (?, ?)'
    ).run(leagueId, playerId)
    const row = db
      .prepare('SELECT * FROM league_players WHERE league_id = ? AND player_id = ?')
      .get(leagueId, playerId) as Record<string, unknown>
    return ok(normalizeLeaguePlayer(row))
  } catch (e) {
    return err((e as Error).message)
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/db-leagues.ts
git commit -m "feat: update db-leagues for deck support (deck_id, join, normalizers)"
```

---

## Task 5: API — deck endpoints

**Files:**
- Create: `app/api/players/[id]/decks/route.ts`

- [ ] **Step 1: Create directory and route file**

```typescript
// app/api/players/[id]/decks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import { listPlayerDecks, insertDeck } from '@/lib/db-decks'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data, error } = listPlayerDecks(params.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { name, commander_image_url, moxfield_url } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Le nom du deck est requis' }, { status: 400 })
  }

  const { data, error } = insertDeck(params.id, {
    name: name.trim(),
    commander_image_url: commander_image_url?.trim() || null,
    moxfield_url: moxfield_url?.trim() || null,
  })
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/players/[id]/decks/route.ts"
git commit -m "feat: add deck API endpoints (GET/POST /api/players/[id]/decks)"
```

---

## Task 6: API — league enrollment endpoints

**Files:**
- Create: `app/api/leagues/[id]/players/route.ts`
- Create: `app/api/leagues/[id]/players/[playerId]/route.ts`

- [ ] **Step 1: Create `app/api/leagues/[id]/players/route.ts`**

```typescript
// app/api/leagues/[id]/players/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import { enrollLeaguePlayer } from '@/lib/db-leagues'
import { countMatches } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data: matchCount, error: countErr } = countMatches(params.id)
  if (countErr) return NextResponse.json({ error: countErr }, { status: 500 })
  if (matchCount && matchCount > 0) {
    return NextResponse.json(
      { error: 'Les matchs ont déjà été générés. Impossible de modifier les participants.' },
      { status: 400 }
    )
  }

  const { player_id } = await req.json()
  if (!player_id) return NextResponse.json({ error: 'player_id requis' }, { status: 400 })

  const { data, error } = enrollLeaguePlayer(params.id, player_id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/leagues/[id]/players/[playerId]/route.ts`**

```typescript
// app/api/leagues/[id]/players/[playerId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import { upsertLeaguePlayer, removeLeaguePlayer } from '@/lib/db-leagues'
import { countMatches } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; playerId: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { deck_id } = await req.json()
  const { data, error } = upsertLeaguePlayer(params.id, params.playerId, { deck_id: deck_id ?? null })
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; playerId: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data: matchCount, error: countErr } = countMatches(params.id)
  if (countErr) return NextResponse.json({ error: countErr }, { status: 500 })
  if (matchCount && matchCount > 0) {
    return NextResponse.json(
      { error: 'Les matchs ont déjà été générés. Impossible de désinscrire un joueur.' },
      { status: 400 }
    )
  }

  const { error } = removeLeaguePlayer(params.id, params.playerId)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/api/leagues/[id]/players/route.ts" "app/api/leagues/[id]/players/[playerId]/route.ts"
git commit -m "feat: add league enrollment API endpoints"
```

---

## Task 7: Update player API — simplify POST, fix DELETE

**Files:**
- Modify: `app/api/players/route.ts`

- [ ] **Step 1: Rewrite the file**

```typescript
// app/api/players/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import { listPlayers, insertPlayer, deletePlayer, countMatches } from '@/lib/db'
import { getActiveLeague, enrollLeaguePlayer } from '@/lib/db-leagues'

export async function GET() {
  const { data, error } = listPlayers()
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { name } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
  }

  const { data: player, error: playerErr } = insertPlayer({ name: name.trim() })
  if (playerErr) return NextResponse.json({ error: playerErr }, { status: 500 })

  const { data: league } = getActiveLeague()
  if (league) {
    const { data: count } = countMatches(league.id)
    if (!count || count === 0) {
      enrollLeaguePlayer(league.id, player!.id)
    }
  }

  return NextResponse.json(player!, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  const { error } = deletePlayer(id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

Note: `deletePlayer` now internally blocks if the player has league history — the API surfaces that error automatically.

- [ ] **Step 2: Commit**

```bash
git add app/api/players/route.ts
git commit -m "feat: simplify player POST (no moxfield), fix DELETE to surface history block"
```

---

## Task 8: Update match generation to use enrolled players

**Files:**
- Modify: `app/api/matches/generate/route.ts`

- [ ] **Step 1: Replace `listPlayers` with `listLeaguePlayers`**

```typescript
// app/api/matches/generate/route.ts
import { NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import { generateRoundRobinMatches } from '@/lib/leaderboard'
import { countMatches, insertMatches, deleteAllMatches, deleteAllPlayoffs } from '@/lib/db'
import { getActiveLeague, listLeaguePlayers } from '@/lib/db-leagues'

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

  const { data: enrolled, error: enrolledErr } = listLeaguePlayers(league.id)
  if (enrolledErr) return NextResponse.json({ error: enrolledErr }, { status: 500 })
  if (!enrolled || enrolled.length < 2) {
    return NextResponse.json(
      { error: 'Il faut au moins 2 joueurs inscrits pour générer la ligue.' },
      { status: 400 }
    )
  }

  const matchDefs = generateRoundRobinMatches(enrolled.map((p) => p.player_id))
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
  const { error: pErr } = deleteAllPlayoffs(league.id)
  if (pErr) return NextResponse.json({ error: pErr }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/matches/generate/route.ts
git commit -m "fix: generate matches from enrolled players, not all players"
```

---

## Task 9: Update admin server page to pass decks

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Rewrite `app/admin/page.tsx`**

```typescript
// app/admin/page.tsx
import { listPlayers, listMatches, listPlayoffs, countMatches, countCompletedMatches } from '@/lib/db'
import { Player, Match } from '@/lib/leaderboard'
import { getActiveLeague, listLeaguePlayers } from '@/lib/db-leagues'
import { listAllDecksGrouped } from '@/lib/db-decks'
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
  const { data: decks } = listAllDecksGrouped()
  const allRRCompleted = (total ?? 0) > 0 && total === completed

  return (
    <AdminDashboard
      initialPlayers={(players ?? []) as unknown as Player[]}
      initialMatches={(matches ?? []) as unknown as Match[]}
      initialPlayoffs={playoffs ?? []}
      allRRCompleted={allRRCompleted}
      activeLeague={activeLeague ?? null}
      leaguePlayers={leaguePlayers ?? []}
      initialDecks={decks ?? {}}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: pass initialDecks grouped by player to AdminDashboard"
```

---

## Task 10: Rewrite AdminDashboard "Participants" section

**Files:**
- Modify: `app/admin/AdminDashboard.tsx`

This is the most significant change. The "Ajouter un joueur" section is replaced with a "Participants" section featuring two zones.

- [ ] **Step 1: Update Props interface and add new imports**

Replace the `Props` interface and the import block at the top of `AdminDashboard.tsx`:

```typescript
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Match, Player } from '@/lib/leaderboard'
import { DbPlayoff, DbPlayer } from '@/lib/db'
import type { DbLeague, DbLeaguePlayerWithName } from '@/lib/db-leagues'
import type { DbDeck } from '@/lib/db-decks'
import MatchCard from '@/components/MatchCard'
import ScoreModal from '@/components/ScoreModal'
import {
  Shield,
  UserPlus,
  Users,
  Zap,
  LogOut,
  Trash2,
  ExternalLink,
  AlertTriangle,
  RefreshCcw,
  Trophy,
  Award,
  Archive,
  ChevronDown,
  Plus,
  X,
} from 'lucide-react'

interface Props {
  initialPlayers: Player[]
  initialMatches: Match[]
  initialPlayoffs: DbPlayoff[]
  allRRCompleted: boolean
  activeLeague: DbLeague | null
  leaguePlayers: DbLeaguePlayerWithName[]
  initialDecks: Record<string, DbDeck[]>
}
```

- [ ] **Step 2: Add new state variables**

Inside the `AdminDashboard` component, after the existing state declarations, add:

```typescript
  const [playerDecks, setPlayerDecks] = useState<Record<string, DbDeck[]>>(initialDecks)

  // Inline deck creation state
  const [creatingDeckForPlayerId, setCreatingDeckForPlayerId] = useState<string | null>(null)
  const [newDeckName, setNewDeckName] = useState('')
  const [newDeckImage, setNewDeckImage] = useState('')
  const [newDeckMoxfield, setNewDeckMoxfield] = useState('')
  const [deckLoading, setDeckLoading] = useState(false)

  // New player form (simplified — no moxfield/image)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [addPlayerLoading, setAddPlayerLoading] = useState(false)
  const [addPlayerError, setAddPlayerError] = useState('')
```

Also remove the old state variables that are no longer needed:
- `newName` → replaced by `newPlayerName`
- `newMoxfield` → removed
- `newCommanderImage` → removed
- `addLoading` → replaced by `addPlayerLoading`
- `addError` → replaced by `addPlayerError`

- [ ] **Step 3: Add derived values**

After the existing `leagueStarted` line, add:

```typescript
  const enrolledIds = new Set(leaguePlayers.map((lp) => lp.player_id))
  const enrolledCount = leaguePlayers.length

  // For match display, enrolled players map
  const enrolledPlayerMap: Record<string, Player> = {}
  for (const lp of leaguePlayers) {
    const p = players.find((pl) => pl.id === lp.player_id)
    if (p) enrolledPlayerMap[lp.player_id] = p
  }
```

- [ ] **Step 4: Add enrollment handler functions**

Replace `handleAddPlayer` and `handleDeletePlayer` with these new handlers:

```typescript
  async function handleToggleEnroll(player: Player, isEnrolled: boolean) {
    if (!league) return
    if (isEnrolled) {
      const res = await fetch(`/api/leagues/${league.id}/players/${player.id}`, { method: 'DELETE' })
      if (res.ok) {
        setLeaguePlayers((prev) => prev.filter((lp) => lp.player_id !== player.id))
        showToast(`${player.name} désinscrit`)
      } else {
        const data = await res.json()
        showToast(`Erreur : ${data.error}`)
      }
    } else {
      const res = await fetch(`/api/leagues/${league.id}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: player.id }),
      })
      if (res.ok) {
        const lp = await res.json()
        setLeaguePlayers((prev) => [...prev, { ...lp, name: player.name, avatar_url: player.avatar_url ?? null, deck_name: null, deck_moxfield_url: null, deck_commander_image_url: null }])
        showToast(`${player.name} inscrit`)
      } else {
        const data = await res.json()
        showToast(`Erreur : ${data.error}`)
      }
    }
  }

  async function handleAssignDeck(playerId: string, deckId: string) {
    if (!league) return
    const res = await fetch(`/api/leagues/${league.id}/players/${playerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deck_id: deckId || null }),
    })
    if (res.ok) {
      const deck = playerDecks[playerId]?.find((d) => d.id === deckId)
      setLeaguePlayers((prev) =>
        prev.map((lp) =>
          lp.player_id === playerId
            ? { ...lp, deck_id: deckId || null, deck_name: deck?.name ?? null, deck_moxfield_url: deck?.moxfield_url ?? null, deck_commander_image_url: deck?.commander_image_url ?? null }
            : lp
        )
      )
    } else {
      const data = await res.json()
      showToast(`Erreur : ${data.error}`)
    }
  }

  async function handleCreateDeck(e: React.FormEvent, playerId: string) {
    e.preventDefault()
    if (!newDeckName.trim() || !league) return
    setDeckLoading(true)
    try {
      const res = await fetch(`/api/players/${playerId}/decks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDeckName.trim(),
          commander_image_url: newDeckImage.trim() || null,
          moxfield_url: newDeckMoxfield.trim() || null,
        }),
      })
      const deck = await res.json()
      if (!res.ok) {
        showToast(`Erreur : ${deck.error}`)
        return
      }
      setPlayerDecks((prev) => ({ ...prev, [playerId]: [...(prev[playerId] ?? []), deck] }))
      // Auto-assign the new deck
      await handleAssignDeck(playerId, deck.id)
      setNewDeckName('')
      setNewDeckImage('')
      setNewDeckMoxfield('')
      setCreatingDeckForPlayerId(null)
      showToast(`Deck "${deck.name}" créé !`)
    } finally {
      setDeckLoading(false)
    }
  }

  async function handleAddNewPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!newPlayerName.trim()) return
    setAddPlayerLoading(true)
    setAddPlayerError('')
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlayerName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddPlayerError(data.error)
      } else {
        setPlayers((prev) => [...prev, data])
        if (league) {
          setLeaguePlayers((prev) => [...prev, { league_id: league.id, player_id: data.id, deck_id: null, moxfield_url: null, commander_image_url: null, name: data.name, avatar_url: null, deck_name: null, deck_moxfield_url: null, deck_commander_image_url: null }])
        }
        setNewPlayerName('')
        showToast(`${data.name} ajouté et inscrit !`)
      }
    } finally {
      setAddPlayerLoading(false)
    }
  }

  async function handleDeletePlayer(id: string, name: string) {
    if (!confirm(`Supprimer ${name} ?`)) return
    const res = await fetch('/api/players', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setPlayers((prev) => prev.filter((p) => p.id !== id))
      showToast(`${name} supprimé`)
    } else {
      const data = await res.json()
      showToast(`Erreur : ${data.error}`)
    }
  }
```

- [ ] **Step 5: Replace the "Section 1: Add player" JSX with the new "Participants" section**

Find the comment `{/* Section 1: Add player */}` block (lines 412–510 in the original) and replace it entirely with:

```tsx
      {/* Section: Participants */}
      {league && !leagueStarted && (
        <div className="bg-dc-surface border border-dc-border rounded-2xl p-5 space-y-5">
          <h2 className="font-fantasy font-bold text-dc-text flex items-center gap-2">
            <Users className="w-5 h-5 text-dc-gold" />
            Participants ({enrolledCount})
          </h2>

          {/* Zone A: existing players */}
          {players.length > 0 && (
            <div className="space-y-2">
              <p className="text-dc-muted text-xs uppercase tracking-wide">Joueurs existants</p>
              {players.map((player) => {
                const isEnrolled = enrolledIds.has(player.id)
                const decksForPlayer = playerDecks[player.id] ?? []
                const enrollment = leaguePlayers.find((lp) => lp.player_id === player.id)
                const assignedDeckId = enrollment?.deck_id ?? ''
                const isCreatingDeck = creatingDeckForPlayerId === player.id

                return (
                  <div key={player.id} className="space-y-2">
                    <div className="flex items-center gap-3 bg-dc-bg/50 border border-dc-border/40 rounded-xl px-4 py-2.5">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isEnrolled}
                        onChange={() => handleToggleEnroll(player, isEnrolled)}
                        className="w-4 h-4 accent-dc-gold cursor-pointer"
                      />

                      {/* Avatar + name */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-dc-border/60 flex items-center justify-center shrink-0">
                          <span className="text-dc-gold font-bold text-xs">
                            {player.name.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-dc-text text-sm font-semibold truncate">{player.name}</span>
                      </div>

                      {/* Deck selector (only when enrolled) */}
                      {isEnrolled && (
                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={assignedDeckId}
                            onChange={(e) => {
                              if (e.target.value === '__new__') {
                                setCreatingDeckForPlayerId(player.id)
                                setNewDeckName('')
                                setNewDeckImage('')
                                setNewDeckMoxfield('')
                              } else {
                                handleAssignDeck(player.id, e.target.value)
                              }
                            }}
                            className="bg-dc-bg border border-dc-border rounded-lg px-2 py-1.5 text-dc-text text-xs focus:outline-none focus:border-dc-gold/50 transition-colors max-w-[160px]"
                          >
                            <option value="">Sans deck</option>
                            {decksForPlayer.map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                            <option value="__new__">+ Nouveau deck</option>
                          </select>
                        </div>
                      )}

                      {/* Delete (disabled if enrolled in any league) */}
                      <button
                        onClick={() => handleDeletePlayer(player.id, player.name)}
                        disabled={isEnrolled}
                        title={isEnrolled ? 'Désinscris le joueur avant de le supprimer' : 'Supprimer'}
                        className="text-dc-muted hover:text-dc-red-light transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Inline deck creation form */}
                    {isCreatingDeck && (
                      <form
                        onSubmit={(e) => handleCreateDeck(e, player.id)}
                        className="ml-8 bg-dc-bg/70 border border-dc-gold/20 rounded-xl px-4 py-3 space-y-2"
                      >
                        <p className="text-dc-gold text-xs font-semibold">Nouveau deck pour {player.name}</p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div>
                            <label className="block text-dc-muted text-xs mb-1">Nom du deck *</label>
                            <input
                              type="text"
                              value={newDeckName}
                              onChange={(e) => setNewDeckName(e.target.value)}
                              placeholder="ex: Ur-Dragon"
                              autoFocus
                              className="w-full bg-dc-bg border border-dc-border rounded-lg px-3 py-2 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-dc-muted text-xs mb-1">Image commandant</label>
                            <input
                              type="url"
                              value={newDeckImage}
                              onChange={(e) => setNewDeckImage(e.target.value)}
                              placeholder="https://assets.moxfield.net/..."
                              className="w-full bg-dc-bg border border-dc-border rounded-lg px-3 py-2 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-dc-muted text-xs mb-1">Lien Moxfield</label>
                            <input
                              type="url"
                              value={newDeckMoxfield}
                              onChange={(e) => setNewDeckMoxfield(e.target.value)}
                              placeholder="https://moxfield.com/decks/..."
                              className="w-full bg-dc-bg border border-dc-border rounded-lg px-3 py-2 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={!newDeckName.trim() || deckLoading}
                            className="flex items-center gap-1.5 bg-dc-gold/20 hover:bg-dc-gold/30 border border-dc-gold/40 text-dc-gold px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {deckLoading ? 'Création…' : 'Créer et assigner'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCreatingDeckForPlayerId(null)}
                            className="flex items-center gap-1.5 text-dc-muted hover:text-dc-text px-3 py-1.5 rounded-lg text-xs transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Annuler
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-dc-border/50" />

          {/* Zone B: new player */}
          <div className="space-y-3">
            <p className="text-dc-muted text-xs uppercase tracking-wide">Nouveau joueur</p>
            <form onSubmit={handleAddNewPlayer} className="flex gap-3">
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="ex: Alexandre"
                className="flex-1 bg-dc-bg border border-dc-border rounded-xl px-4 py-2.5 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 transition-colors text-sm"
              />
              <button
                type="submit"
                disabled={!newPlayerName.trim() || addPlayerLoading}
                className="flex items-center gap-2 bg-dc-gold/15 hover:bg-dc-gold/25 border border-dc-gold/30 text-dc-gold px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <UserPlus className="w-4 h-4" />
                {addPlayerLoading ? 'Ajout…' : 'Ajouter'}
              </button>
            </form>
            {addPlayerError && (
              <p className="text-dc-red-light text-sm bg-dc-red/20 border border-dc-red/30 rounded-lg px-3 py-2">
                {addPlayerError}
              </p>
            )}
          </div>
        </div>
      )}
```

- [ ] **Step 6: Update "Générer la ligue" section to use `enrolledCount`**

Find the condition `{league && !leagueStarted && players.length >= 2 && (` and replace with:
`{league && !leagueStarted && enrolledCount >= 2 && (`

Also update the match count text inside (the `players.length` reference) to use `enrolledCount`.

Find:
```tsx
          <p className="text-dc-muted text-sm">
            {players.length} joueurs → {(players.length * (players.length - 1)) / 2} matchs Round Robin.
            {players.length % 2 !== 0 && ' (Nombre impair : 1 bye par round, ignoré au classement)'}
          </p>
```

Replace with:
```tsx
          <p className="text-dc-muted text-sm">
            {enrolledCount} joueurs → {(enrolledCount * (enrolledCount - 1)) / 2} matchs Round Robin.
            {enrolledCount % 2 !== 0 && ' (Nombre impair : 1 bye par round, ignoré au classement)'}
          </p>
```

Find:
```tsx
            {generateLoading ? 'Génération…' : `Générer la ligue (${players.length} joueurs)`}
```

Replace with:
```tsx
            {generateLoading ? 'Génération…' : `Générer la ligue (${enrolledCount} joueurs)`}
```

- [ ] **Step 7: Update header subtitle to use enrolled count**

Find:
```tsx
              {league ? `${league.name} · ` : ''}{players.length} joueurs · {completedCount}/{matches.length} matchs joués
```

Replace with:
```tsx
              {league ? `${league.name} · ` : ''}{enrolledCount} inscrits · {completedCount}/{matches.length} matchs joués
```

- [ ] **Step 8: Update the match section `playerMap` to use enrolled players**

Find:
```typescript
  // Build player map
  const playerMap: Record<string, Player> = {}
  for (const p of players) playerMap[p.id] = p
```

Replace with:
```typescript
  const playerMap: Record<string, Player> = {}
  for (const p of players) playerMap[p.id] = p
```

(No change needed — `playerMap` still uses all players since match IDs reference global player IDs. But we should enrich with deck info from leaguePlayers.)

- [ ] **Step 9: Verify the component compiles — check for remaining references to removed state**

Search for any remaining references to `newName`, `newMoxfield`, `newCommanderImage`, `addLoading`, `addError` in `AdminDashboard.tsx`. Remove them or replace as needed.

- [ ] **Step 10: Commit**

```bash
git add app/admin/AdminDashboard.tsx
git commit -m "feat: replace player form with Participants section (enrollment + deck selector)"
```

---

## Task 11: Update history page — deck fields with backward compat

**Files:**
- Modify: `app/history/[id]/page.tsx`

- [ ] **Step 1: Update the deckMap resolution**

Replace lines 35–50 in `app/history/[id]/page.tsx` with:

```typescript
  const deckMap = new Map(leaguePlayers.map((lp) => [lp.player_id, lp]))

  const leaderboard = computeLeaderboard(participants as Player[], matches as Match[])
  const leaderboardWithDecks = leaderboard.map((p) => {
    const lp = deckMap.get(p.id)
    return {
      ...p,
      moxfield_url: lp?.deck_moxfield_url ?? lp?.moxfield_url ?? null,
      commander_image_url: lp?.deck_commander_image_url ?? lp?.commander_image_url ?? null,
    }
  })

  const playerMap: Record<string, Player> = {}
  for (const p of participants) {
    const lp = deckMap.get(p.id)
    playerMap[p.id] = {
      ...(p as Player),
      moxfield_url: lp?.deck_moxfield_url ?? lp?.moxfield_url ?? null,
      commander_image_url: lp?.deck_commander_image_url ?? lp?.commander_image_url ?? null,
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add "app/history/[id]/page.tsx"
git commit -m "fix: history page uses deck fields with fallback for old league data"
```

---

## Task 12: End-to-end manual verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify the following flows**

1. Navigate to `/admin` — login if needed
2. If no active league: create one ("Saison Test")
3. Verify "Participants" section appears with existing players checked
4. Uncheck a player → verify they're removed from enrollment (no match generation impact)
5. Re-check them → verify re-enrollment works
6. Select "+ Nouveau deck" for a player → fill name + optional fields → click "Créer et assigner"
7. Verify the deck appears selected in the dropdown
8. Add a new player from Zone B → verify they appear in Zone A as enrolled
9. Try to delete a player with history → verify the tooltip/error appears
10. Click "Générer la ligue" → verify only enrolled players get matches
11. Navigate to `/history` → verify old seasons still show moxfield/image data correctly

- [ ] **Step 3: Final commit if any small fixes were made**

```bash
git add -p  # stage only intentional changes
git commit -m "fix: post-verification adjustments"
```
