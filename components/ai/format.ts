// Mise en forme des réponses de l'IA en blocs simples (paragraphes, listes, gras), sans jamais interpréter de HTML.

export type AnswerBlock = { kind: 'paragraph' | 'heading'; text: string } | { kind: 'list'; items: string[] }

const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/
const HEADING = /^\s*#{1,6}\s+(.*)$/

export function answerBlocks(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const item = LIST_ITEM.exec(line)
    const heading = HEADING.exec(line)
    const last = blocks[blocks.length - 1]
    if (item) {
      if (last?.kind === 'list') last.items.push(item[1])
      else blocks.push({ kind: 'list', items: [item[1]] })
    } else if (heading) {
      blocks.push({ kind: 'heading', text: heading[1] })
    } else {
      blocks.push({ kind: 'paragraph', text: line.trim() })
    }
  }
  return blocks
}

/** Morceaux de texte, en gras entre ** **. */
export function inlineParts(text: string): { bold: boolean; text: string }[] {
  return text
    .split(/\*\*(.+?)\*\*/g)
    .map((part, i) => ({ bold: i % 2 === 1, text: part }))
    .filter((p) => p.text)
}
