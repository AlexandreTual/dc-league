'use client'

import { Castle } from 'lucide-react'
import { trackPoint } from '@/lib/game/dungeon-fx'
import { DUNGEONS, dungeonDone, dungeonText, roomOf, roomText, rowsOf } from '@/lib/game/dungeons'
import { useCardLang, useT } from '@/components/i18n/I18nProvider'
import type { PlayerView } from '@/lib/game/types'
import { openDungeon } from './dungeon'
import { useDungeonFx } from './useDungeonFx'

/**
 * Jeton de donjon sous le portrait : donjon, salle et piste des étages où le jeton glisse ; « ✓ N » : donjons terminés.
 * Toucher ouvre le plan. Rien sans donjon (ou avec un serveur de jeu plus ancien).
 */
export default function DungeonToken({ view, player, animate }: { view: PlayerView; player: string; animate: boolean }) {
  const d = useT().table.dungeons
  const [lang] = useCardLang()
  const p = view.players[player]
  const position = p?.dungeon && DUNGEONS[p.dungeon.id] && roomOf(p.dungeon.id, p.dungeon.room) ? p.dungeon : undefined
  const done = p?.dungeonsDone ?? 0
  const fx = useDungeonFx(position, done, animate)
  if (!position && done === 0) return null
  const dungeon = position && dungeonText(position.id, lang)
  const found = position && roomOf(position.id, position.room)
  const room = found && { ...found, ...roomText(found, lang) }
  const finished = !!position && dungeonDone(position)
  const rows = position ? rowsOf(position.id) : 0
  return (
    <div className="relative mt-1">
      <button type="button" onClick={() => openDungeon({ player, ...(position ? { dungeon: position.id } : {}) })}
        className="w-full flex items-center gap-1.5 px-1.5 py-0.5 tablet:min-h-11 rounded-md border border-dc-gold/40 bg-dc-bg/60 text-[10px] text-dc-text hover:border-dc-gold text-left"
        title={dungeon && room ? d.roomTitle(dungeon.name, room.name, room.text) : d.allDone}
        aria-label={d.tokenAria(p.name)} data-dungeon={player} data-dungeon-id={position?.id} data-dungeon-room={position?.room}>
        <Castle className="w-3.5 h-3.5 shrink-0 text-dc-gold" />
        {dungeon && room && (
          <span className="min-w-0 flex-1 flex flex-col">
            <span className="relative truncate">
              <span className="text-dc-gold">{dungeon.short}</span> · {room.name}{finished && <span className="text-dc-gold"> ✓</span>}
              {fx && <span key={fx.n} className="dungeon-lit absolute inset-0 rounded" aria-hidden />}
            </span>
            {/* Piste : un point par étage ; le jeton glisse de l'un à l'autre (transform seulement). */}
            <span className="relative h-2 mx-1 mt-0.5" aria-hidden>
              <span className="absolute left-0 right-0 top-1/2 h-px bg-dc-border" />
              {Array.from({ length: rows }, (_, i) => (
                <span key={i} className={`absolute top-1/2 w-1 h-1 -ml-0.5 -mt-0.5 rounded-full ${i <= (room?.row ?? 0) ? 'bg-dc-gold/70' : 'bg-dc-muted/50'}`}
                  style={{ left: `${rows > 1 ? (i / (rows - 1)) * 100 : 0}%` }} />
              ))}
              <span className={`absolute inset-0 ${fx?.glide ? 'dungeon-glide' : ''}`} style={{ transform: `translateX(${trackPoint(position!)}%)` }} data-dungeon-token>
                <span className="absolute left-0 top-1/2 w-2 h-2 -ml-1 -mt-1 rounded-full bg-dc-gold shadow-[0_0_4px_rgba(240,208,128,0.9)]" />
              </span>
            </span>
          </span>
        )}
        {!position && <span className="flex-1 text-dc-muted">{d.title}</span>}
        {done > 0 && <span className="shrink-0 text-dc-gold tabular-nums" title={d.doneCount(done)} data-testid="dungeons-done">✓ {done}</span>}
      </button>
      {fx?.finish && (
        <span key={fx.n} className="pointer-events-none absolute inset-x-0 -top-2 flex justify-center" data-testid="dungeon-finish" aria-live="polite">
          <span className="dungeon-burst absolute w-16 h-16 -top-6 rounded-full" aria-hidden />
          <span className="dungeon-done-label relative px-2 py-0.5 rounded-full bg-dc-gold text-[#1a1408] text-[10px] font-semibold whitespace-nowrap">{d.finished}</span>
        </span>
      )}
    </div>
  )
}
