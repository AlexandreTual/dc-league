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
    // `npm run test:coverage` : couverture des fichiers .ts (les .tsx ne sont pas mesurés), seuil minimal sur lib/.
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'app/**/*.ts', 'components/**/*.ts', 'workers/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
      reporter: ['text-summary', 'text'],
      thresholds: { 'lib/**/*.ts': { lines: 90, statements: 90, functions: 90, branches: 85 } },
    },
  },
  // tsconfig garde le JSX tel quel pour Next.js : les tests qui rendent un composant le compilent ici.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: { '@': path.dirname(fileURLToPath(import.meta.url)) },
  },
})
