module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  plugins: ['react', 'react-hooks', '@typescript-eslint'],
  settings: {
    react: {
      version: '18.2',
    },
  },
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  ignorePatterns: ['dist'],
};
