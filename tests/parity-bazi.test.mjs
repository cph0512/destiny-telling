import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateBazi, calculateBaziJson, formatBazi, formatBaziCompact } from '../src/bazi.js';
import { installSourceHooks } from './helpers/source-hooks.mjs';
import { sourceUrl } from './helpers/source-integrity.mjs';
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/synthetic-births.json', import.meta.url), 'utf8'));
const hook = installSourceHooks();
const original = await import(sourceUrl('src-mirror/src/bazi-calc.js'));
hook.deregister();

for (const {id, ...birth} of fixtures) {
  test(`bazi direct-original deepEqual ${id}`, () => {
    const args = [...birth.birthDate.split('-').map(Number), birth.hour, birth.gender, birth.minute];
    const expected = original.calculateBazi(...args);
    const actual = calculateBazi(...args);
    assert.deepEqual(actual, expected);
    assert.deepEqual(calculateBaziJson(birth).data, expected);
    assert.equal(formatBazi(actual), original.formatBazi(expected));
    assert.equal(formatBaziCompact(actual), original.formatBaziCompact(expected));
  });
}

test('bazi default minute and hour mapping preserve direct-original output', () => {
  for (const hour of [0, 1, 22, 23]) {
    assert.deepEqual(calculateBazi(2001, 3, 7, hour, '女'), original.calculateBazi(2001, 3, 7, hour, '女'));
  }
});
