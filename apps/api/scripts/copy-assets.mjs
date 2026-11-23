import { cpSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

cpSync(resolve(root, 'src'), resolve(root, 'dist'), {
  recursive: true,
  filter: source => statSync(source).isDirectory() || source.endsWith('.md')
});
