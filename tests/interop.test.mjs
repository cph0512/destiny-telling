import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sourceHashes, expectedHashes } from './helpers/source-integrity.mjs';

test('native direct-original import tracer', t => {
  const hashes = sourceHashes();
  assert.deepEqual(hashes, expectedHashes());
  t.diagnostic(JSON.stringify({stage: 'before', hashes}));
  const child = spawnSync(process.execPath, [fileURLToPath(new URL('./helpers/source-hooks.mjs', import.meta.url)), '--probe-native'], {
    cwd: new URL('../', import.meta.url), encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, '');
  assert.equal(child.stderr, '');
});

function probe(mode) {
  const child = spawnSync(process.execPath, [fileURLToPath(new URL('./helpers/source-hooks.mjs', import.meta.url)), mode], {
    cwd: new URL('../', import.meta.url), input: 'not-json-stdin', encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stderr, '');
  return child.stdout;
}

test('finance standalone fresh process applies north override without ziwei module', () => {
  assert.deepEqual(JSON.parse(probe('--probe-finance')), {'太陽':'祿','武曲':'權','天同':'科','天相':'忌'});
});

test('daily module import has no stdout, stdin parsing or exit side effects', () => {
  assert.equal(probe('--probe-daily-import'), '');
});

test('fresh-process JSON calculation stdout is exactly one lossless JSON value', () => {
  const stdout = probe('--probe-json');
  const envelopes = JSON.parse(stdout);
  assert.deepEqual(envelopes.map(item => item.kind), ['bazi.chart','finance.chart','daily.chart']);
  assert.equal(JSON.stringify(envelopes), stdout);
});
