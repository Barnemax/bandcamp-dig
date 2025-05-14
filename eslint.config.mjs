// eslint.config.mjs
import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'no-alert': 'off',
    'no-restricted-globals': 'off',
    '@typescript-eslint/explicit-function-return-type': 'error',
    'curly': ['error', 'all'],
    'style/padding-line-between-statements': [
      'error',
      { blankLine: 'always', prev: '*', next: 'return' },
      { blankLine: 'any', prev: ['block-like', 'expression'], next: 'return' },
    ],
  },
}, {
  files: ['src/**'],
  rules: {
    'unicorn/filename-case': ['error', { case: 'camelCase' }],
  },
})
