import { describe, it, expect } from 'vitest'
import { isTypingTarget, shortcutFor } from './keyboard'

const el = (tagName: string, extra: Record<string, unknown> = {}) => ({ tagName, isContentEditable: false, ...extra }) as unknown as EventTarget
const key = (k: string, mods: { ctrlKey?: boolean; metaKey?: boolean } = {}, target: EventTarget | null = el('BODY')) => ({
  key: k, ctrlKey: !!mods.ctrlKey, metaKey: !!mods.metaKey, target,
})

describe('shortcutFor', () => {
  it.each([
    ['d', 'draw'], ['D', 'draw'], ['u', 'untapAll'], ['n', 'nextTurn'], ['s', 'shuffle'], ['m', 'mulligan'], ['Escape', 'close'],
  ])('%s → %s', (k, expected) => {
    expect(shortcutFor(key(k))).toBe(expected)
  })

  it('Ctrl+Z et Cmd+Z annulent', () => {
    expect(shortcutFor(key('z', { ctrlKey: true }))).toBe('undo')
    expect(shortcutFor(key('Z', { metaKey: true }))).toBe('undo')
  })

  it('z seul et les autres touches ne font rien', () => {
    expect(shortcutFor(key('z'))).toBeNull()
    expect(shortcutFor(key('x'))).toBeNull()
  })

  it('ignore les lettres avec Ctrl ou Cmd (raccourcis du navigateur)', () => {
    expect(shortcutFor(key('d', { ctrlKey: true }))).toBeNull()
    expect(shortcutFor(key('s', { metaKey: true }))).toBeNull()
  })

  it('ne réagit pas pendant la saisie, sauf Échap', () => {
    expect(shortcutFor(key('d', {}, el('INPUT')))).toBeNull()
    expect(shortcutFor(key('z', { ctrlKey: true }, el('TEXTAREA')))).toBeNull()
    expect(shortcutFor(key('Escape', {}, el('INPUT')))).toBe('close')
  })
})

describe('isTypingTarget', () => {
  it.each(['INPUT', 'TEXTAREA', 'SELECT'])('%s est une zone de saisie', (tag) => {
    expect(isTypingTarget(el(tag))).toBe(true)
  })
  it('contenteditable est une zone de saisie', () => {
    expect(isTypingTarget(el('DIV', { isContentEditable: true }))).toBe(true)
  })
  it('un bouton ou rien ne l’est pas', () => {
    expect(isTypingTarget(el('BUTTON'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})
