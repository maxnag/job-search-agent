import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, statSync, watch } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceDir = resolve(root, 'src');
const outDir = resolve(root, 'dist');
const ASSET_EXTENSION = '.md';

/**
 * Copy every asset of `src` into `dist`, keeping the folders
 *
 * @returns {void}
 */
function copyAll() {
  cpSync(sourceDir, outDir, {
    recursive: true,
    filter: source => statSync(source).isDirectory() || source.endsWith(ASSET_EXTENSION)
  });
}

/**
 * Mirror one changed asset: copy it when it exists, remove its copy when it was deleted
 *
 * @param {string} file Path relative to `src`
 *
 * @returns {void}
 */
function syncAsset(file) {
  const source = resolve(sourceDir, file);
  const target = resolve(outDir, file);

  if (existsSync(source)) {
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
    process.stdout.write(`assets: copied ${file}\n`);

    return;
  }

  rmSync(target, { force: true });
  process.stdout.write(`assets: removed ${file}\n`);
}

copyAll();

if (process.argv.includes('--watch')) {
  watch(sourceDir, { recursive: true }, (_event, file) => {
    if (file?.endsWith(ASSET_EXTENSION)) {
      syncAsset(file);
    }
  });
  process.stdout.write(`assets: watching ${ASSET_EXTENSION} files in src\n`);
}
