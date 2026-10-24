import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSource, expectedHashes } from './source-integrity.mjs';

export function forbiddenProse() {
  const found = new Set();
  const add = value => { if (value.trim().length >= 2) found.add(value.trim()); };
  for (const {path} of expectedHashes()) {
    const text = readSource(path);
    for (const match of text.matchAll(/\bimpact\s*:\s*(['"`])([\s\S]*?)\1/g)) {
      for (const part of match[2].split(/\$\{[^}]*\}/)) add(part);
    }
    for (const match of text.matchAll(/\brelation\s*=\s*(['"])(.*?)\1/g)) {
      if (!match[2].includes('（')) continue;
      add(match[2]);
      for (const inner of match[2].matchAll(/（([^）]+)）/g)) add(inner[1]);
    }
    for (const match of text.matchAll(/### 重點宮位[^\n]*?（([^）]+)）/g)) add(match[1]);
    for (const match of text.matchAll(/\bdetail\s*:\s*(['"])([\u3400-\u9fff]{5,})\1/g)) add(match[2]);
  }
  if (found.size === 0) throw new Error('No original prose was inspected');
  return [...found];
}

export function proseMatches(text, forbidden = forbiddenProse()) {
  return forbidden.filter(value => text.includes(value));
}

export function scanCandidateFiles(root = fileURLToPath(new URL('../../', import.meta.url))) {
  root = resolve(root);
  const extensions = new Set(['.js','.mjs','.cjs','.ts','.json','.md','.txt','.yaml','.yml']);
  const inspected = [], matches = [];
  const forbidden = forbiddenProse();
  function walk(directory) {
    for (const item of readdirSync(directory, {withFileTypes: true})) {
      if (item.name === 'node_modules' || item.name === '.git') continue;
      if (item.name === '.env' || item.name.startsWith('.env.')) throw new Error('Environment files are not calculation candidates');
      if (item.isSymbolicLink()) throw new Error('Candidate scan does not follow symbolic links');
      const path = resolve(directory, item.name);
      if (item.isDirectory()) { walk(path); continue; }
      if (!item.isFile() || (!extensions.has(extname(item.name)) && !['.gitignore','LICENSE','NOTICE'].includes(item.name))) continue;
      const file = relative(root, path).replaceAll('\\', '/');
      inspected.push(file);
      const hits = proseMatches(readFileSync(path, 'utf8'), forbidden);
      if (hits.length) matches.push({file, count: hits.length});
    }
  }
  walk(root);
  if (inspected.length === 0) throw new Error('Candidate scan inspected no files');
  return {inspected: inspected.sort(), matches, forbiddenCount: forbidden.length};
}
