export default {
  arrowParens: 'avoid',
  bracketSameLine: true,
  endOfLine: 'lf',
  printWidth: 140,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'none',
  plugins: ['@trivago/prettier-plugin-sort-imports'],
  importOrder: ['^node:', '<THIRD_PARTY_MODULES>', '^@job-agent/(.*)$', '^[./]'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderParserPlugins: ['typescript', 'decorators-legacy']
};
