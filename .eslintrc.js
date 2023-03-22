module.exports = {
  extends: [
    'prettier',
    'plugin:prettier/recommended',
    'plugin:@typescript-eslint/recommended',
    'eslint:recommended',
  ],
  plugins: [],
  parserOptions: {
    ecmaVersion: 2018,
  },
  rules: {
    '@typescript-eslint/ban-ts-comment': 'off',
    'no-unused-vars': 'off',
    'no-console': 'off',
    'class-methods-use-this': 'error',
  },
  env: {
    jest: true,
    node: true,
    es6: true,
  },
  ignorePatterns: ['lib/**/*', 'node_modules'],
};
