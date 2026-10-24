import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceHashes, expectedHashes } from './helpers/source-integrity.mjs';

test('all five exact original source bytes match before and after calculation imports', async t => {
  const before = sourceHashes();
  const manifest = expectedHashes();
  assert.equal(manifest.length, 5);
  assert.equal(new Set(manifest.map(item => item.path)).size, 5);
  for (const entry of manifest) {
    assert.deepEqual(Object.keys(entry).sort(), ['path', 'sha256']);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  }
  assert.deepEqual(before, manifest);
  const { installSourceHooks } = await import('./helpers/source-hooks.mjs');
  const { sourceUrl } = await import('./helpers/source-integrity.mjs');
  const hook = installSourceHooks();
  try {
    const bazi = await import(sourceUrl('src-mirror/src/bazi-calc.js'));
    const finance = await import(sourceUrl('src-mirror/src/finance-calc.js'));
    await import('../src/iztro-north.js');
    bazi.calculateBazi(2001, 3, 7, 6, '女', 10);
    finance.calculateFinance(2001, 3, 7, 6, '女');
  } finally { hook.deregister(); }
  const after = sourceHashes();
  assert.deepEqual(after, before);
  t.diagnostic(JSON.stringify({before, after}));
});
