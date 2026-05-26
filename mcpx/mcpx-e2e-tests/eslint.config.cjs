const path = require('path');
const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

const projectParserOptions = {
  project: [path.join(__dirname, 'tsconfig.json')],
  tsconfigRootDir: __dirname,
};

const tsRecommended = tseslint.configs['flat/recommended'].map((config) => {
  const entry = { ...config };

  entry.files = entry.files || ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];

  if (entry.languageOptions) {
    entry.languageOptions = { ...entry.languageOptions };
    entry.languageOptions.parser = tsParser;
    entry.languageOptions.parserOptions = {
      ...(entry.languageOptions.parserOptions || {}),
      ...projectParserOptions,
    };
  } else {
    entry.languageOptions = {
      parser: tsParser,
      parserOptions: projectParserOptions,
    };
  }

  entry.plugins = {
    ...(entry.plugins || {}),
    '@typescript-eslint': tseslint,
  };

  entry.rules = {
    ...(entry.rules || {}),
    'no-console': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  };

  return entry;
});

module.exports = [
  {
    ignores: [
      'node_modules',
      'dist',
      '.eslintrc.js',
      'local-tests/**',
      '*.js',
      '*.cjs',
      '*.mjs',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
    ],
  },
  js.configs.recommended,
  ...tsRecommended,
];
