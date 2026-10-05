'use client'

import Link from 'next/link'
import { Crown } from 'lucide-react'
import { cardInfo } from '@/lib/game/apply'
import type { CardDataMap } from '@/lib/game/room'
import type { CardView, Catalog, PlayerViewState } from '@/lib/game/types'
import { useGameSocket } from './useGameSocket'

// Vue de jeu minimale (sous-projet 2) : sert à vérifier le jeu en ligne de bout en bout.
// La vraie table graphique viendra avec le sous-projet 3.

const button = 'px-3 py-1.5 rounded-lg text-sm border border-dc-border text-dc-text hover:border-dc-gold/50 disabled:opacity-40'
const ZONES = [['battlefield', 'Champ de bataille'], ['command', 'Commandement'], ['graveyard', 'Cimetière'], ['exile', 'Exil']] as const

function catalogsOf(cards: CardDataMap): Record<string, Catalog> {
  return Object.fromEntries(
    Object.entries(cards).map(([owner, refs]) => [owner, { deckId: owner, fingerprint: '', entries: Object.values(refs) }]),
  )
}

function cardLabel(card: CardView, catalogs: Record<string, Catalog>): string {
  if (card.hidden) return 'carte cachée'
  const info = cardInfo(catalogs[card.owner], card, 'fr')
  const tags = [card.tapped && 'engagée', card.faceDown && 'face cachée'].filter(Boolean)
  return `${info.hidden && !card.faceDown ? 'une carte' : info.name}${tags.length ? ` (${tags.join(', ')})` : ''}`
}

export default function MinimalGame({ tableId }: { tableId: string }) {
  const { status, last, cards, error, send } = useGameSocket(tableId)

  if (!last) {
    return <p className="text-dc-muted text-center py-16">{status === 'reconnecting' ? 'Reconnexion…' : 'Connexion à la partie…'}</p>
  }

  const { view, host, online, finished, winner } = last
  const catalogs = catalogsOf(cards)
  const me: PlayerViewState | undefined = view.players[view.me]
  const isHost = view.me === host
  const nameOf = (id: string | null) => (id ? view.players[id]?.name ?? '?' : '?')
  const act = (action: Parameters<typeof send>[0]) => send(action)

  return (
    <div className="max-w-5xl mx-auto space-y-4" data-testid="game">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-fantasy text-2xl font-bold text-dc-gold" data-testid="turn">Tour {view.turn}</h1>
        <span className="text-dc-text">Joueur actif : {nameOf(view.activePlayer)}</span>
        <Link href="/salon" className="ml-auto text-sm text-dc-muted hover:text-dc-text">Retour au salon</Link>
      </div>

      {status !== 'open' && <p className="text-sm bg-dc-gold/10 border border-dc-gold/30 text-dc-gold rounded-lg px-3 py-2">Reconnexion…</p>}
      {!me && <p className="text-sm bg-dc-blue/20 border border-dc-border text-dc-text rounded-lg px-3 py-2" data-testid="spectator">Tu regardes cette partie</p>}
      {finished && (
        <p className="text-lg font-fantasy text-dc-gold bg-dc-gold/10 border border-dc-gold/30 rounded-lg px-3 py-2" data-testid="finished">
          {winner ? `Victoire de ${nameOf(winner)}` : 'Partie close'}
        </p>
      )}
      {error && <p className="text-sm text-dc-red-light bg-dc-red/20 border border-dc-red/30 rounded-lg px-3 py-2" data-testid="error">{error}</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {view.turnOrder.map((id) => {
          const p = view.players[id]
          return (
            <section
              key={id}
              data-player={id}
              className={`bg-dc-surface border rounded-xl p-3 space-y-1 text-sm ${id === view.activePlayer ? 'border-dc-gold/60' : 'border-dc-border'} ${p.eliminated ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${online.includes(id) ? 'bg-dc-green-light' : 'bg-dc-muted/40'}`} title={online.includes(id) ? 'en ligne' : 'hors ligne'} />
                <span className="font-semibold text-dc-text">{p.name}</span>
                {id === host && <Crown className="w-4 h-4 text-dc-gold" aria-label="hôte" />}
                {p.eliminated && <span className="text-dc-red-light">éliminé</span>}
                <span className="ml-auto text-dc-text" data-testid="life">{p.life} PV</span>
                {p.poison > 0 && <span className="text-dc-green-light">{p.poison} poison</span>}
              </div>
              <p className="text-dc-muted">
                Main : <span data-testid="hand-count">{p.zones.hand.length}</span> · Bibliothèque : {p.zones.library.count}
              </p>
              {ZONES.map(([zone, label]) =>
                p.zones[zone].length > 0 ? (
                  <p key={zone} className="text-dc-muted">
                    {label} : <span className="text-dc-text">{p.zones[zone].map((c) => cardLabel(c, catalogs)).join(', ')}</span>
                  </p>
                ) : null,
              )}
              {isHost && !finished && !p.eliminated && id !== view.me && (
                <div className="flex gap-2 pt-1">
                  {id === view.activePlayer && (
                    <button className={button} onClick={() => send({ type: 'host', op: 'passTurn', target: id })}>Passer son tour</button>
                  )}
                  <button className={button} onClick={() => confirm(`Éliminer ${p.name} ?`) && send({ type: 'host', op: 'eliminate', target: id })}>Éliminer</button>
                </div>
              )}
            </section>
          )
        })}
      </div>

      {me && !finished && (
        <section className="bg-dc-surface border border-dc-border rounded-xl p-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {!me.kept && <button className={button} onClick={() => act({ type: 'action', action: { type: 'keep' } })}>Garder</button>}
            {!me.kept && <button className={button} onClick={() => act({ type: 'action', action: { type: 'mulligan' } })}>Mulligan</button>}
            <button className={button} onClick={() => act({ type: 'action', action: { type: 'draw', count: 1 } })}>Piocher</button>
            <button className={button} disabled={view.activePlayer !== view.me} onClick={() => act({ type: 'action', action: { type: 'endTurn' } })}>Fin du tour</button>
            <button className={button} disabled={!view.canUndo} onClick={() => act({ type: 'undo' })}>Annuler</button>
            <button className={button} disabled={me.eliminated} onClick={() => confirm('Abandonner la partie ?') && act({ type: 'concede' })}>Abandonner</button>
            {isHost && <button className={button} onClick={() => confirm('Clore la partie sans vainqueur ?') && act({ type: 'host', op: 'close' })}>Clore la partie</button>}
          </div>
          <div>
            <h2 className="text-dc-muted text-xs mb-1">Ma main</h2>
            <ul className="flex flex-wrap gap-2" data-testid="my-hand">
              {me.zones.hand.map((c) =>
                c.hidden ? null : (
                  <li key={c.id} className="flex items-center gap-1 border border-dc-border rounded-lg px-2 py-1 text-sm text-dc-text">
                    {cardLabel(c, catalogs)}
                    <button
                      className="text-dc-gold text-xs"
                      onClick={() => act({ type: 'action', action: { type: 'move', id: c.id, to: { player: view.me, zone: 'battlefield' } } })}
                    >
                      Jouer
                    </button>
                  </li>
                ),
              )}
            </ul>
          </div>
        </section>
      )}

      <section className="bg-dc-surface border border-dc-border rounded-xl p-3">
        <h2 className="text-dc-muted text-xs mb-1">Journal</h2>
        <ol className="space-y-0.5 text-sm max-h-64 overflow-y-auto" data-testid="log">
          {[...view.log].reverse().slice(0, 40).map((l, i) => (
            <li key={view.log.length - i} className="text-dc-text">
              <span className="text-dc-muted mr-2">T{l.turn}</span>
              {l.actor && <span className="text-dc-gold mr-1">{nameOf(l.actor)} :</span>}
              {l.text}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
