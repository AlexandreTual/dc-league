import { describe, it, expect } from 'vitest'
import { printedKeywords } from './keywords'

describe('printedKeywords', () => {
  it('capacités des lignes de mots-clés du texte, dans l’ordre de Scryfall', () => {
    expect(printedKeywords(['Flying', 'Vigilance'], 'Flying, vigilance')).toEqual(['Flying', 'Vigilance'])
    expect(printedKeywords(['Flying', 'Deathtouch'], 'Deathtouch\nFlying\nWhen this creature dies, draw a card.')).toEqual(['Flying', 'Deathtouch'])
  })

  it('texte de rappel et capacités à paramètre ignorés dans la ligne', () => {
    expect(printedKeywords(['Flying', 'Ward'], 'Flying (This creature can’t be blocked except by creatures with flying or reach.), ward {2}')).toEqual(['Flying', 'Ward'])
    expect(printedKeywords(['Flying', 'Protection'], 'Flying, protection from red')).toEqual(['Flying', 'Protection'])
    expect(printedKeywords(['Flying', 'Ward'], 'Flying\nWard—Pay 3 life.')).toEqual(['Flying', 'Ward'])
  })

  it('pas une capacité de la carte : mot cité dans une phrase, ou donné à d’autres', () => {
    expect(printedKeywords(['Flying'], 'Creatures you control have flying.')).toEqual([])
    expect(printedKeywords(['Reach'], 'This creature can block creatures with flying.\nReach')).toEqual(['Reach'])
    expect(printedKeywords(['Flying'], 'Flying creatures you control get +1/+1.')).toEqual([])
  })

  it('mot-clé absent de la liste de Scryfall, texte ou liste vide : rien', () => {
    expect(printedKeywords([], 'Flying')).toEqual([])
    expect(printedKeywords(['Flying'], null)).toEqual([])
    expect(printedKeywords(['Flying'], 'Haste')).toEqual([])
  })
})
