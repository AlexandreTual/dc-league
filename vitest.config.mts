import { configDefaults, defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    // Motifs valables à toute profondeur : en local, les worktrees (.claude/,
    // .worktrees/) et leurs node_modules ne doivent pas être collectés.
    exclude: [...configDefaults.exclude, '**/.next/**', '**/.vercel/**', '**/.wrangler/**', '.claude/**', '.worktrees/**'],
  },
  resolve: {
    alias: { '@': path.dirname(fileURLToPath(import.meta.url)) },
  },
})
