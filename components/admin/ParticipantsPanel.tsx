'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import { Plus, Trash2, UserPlus, Users, X } from 'lucide-react'
import type { Player } from '@/lib/leaderboard'
import type { DbDeck } from '@/lib/db-decks'
import type { DbLeague, DbLeaguePlayerWithName } from '@/lib/db-leagues'
import { sendJson } from '@/components/formStyles'
import type { AdminApi } from './useAdminApi'

/** Inscriptions de la saison : joueurs existants (avec leur deck) et ajout d'un joueur. */
export default function ParticipantsPanel({
  league, api, players, setPlayers, leaguePlayers, setLeaguePlayers,
  playerDecks, setPlayerDecks, playerIdsWithHistory,
}: {
  league: DbLeague
  api: AdminApi
  players: Player[]
  setPlayers: Dispatch<SetStateAction<Player[]>>
  leaguePlayers: DbLeaguePlayerWithName[]
  setLeaguePlayers: Dispatch<SetStateAction<DbLeaguePlayerWithName[]>>
  playerDecks: Record<string, DbDeck[]>
  setPlayerDecks: Dispatch<SetStateAction<Record<string, DbDeck[]>>>
  playerIdsWithHistory: string[]
}) {
  const { showToast, call } = api

  const [creatingDeckForPlayerId, setCreatingDeckForPlayerId] = useState<string | null>(null)
  const [newDeckName, setNewDeckName] = useState('')
  const [newDeckImage, setNewDeckImage] = useState('')
  const [newDeckMoxfield, setNewDeckMoxfield] = useState('')
  const [deckLoading, setDeckLoading] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [addPlayerLoading, setAddPlayerLoading] = useState(false)
  const [addPlayerError, setAddPlayerError] = useState('')
  const [showNewPlayerDeck, setShowNewPlayerDeck] = useState(false)
  const [newPlayerDeckName, setNewPlayerDeckName] = useState('')
  const [newPlayerDeckImage, setNewPlayerDeckImage] = useState('')
  const [newPlayerDeckMoxfield, setNewPlayerDeckMoxfield] = useState('')

  const enrolledIds = new Set(leaguePlayers.map((lp) => lp.player_id))
  const enrolledCount = leaguePlayers.length
  const historySet = new Set(playerIdsWithHistory)

  async function handleToggleEnroll(player: Player, isEnrolled: boolean) {
    if (isEnrolled) {
      const { ok } = await call(`/api/leagues/${league.id}/players/${player.id}`, 'DELETE')
      if (!ok) return
      setLeaguePlayers((prev) => prev.filter((lp) => lp.player_id !== player.id))
      showToast(`${player.name} désinscrit`)
    } else {
      const { ok, data } = await call<DbLeaguePlayerWithName>(`/api/leagues/${league.id}/players`, 'POST', { player_id: player.id })
      if (!ok) return
      const lp = data as DbLeaguePlayerWithName
      setLeaguePlayers((prev) => [...prev, { ...lp, name: player.name, avatar_url: (player as unknown as { avatar_url?: string | null }).avatar_url ?? null, deck_name: null, deck_moxfield_url: null, deck_commander_image_url: null, deck_has_cards: false }])
      showToast(`${player.name} inscrit`)
    }
  }

  /** Assigne un deck ; `knownDeck` sert quand le deck vient d'être créé et n'est pas encore dans `playerDecks`. */
  async function handleAssignDeck(playerId: string, deckId: string, knownDeck?: DbDeck): Promise<boolean> {
    const { ok } = await call(`/api/leagues/${league.id}/players/${playerId}`, 'PATCH', { deck_id: deckId || null })
    if (!ok) return false
    const deck = knownDeck ?? playerDecks[playerId]?.find((d) => d.id === deckId)
    setLeaguePlayers((prev) =>
      prev.map((lp) =>
        lp.player_id === playerId
          ? { ...lp, deck_id: deckId || null, deck_name: deck?.name ?? null, deck_moxfield_url: deck?.moxfield_url ?? null, deck_commander_image_url: deck?.commander_image_url ?? null }
          : lp
      )
    )
    return true
  }

  async function handleCreateDeck(e: React.FormEvent, playerId: string) {
    e.preventDefault()
    if (!newDeckName.trim()) return
    setDeckLoading(true)
    try {
      const { ok, data } = await call<DbDeck>(`/api/players/${playerId}/decks`, 'POST', {
        name: newDeckName.trim(),
        commander_image_url: newDeckImage.trim() || null,
        moxfield_url: newDeckMoxfield.trim() || null,
      })
      if (!ok) return
      const deck = data as DbDeck
      setPlayerDecks((prev) => ({ ...prev, [playerId]: [...(prev[playerId] ?? []), deck] }))
      const assigned = await handleAssignDeck(playerId, deck.id, deck)
      // Le deck existe désormais : on ferme le formulaire même si l'assignation échoue (pas de doublon en réessayant).
      setNewDeckName('')
      setNewDeckImage('')
      setNewDeckMoxfield('')
      setCreatingDeckForPlayerId(null)
      showToast(assigned ? `Deck "${deck.name}" créé !` : `Deck "${deck.name}" créé mais non assigné : choisis-le dans la liste`)
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
      const { error, data: created } = await sendJson('/api/players', 'POST', { name: newPlayerName.trim() })
      if (error) {
        setAddPlayerError(error)
        return
      }
      const data = created as Player

      setPlayers((prev) => [...prev, data])

      let newLp: DbLeaguePlayerWithName = {
        league_id: league.id,
        player_id: data.id,
        deck_id: null,
        moxfield_url: null,
        commander_image_url: null,
        name: data.name,
        avatar_url: null,
        deck_name: null,
        deck_moxfield_url: null,
        deck_commander_image_url: null,
        deck_has_cards: false,
      }

      if (showNewPlayerDeck && newPlayerDeckName.trim()) {
        const deckRes = await sendJson(`/api/players/${data.id}/decks`, 'POST', {
          name: newPlayerDeckName.trim(),
          commander_image_url: newPlayerDeckImage.trim() || null,
          moxfield_url: newPlayerDeckMoxfield.trim() || null,
        })
        if (deckRes.error) {
          setAddPlayerError(`${data.name} est ajouté, mais le deck n'a pas pu être créé : ${deckRes.error}`)
        } else {
          const deck = deckRes.data as DbDeck
          setPlayerDecks((prev) => ({ ...prev, [data.id]: [deck] }))
          const assign = await sendJson(`/api/leagues/${league.id}/players/${data.id}`, 'PATCH', { deck_id: deck.id })
          if (assign.error) {
            setAddPlayerError(`${data.name} est ajouté, mais le deck n'a pas pu être assigné : ${assign.error}`)
          } else {
            newLp = { ...newLp, deck_id: deck.id, deck_name: deck.name, deck_moxfield_url: deck.moxfield_url, deck_commander_image_url: deck.commander_image_url }
          }
        }
      }

      setLeaguePlayers((prev) => [...prev, newLp])
      setNewPlayerName('')
      setNewPlayerDeckName('')
      setNewPlayerDeckImage('')
      setNewPlayerDeckMoxfield('')
      setShowNewPlayerDeck(false)
      showToast(`${data.name} ajouté et inscrit !`)
    } finally {
      setAddPlayerLoading(false)
    }
  }

  async function handleDeletePlayer(id: string, name: string) {
    const { ok } = await call('/api/players', 'DELETE', { id })
    if (!ok) return
    setPlayers((prev) => prev.filter((p) => p.id !== id))
    showToast(`${name} supprimé`)
  }

  return (
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
                {/* Sur téléphone, la liste des decks passe sous le nom pour qu'il reste lisible. */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-dc-bg/50 border border-dc-border/40 rounded-xl px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={isEnrolled}
                    onChange={() => handleToggleEnroll(player, isEnrolled)}
                    aria-label={`Inscrire ${player.name} à la saison`}
                    className="w-4 h-4 accent-dc-gold cursor-pointer"
                  />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-dc-border/60 flex items-center justify-center shrink-0">
                      <span className="text-dc-gold font-bold text-xs">
                        {player.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-dc-text text-sm font-semibold truncate">{player.name}</span>
                  </div>
                  {isEnrolled && (
                    <div className="order-last basis-full pl-7 sm:order-none sm:basis-auto sm:pl-0 flex items-center gap-2 sm:shrink-0">
                      <select
                        value={assignedDeckId}
                        aria-label={`Deck de ${player.name}`}
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
                        className="bg-dc-bg border border-dc-border rounded-lg px-2 py-1.5 text-dc-text text-xs focus:outline-none focus:border-dc-gold/50 transition-colors w-full sm:w-auto sm:max-w-[160px]"
                      >
                        <option value="">Sans deck</option>
                        {decksForPlayer.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                        <option value="__new__">+ Nouveau deck</option>
                      </select>
                    </div>
                  )}
                  <button
                    onClick={() => handleDeletePlayer(player.id, player.name)}
                    aria-label={`Supprimer ${player.name}`}
                    disabled={historySet.has(player.id)}
                    title={
                      isEnrolled
                        ? 'Désinscris le joueur avant de le supprimer'
                        : historySet.has(player.id)
                          ? 'Ce joueur a participé à une league et ne peut pas être supprimé'
                          : 'Supprimer'
                    }
                    className="text-dc-muted hover:text-dc-red-light transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

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

      <div className="border-t border-dc-border/50" />

      <div className="space-y-3">
        <p className="text-dc-muted text-xs uppercase tracking-wide">Nouveau joueur</p>
        <form onSubmit={handleAddNewPlayer} className="space-y-3">
          <div className="flex gap-3">
            <input
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="ex: Alexandre"
              className="flex-1 min-w-0 bg-dc-bg border border-dc-border rounded-xl px-4 py-2.5 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 transition-colors text-sm"
            />
            <button
              type="submit"
              disabled={!newPlayerName.trim() || addPlayerLoading}
              className="shrink-0 flex items-center gap-2 bg-dc-gold/15 hover:bg-dc-gold/25 border border-dc-gold/30 text-dc-gold px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <UserPlus className="w-4 h-4" />
              {addPlayerLoading ? 'Ajout…' : 'Ajouter'}
            </button>
          </div>

          {!showNewPlayerDeck && (
            <button
              type="button"
              onClick={() => setShowNewPlayerDeck(true)}
              className="flex items-center gap-1.5 text-dc-muted hover:text-dc-gold text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter un deck (optionnel)
            </button>
          )}

          {showNewPlayerDeck && (
            <div className="bg-dc-bg/70 border border-dc-gold/20 rounded-xl px-4 py-3 space-y-2">
              <p className="text-dc-gold text-xs font-semibold">Deck du nouveau joueur (optionnel)</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <label className="block text-dc-muted text-xs mb-1">Nom du deck</label>
                  <input
                    type="text"
                    value={newPlayerDeckName}
                    onChange={(e) => setNewPlayerDeckName(e.target.value)}
                    placeholder="ex: Ur-Dragon"
                    className="w-full bg-dc-bg border border-dc-border rounded-lg px-3 py-2 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-dc-muted text-xs mb-1">Image commandant</label>
                  <input
                    type="url"
                    value={newPlayerDeckImage}
                    onChange={(e) => setNewPlayerDeckImage(e.target.value)}
                    placeholder="https://assets.moxfield.net/..."
                    className="w-full bg-dc-bg border border-dc-border rounded-lg px-3 py-2 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-dc-muted text-xs mb-1">Lien Moxfield</label>
                  <input
                    type="url"
                    value={newPlayerDeckMoxfield}
                    onChange={(e) => setNewPlayerDeckMoxfield(e.target.value)}
                    placeholder="https://moxfield.com/decks/..."
                    className="w-full bg-dc-bg border border-dc-border rounded-lg px-3 py-2 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 text-xs"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowNewPlayerDeck(false); setNewPlayerDeckName(''); setNewPlayerDeckImage(''); setNewPlayerDeckMoxfield('') }}
                className="flex items-center gap-1.5 text-dc-muted hover:text-dc-text text-xs transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Annuler le deck
              </button>
            </div>
          )}
        </form>
        {addPlayerError && (
          <p className="text-dc-red-light text-sm bg-dc-red/20 border border-dc-red/30 rounded-lg px-3 py-2">
            {addPlayerError}
          </p>
        )}
      </div>
    </div>
  )
}
