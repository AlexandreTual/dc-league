import { describe, it, expect } from 'vitest'
import { answerBlocks, inlineParts } from './format'

describe('mise en forme des réponses (texte brut, jamais de HTML)', () => {
  it('découpe paragraphes et listes', () => {
    expect(answerBlocks('Bonjour.\n\n- un\n* deux\n1. trois\nFin')).toEqual([
      { kind: 'paragraph', text: 'Bonjour.' },
      { kind: 'list', items: ['un', 'deux', 'trois'] },
      { kind: 'paragraph', text: 'Fin' },
    ])
  })

  it('traite un titre markdown comme un paragraphe en gras', () => {
    expect(answerBlocks('## Résolution\nTexte')).toEqual([
      { kind: 'heading', text: 'Résolution' },
      { kind: 'paragraph', text: 'Texte' },
    ])
  })

  it('repère le gras sans interpréter de balise', () => {
    expect(inlineParts('Avec **Teferi** en jeu <b>x</b>')).toEqual([
      { bold: false, text: 'Avec ' },
      { bold: true, text: 'Teferi' },
      { bold: false, text: ' en jeu <b>x</b>' },
    ])
  })
})
