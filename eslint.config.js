const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const hooks = require('eslint-plugin-react-hooks')

module.exports = [
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } } },
    plugins: { '@typescript-eslint': tsPlugin, 'react-hooks': hooks },
    rules: { ...tsPlugin.configs.recommended.rules, ...hooks.configs.recommended.rules, '@typescript-eslint/no-empty-object-type': 'off' }
  }
]
