export default {
  '*.{js,mjs,cjs,ts,mts,tsx}': ['eslint --max-warnings=10 --no-warn-ignored', 'prettier --write'],
  '*.{json,yml,yaml}': 'prettier --write',
  '*.{ts,mts,tsx}': () => 'pnpm typecheck'
};
