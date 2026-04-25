import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  // Firebase isolation: only src/infra, src/services, src/data may import firebase/*.
  // Every other layer goes through a service or repo. See root CLAUDE.md.
  {
    files: [
      'src/app/**/*.{ts,tsx}',
      'src/hooks/**/*.{ts,tsx}',
      'src/screens/**/*.{ts,tsx}',
      'src/components/**/*.{ts,tsx}',
      'src/modals/**/*.{ts,tsx}',
      'src/overlays/**/*.{ts,tsx}',
      'src/exercises/**/*.{ts,tsx}',
      'src/workers/**/*.{ts,tsx}',
      'src/domain/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['firebase', 'firebase/*'],
          message: 'Firebase imports are restricted to src/infra, src/services, and src/data. Go through a service (writes) or repo (reads).',
        }],
      }],
    },
  },
])
