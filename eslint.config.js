import * as config from '@lvce-editor/eslint-config'
import * as actions from '@lvce-editor/eslint-plugin-github-actions'

export default [
  ...config.default,
  ...actions.default,
  {
    ignores: ['packages/app'],
  },
  {
    rules: {
      '@typescript-eslint/prefer-readonly-parameter-types': 'off',
      'unicorn/consistent-function-scoping': 'off',
      'github-actions/ci-versions': 'off',
    },
  },
]
