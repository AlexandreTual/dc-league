import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en, fr } from './messages'
import { translateGameError } from './game-errors'
import { SOCKET_MSG } from '@/components/online/reconnect'

/**
 * Fichiers qui envoient des erreurs au navigateur : validation (`validate.ts`), droits (`canApply`, dans `rules.ts` ;
 * `apply.ts` n'écrit pas d'erreur), salle de jeu (`room.ts`), serveur de jeu (`runtime.ts`), départ d'une table
 * (`db-games.ts`, vérifié aussi dans la salle d'attente).
 */
const SOURCES = ['lib/game/validate.ts', 'lib/game/rules.ts', 'lib/game/room.ts', 'workers/game/runtime.ts', 'lib/db-games.ts']

const QUOTED = String.raw`(?:'([^'\n]*)'|"([^"\n]*)")`

/** Messages d'erreur d'une source : tables `MSG`/`ERR`, `return '…'`, `RETRY`, raisons de fermeture, gabarits `return \`…\``. */
function errorsIn(source: string): string[] {
  const out: string[] = []
  const add = (m: RegExpMatchArray) => out.push(m[1] ?? m[2])
  for (const block of source.matchAll(/const (?:MSG|ERR) = \{\n([\s\S]*?)\n\}/g)) {
    for (const m of block[1].matchAll(new RegExp(String.raw`^\s*\w+: ${QUOTED},?$`, 'gm'))) add(m)
  }
  for (const m of source.matchAll(new RegExp(String.raw`return ${QUOTED}\s*$`, 'gm'))) add(m)
  for (const m of source.matchAll(new RegExp(String.raw`const RETRY = ${QUOTED}`, 'g'))) add(m)
  for (const m of source.matchAll(new RegExp(String.raw`\.close\(\d+, ${QUOTED}\)`, 'g'))) add(m)
  // Messages à valeur : la valeur est remplacée par un exemple.
  for (const m of source.matchAll(/return `([^`\n]*)`\s*$/gm)) out.push(m[1].replace(/\$\{[^}]*\}/g, 'exemple'))
  return out
}

const ALL = [...new Set(SOURCES.flatMap((file) => errorsIn(readFileSync(join(process.cwd(), file), 'utf8'))))]

describe('translateGameError', () => {
  it('recense les messages des sources', () => {
    expect(ALL.length).toBeGreaterThan(40)
    expect(ALL).toContain('Carte introuvable')
    expect(ALL).toContain('Action invalide : exemple')
    expect(ALL).toContain('Réessaie')
    expect(ALL).toContain('Partie introuvable')
  })

  it('chaque message d’erreur a une traduction anglaise', () => {
    const missing = ALL.filter((message) => translateGameError(message, en) === message)
    expect(missing).toEqual([])
  })

  it('le français reste identique', () => {
    for (const message of ALL) expect(translateGameError(message, fr)).toBe(message)
  })

  it('exemples en anglais', () => {
    expect(translateGameError('Carte introuvable', en)).toBe('Card not found')
    expect(translateGameError("Ce n'est pas ton tour", en)).toBe("It's not your turn")
    expect(translateGameError('Seul l’hôte peut éliminer un autre joueur', en)).toBe('Only the host can eliminate another player')
  })

  it('message à valeur', () => {
    expect(translateGameError('Action invalide : count', en)).toBe('Invalid action: count')
    expect(translateGameError('Action invalide : count', fr)).toBe('Action invalide : count')
  })

  it('messages de la connexion au serveur de jeu', () => {
    for (const message of Object.values(SOCKET_MSG)) {
      expect(translateGameError(message, fr)).toBe(message)
      expect(translateGameError(message, en)).not.toBe(message)
    }
    expect(translateGameError(SOCKET_MSG.gone, en)).toBe('This game no longer exists')
  })

  it('message inconnu rendu tel quel', () => {
    expect(translateGameError('Erreur jamais vue', en)).toBe('Erreur jamais vue')
    expect(translateGameError('', en)).toBe('')
  })
})
