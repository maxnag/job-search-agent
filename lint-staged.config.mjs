export default {
  '*.{js,mjs,cjs,ts,mts}': ['eslint --max-warnings=10 --no-warn-ignored', 'prettier --write'],
  '*.{json,yml,yaml}': 'prettier --write',
  '*.{ts,mts}': () => 'pnpm typecheck'
};
