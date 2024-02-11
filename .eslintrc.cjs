module.exports = {
  settings: {
    react: {
      version: '16',
    },
  },
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    node: true,
  },
  extends: ['plugin:react/recommended', 'prettier', 'google'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    babelOptions: {
      presets: ['@babel/preset-react'],
    },
    ecmaVersion: 2020,
    sourceType: 'module',
    requireConfigFile: false,
  },
  plugins: ['@typescript-eslint', 'prettier', 'react'],
  rules: {
    'prettier/prettier': ['error', { singleQuote: true }],
    'object-curly-spacing': ['error', 'always'],
    'space-before-function-paren': 'off',
    'operator-linebreak': 'off',
    'quote-props': [
      'error',
      'as-needed',
      { keywords: false, unnecessary: true, numbers: false },
    ],
    indent: 'off',
  },
  ignorePatterns: ['build/'],
};
