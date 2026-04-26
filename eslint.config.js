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
  // Every other layer (including src/main.tsx, src/sw.ts at the root) goes through
  // a service or repo. See root CLAUDE.md.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/infra/**',
      'src/services/**',
      'src/data/**',
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
  // Storage isolation: only src/infra/storage.ts may touch window.localStorage.
  // Every other layer (services included) goes through @infra/storage's typed API.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/infra/**'],
    rules: {
      'no-restricted-globals': ['error', {
        name: 'localStorage',
        message: 'localStorage access is restricted to src/infra/storage.ts. Import { read, write, remove, STORAGE_KEYS } from "@infra/storage" instead.',
      }],
    },
  },
])
