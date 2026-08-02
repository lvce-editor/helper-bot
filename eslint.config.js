import { defineConfig } from 'eslint/config'
import * as config from '@lvce-editor/eslint-config'
import * as tsconfig from '@lvce-editor/eslint-plugin-tsconfig'

export default defineConfig([
  ...config.default,
  ...config.recommendedActions,
  ...tsconfig.default,
  {
    ignores: ['packages/app'],
  },
  {
    files: ['.github/**/*.yml', '.github/**/*.yaml'],
    rules: {
      'github-actions/action-versions': 'off',
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/prefer-readonly-parameter-types': 'off',
      '@cspell/spellchecker': 'off',
    },
  },
])
