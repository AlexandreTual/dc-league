'use client'

import { useState } from 'react'
import { Archive, LogOut, RefreshCcw, Shield, Trash2 } from 'lucide-react'
import type { DbLeague } from '@/lib/db-leagues'

/**
 * En-tête de la page admin : saison en cours, compteurs et actions de saison.
 * Un seul bouton « Supprimer la saison », ici (issue #66).
 */
export default function LeagueHeader({
  league, enrolledCount, matchCount, completedCount, canClose,
  onResetMatches, onCloseLeague, onDeleteLeague, onLogout,
}: {
  league: DbLeague | null
  enrolledCount: number
  matchCount: number
  completedCount: number
  /** La saison peut être clôturée (tous les matchs joués, playoffs terminés ou impossibles). */
  canClose: boolean
  onResetMatches: () => void
  onCloseLeague: () => Promise<void>
  onDeleteLeague: () => Promise<void>
  onLogout: () => void
}) {
  const [confirmResetLeague, setConfirmResetLeague] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [closeLoading, setCloseLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  async function closeLeague() {
    setCloseLoading(true)
    setConfirmClose(false)
    try {
      await onCloseLeague()
    } finally {
      setCloseLoading(false)
    }
  }

  async function deleteLeague() {
    setDeleteLoading(true)
    setConfirmDelete(false)
    try {
      await onDeleteLeague()
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-dc-gold/10 border border-dc-gold/30 flex items-center justify-center">
          <Shield className="w-5 h-5 text-dc-gold" />
        </div>
        <div>
          <h1 className="font-fantasy text-2xl font-bold text-dc-gold">Admin</h1>
          {league && (
            <p className="text-dc-gold/70 text-sm font-semibold">{league.name}</p>
          )}
          <p className="text-dc-muted text-xs">
            {enrolledCount} inscrits · {completedCount}/{matchCount} matchs joués
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {matchCount > 0 && (
          confirmResetLeague ? (
            <div className="flex items-center gap-1.5">
              <span className="text-dc-red-light text-xs">
                {completedCount > 0 ? 'Scores perdus !' : 'Supprimer les matchs ?'}
              </span>
              <button
                onClick={() => { setConfirmResetLeague(false); onResetMatches() }}
                className="text-xs px-3 py-2 bg-dc-red/20 border border-dc-red/40 text-dc-red-light rounded-lg hover:bg-dc-red/30 transition-all"
              >
                Oui
              </button>
              <button onClick={() => setConfirmResetLeague(false)} className="text-xs px-3 py-2 border border-dc-border/50 text-dc-muted rounded-lg hover:text-dc-text transition-all">Non</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmResetLeague(true)}
              aria-label="Réinitialiser la ligue"
              className="flex items-center gap-1.5 text-dc-muted hover:text-dc-red-light text-xs px-3 py-2 border border-dc-border/50 rounded-lg transition-all hover:border-dc-red-light/30"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Réinitialiser la ligue</span>
            </button>
          )
        )}
        {league && canClose && (
          confirmClose ? (
            <div className="flex items-center gap-1.5">
              <span className="text-dc-gold text-xs">Clôturer la saison ?</span>
              <button
                onClick={closeLeague}
                disabled={closeLoading}
                className="text-xs px-3 py-2 bg-dc-gold/20 border border-dc-gold/40 text-dc-gold rounded-lg hover:bg-dc-gold/30 transition-all disabled:opacity-40"
              >
                {closeLoading ? 'Clôture…' : 'Oui'}
              </button>
              <button
                onClick={() => setConfirmClose(false)}
                className="text-xs px-3 py-2 border border-dc-border/50 text-dc-muted rounded-lg hover:text-dc-text transition-all"
              >
                Non
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClose(true)}
              aria-label="Clôturer la saison"
              className="flex items-center gap-1.5 text-dc-muted hover:text-dc-gold text-xs px-3 py-2 border border-dc-border/50 rounded-lg transition-all hover:border-dc-gold/30"
            >
              <Archive className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Clôturer la saison</span>
            </button>
          )
        )}
        {league && (
          confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-dc-red-light text-xs">Supprimer la saison ?</span>
              <button onClick={deleteLeague} disabled={deleteLoading} className="text-xs px-3 py-2 bg-dc-red/20 border border-dc-red/40 text-dc-red-light rounded-lg hover:bg-dc-red/30 transition-all disabled:opacity-40">
                {deleteLoading ? '…' : 'Oui'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs px-3 py-2 border border-dc-border/50 text-dc-muted rounded-lg hover:text-dc-text transition-all">
                Non
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} aria-label="Supprimer la saison" className="flex items-center gap-1.5 text-dc-muted hover:text-dc-red-light text-xs px-3 py-2 border border-dc-border/50 rounded-lg transition-all hover:border-dc-red-light/30">
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Supprimer la saison</span>
            </button>
          )
        )}
        <button
          onClick={onLogout}
          aria-label="Déconnexion"
          className="flex items-center gap-2 text-dc-muted hover:text-dc-text text-sm px-3 py-2 rounded-lg hover:bg-dc-border/30 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:block">Déconnexion</span>
        </button>
      </div>
    </div>
  )
}
