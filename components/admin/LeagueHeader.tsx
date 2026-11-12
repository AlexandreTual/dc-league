'use client'

import { useState } from 'react'
import { Archive, RefreshCcw, Settings, Trash2 } from 'lucide-react'
import type { DbLeague } from '@/lib/db-leagues'
import { useT } from '@/components/i18n/I18nProvider'

/**
 * En-tête de la gestion d'une ligue : compteurs et actions (réinitialiser, clôturer, supprimer).
 * Un seul bouton « Supprimer la ligue », ici (issue #66).
 */
export default function LeagueHeader({
  league, enrolledCount, matchCount, completedCount, canClose, canDelete,
  onResetMatches, onCloseLeague, onDeleteLeague,
}: {
  league: DbLeague
  enrolledCount: number
  matchCount: number
  completedCount: number
  /** La ligue peut être clôturée (tous les matchs joués, playoffs terminés ou impossibles). */
  canClose: boolean
  /** L'organisateur ne supprime qu'une ligue sans score ; un admin, toujours. */
  canDelete: boolean
  onResetMatches: () => void
  onCloseLeague: () => Promise<void>
  onDeleteLeague: () => Promise<void>
}) {
  const t = useT().admin.league
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
          <Settings className="w-5 h-5 text-dc-gold" />
        </div>
        <div>
          <h2 className="font-fantasy text-xl font-bold text-dc-gold">{t.title}</h2>
          <p className="text-dc-muted text-xs">
            {t.counts(enrolledCount, completedCount, matchCount)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {league.is_active && matchCount > 0 && (
          confirmResetLeague ? (
            <div className="flex items-center gap-1.5">
              <span className="text-dc-red-light text-xs">
                {completedCount > 0 ? t.scoresLost : t.deleteMatches}
              </span>
              <button
                onClick={() => { setConfirmResetLeague(false); onResetMatches() }}
                className="text-xs px-3 py-2 bg-dc-red/20 border border-dc-red/40 text-dc-red-light rounded-lg hover:bg-dc-red/30 transition-all"
              >
                {t.yes}
              </button>
              <button onClick={() => setConfirmResetLeague(false)} className="text-xs px-3 py-2 border border-dc-border/50 text-dc-muted rounded-lg hover:text-dc-text transition-all">{t.no}</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmResetLeague(true)}
              aria-label={t.reset}
              className="flex items-center gap-1.5 text-dc-muted hover:text-dc-red-light text-xs px-3 py-2 border border-dc-border/50 rounded-lg transition-all hover:border-dc-red-light/30"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:block">{t.reset}</span>
            </button>
          )
        )}
        {league.is_active && canClose && (
          confirmClose ? (
            <div className="flex items-center gap-1.5">
              <span className="text-dc-gold text-xs">{t.confirmClose}</span>
              <button
                onClick={closeLeague}
                disabled={closeLoading}
                className="text-xs px-3 py-2 bg-dc-gold/20 border border-dc-gold/40 text-dc-gold rounded-lg hover:bg-dc-gold/30 transition-all disabled:opacity-40"
              >
                {closeLoading ? t.closing : t.yes}
              </button>
              <button
                onClick={() => setConfirmClose(false)}
                className="text-xs px-3 py-2 border border-dc-border/50 text-dc-muted rounded-lg hover:text-dc-text transition-all"
              >
                {t.no}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClose(true)}
              aria-label={t.close}
              className="flex items-center gap-1.5 text-dc-muted hover:text-dc-gold text-xs px-3 py-2 border border-dc-border/50 rounded-lg transition-all hover:border-dc-gold/30"
            >
              <Archive className="w-3.5 h-3.5" />
              <span className="hidden sm:block">{t.close}</span>
            </button>
          )
        )}
        {canDelete && (
          confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-dc-red-light text-xs">{t.confirmDelete}</span>
              <button onClick={deleteLeague} disabled={deleteLoading} className="text-xs px-3 py-2 bg-dc-red/20 border border-dc-red/40 text-dc-red-light rounded-lg hover:bg-dc-red/30 transition-all disabled:opacity-40">
                {deleteLoading ? '…' : t.yes}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs px-3 py-2 border border-dc-border/50 text-dc-muted rounded-lg hover:text-dc-text transition-all">
                {t.no}
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} aria-label={t.delete} className="flex items-center gap-1.5 text-dc-muted hover:text-dc-red-light text-xs px-3 py-2 border border-dc-border/50 rounded-lg transition-all hover:border-dc-red-light/30">
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:block">{t.delete}</span>
            </button>
          )
        )}
      </div>
    </div>
  )
}
