'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, RotateCcw, Send, Sparkles, X } from 'lucide-react'
import { AI_MAX_CARDS, AI_MAX_QUESTION_CHARS } from '@/lib/ai/limits'
import { useI18n } from '@/components/i18n/I18nProvider'
import { answerBlocks, inlineParts } from './format'
import { suggestions, type AiAction, type AiState } from './state'

function Inline({ text }: { text: string }) {
  return (
    <>
      {inlineParts(text).map((p, i) => (p.bold ? <strong key={i} className="text-dc-gold">{p.text}</strong> : <span key={i}>{p.text}</span>))}
    </>
  )
}

/** Réponse de l'IA : texte brut découpé en paragraphes et listes (jamais de HTML interprété). */
function Answer({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {answerBlocks(text).map((b, i) =>
        b.kind === 'list' ? (
          <ul key={i} className="list-disc pl-5 space-y-1">
            {b.items.map((item, j) => <li key={j}><Inline text={item} /></li>)}
          </ul>
        ) : (
          <p key={i} className={b.kind === 'heading' ? 'font-semibold text-dc-gold' : undefined}><Inline text={b.text} /></p>
        ),
      )}
    </div>
  )
}

/** Panneau de l'assistant : à droite sur ordinateur et tablette, plein écran sur téléphone. */
export default function AiPanel({ state, dispatch }: { state: AiState; dispatch: (action: AiAction) => void }) {
  const { t: messages, cardLang } = useI18n()
  const t = messages.ai
  const [draft, setDraft] = useState('')
  const thread = useRef<HTMLDivElement>(null)
  const exhausted = state.remaining === 0
  const canSend = !state.pending && !exhausted && state.cards.length > 0

  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight })
  }, [state.messages.length, state.pending, state.error])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dispatch({ type: 'close' })
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch])

  async function send(text: string) {
    const question = text.trim()
    if (!question || !canSend) return
    const history = [...state.messages.map((m) => ({ role: m.role, text: m.text })), { role: 'user' as const, text: question }]
    dispatch({ type: 'send', text: question })
    setDraft('')
    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // cardLang : noms français donnés à l'IA si les cartes sont en français (réponse dans la langue de l'interface).
        body: JSON.stringify({ oracleIds: state.cards.map((c) => c.oracleId), messages: history, cardLang }),
      })
      const body = (await res.json().catch(() => ({}))) as { answer?: string; remaining?: number; error?: string }
      if (res.ok && typeof body.answer === 'string') {
        dispatch({ type: 'answer', text: body.answer, remaining: body.remaining ?? 0 })
      } else {
        setDraft(question)
        dispatch({ type: 'fail', error: body.error ?? t.genericError, remaining: body.remaining })
      }
    } catch {
      setDraft(question)
      dispatch({ type: 'fail', error: t.networkError })
    }
  }

  return createPortal(
    <aside
      role="dialog"
      aria-label={t.title}
      data-testid="ai-panel"
      className="fixed z-[75] inset-0 sm:inset-auto sm:top-0 sm:right-0 sm:bottom-0 sm:w-[380px] bg-dc-surface sm:border-l border-dc-border shadow-card flex flex-col text-sm"
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div className="px-4 py-3 border-b border-dc-border flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-dc-gold" />
        <h2 className="font-fantasy text-dc-gold text-lg leading-tight flex-1">{t.title}</h2>
        {state.messages.length > 0 && (
          <button onClick={() => dispatch({ type: 'reset' })} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-dc-border text-dc-muted hover:text-dc-text">
            <RotateCcw className="w-3.5 h-3.5" /> {t.newQuestion}
          </button>
        )}
        <button onClick={() => dispatch({ type: 'close' })} className="p-1.5 rounded-lg text-dc-muted hover:text-dc-text" aria-label={messages.common.close}>
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 py-2 border-b border-dc-border space-y-1">
        {state.cards.length === 0 ? (
          <p className="text-dc-muted text-xs">{t.noCard}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5" data-testid="ai-cards">
            {state.cards.map((c) => (
              <li key={c.oracleId} className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-dc-gold/15 border border-dc-gold/30 text-dc-gold text-xs">
                <span className="max-w-[12rem] truncate">{c.name}</span>
                <button onClick={() => dispatch({ type: 'remove', oracleId: c.oracleId })} aria-label={t.removeCard(c.name)} className="p-0.5 rounded-full hover:bg-dc-gold/20">
                  <X className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {state.notice === 'maxCards' && <p className="text-dc-red-light text-xs">{t.maxCards(AI_MAX_CARDS)}</p>}
      </div>

      <div ref={thread} className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3" data-testid="ai-thread">
        {state.messages.length === 0 && !state.pending && (
          <div className="flex flex-wrap gap-2">
            {suggestions(state.cards.length, messages).map((s) => (
              <button key={s} onClick={() => send(s)} disabled={!canSend} className="text-xs px-3 py-1.5 rounded-lg border border-dc-gold/40 text-dc-gold hover:bg-dc-gold/10 disabled:opacity-40">
                {s}
              </button>
            ))}
          </div>
        )}
        {state.messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="ml-8 rounded-2xl rounded-br-sm bg-dc-gold/15 border border-dc-gold/30 px-3 py-2 text-dc-text whitespace-pre-line" data-testid="ai-question">
              {m.text}
            </div>
          ) : (
            <div key={i} className="mr-4 rounded-2xl rounded-bl-sm bg-dc-bg border border-dc-border px-3 py-2 text-dc-text space-y-2" data-testid="ai-answer">
              <Answer text={m.text} />
              {m.cards.length > 0 && (
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {m.cards.map((c) => (
                    <a key={c.oracleId} href={c.gathererUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-dc-gold hover:underline">
                      {c.name} <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </p>
              )}
            </div>
          ),
        )}
        {state.pending && <p className="text-dc-muted italic" role="status">{t.thinking}</p>}
        {state.error && <p className="text-dc-red-light" role="alert" data-testid="ai-error">{state.error}</p>}
      </div>

      <form
        className="px-4 py-3 border-t border-dc-border space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          send(draft)
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(draft)
              }
            }}
            maxLength={AI_MAX_QUESTION_CHARS}
            rows={2}
            disabled={exhausted}
            placeholder={exhausted ? t.quotaReached : t.placeholder}
            aria-label={t.questionLabel}
            className="flex-1 resize-none bg-dc-bg border border-dc-border rounded-xl px-3 py-2 text-dc-text placeholder-dc-muted/60 focus:outline-none focus:border-dc-gold/50 disabled:opacity-50"
          />
          <button type="submit" disabled={!canSend || !draft.trim()} aria-label={t.send} className="p-2.5 rounded-xl bg-dc-gold/20 border border-dc-gold/40 text-dc-gold disabled:opacity-40">
            <Send className="w-4 h-4" />
          </button>
        </div>
        {state.remaining !== null && (
          <p className={`text-xs ${exhausted ? 'text-dc-red-light' : 'text-dc-muted'}`} data-testid="ai-remaining">
            {exhausted ? t.quotaReached : t.remaining(state.remaining)}
          </p>
        )}
        <p className="text-[11px] text-dc-muted">{t.disclaimer}</p>
      </form>
    </aside>,
    document.body,
  )
}
