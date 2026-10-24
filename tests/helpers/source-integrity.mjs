import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const fallbackMirror = fileURLToPath(new URL('../../../../src-mirror/', import.meta.url));
const fallbackApi = fileURLToPath(new URL('../../../../src-api/', import.meta.url));
const allowed = new Set([
  'src-mirror/src/ziwei-calc.js', 'src-mirror/src/crosssihua.js',
  'src-mirror/src/bazi-calc.js', 'src-mirror/src/finance-calc.js',
  'src-api/calc-daily.mjs',
]);

export function sourceUrl(relativePath) {
  if (!allowed.has(relativePath)) throw new Error('Source path is outside the calculation allowlist');
  const isMirror = relativePath.startsWith('src-mirror/');
  const root = resolve(isMirror ? (process.env.DT_SRC_MIRROR || fallbackMirror) : (process.env.DT_SRC_API || fallbackApi));
  const relative = relativePath.slice(relativePath.indexOf('/') + 1);
  const path = resolve(root, relative);
  if (!path.startsWith(root + sep)) throw new Error('Invalid source path');
  return pathToFileURL(path);
}

function readSourceBytes(relativePath) {
  try { return readFileSync(sourceUrl(relativePath)); }
  catch (error) { throw new Error(`Direct originals are required: ${relativePath} (${error.code || error.message})`); }
}

export function readSource(relativePath) {
  return readSourceBytes(relativePath).toString('utf8');
}

export function sourceHashes() {
  return [...allowed].map(path => ({path, sha256: createHash('sha256').update(readSourceBytes(path)).digest('hex')}));
}

export function expectedHashes() {
  return JSON.parse(readFileSync(new URL('../fixtures/source-manifest.json', import.meta.url), 'utf8'));
}
