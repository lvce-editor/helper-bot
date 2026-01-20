import * as config from '@lvce-editor/eslint-config'
import * as actions from '@lvce-editor/eslint-plugin-github-actions'
import tseslint from 'typescript-eslint'

export default [
  ...config.default,
  ...actions.default,
  {
    ignores: ['packages/app'],
  },
  ...tseslint.config({
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/prefer-readonly-parameter-types': [
        'error',
        {
          ignoreInferredTypes: true,
          treatMethodsAsReadonly: true,
        },
      ],
    },
  }),
]
