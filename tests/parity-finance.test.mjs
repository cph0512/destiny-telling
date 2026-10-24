import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { astro } from 'iztro';
import { calculateFinance, calculateFinanceJson } from '../src/finance.js';
import { installSourceHooks } from './helpers/source-hooks.mjs';
import { sourceUrl } from './helpers/source-integrity.mjs';
import { REFERENCE_DATES, withFixedClock } from './helpers/fixed-clock.mjs';
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/synthetic-births.json', import.meta.url), 'utf8'));
const hook = installSourceHooks();
const original = await import(sourceUrl('src-mirror/src/finance-calc.js'));
hook.deregister();
astro.config({ mutagens: { '庚': ['太阳', '武曲', '天同', '天相'] } });

for (const {id, ...birth} of fixtures) {
  for (const referenceDate of REFERENCE_DATES) {
    test(`finance direct-original full deepEqual ${id} ${referenceDate}`, () => {
      const args = [...birth.birthDate.split('-').map(Number), birth.hour, birth.gender];
      const NativeDate = globalThis.Date;
      const expected = withFixedClock(referenceDate, () => {
        const result = original.calculateFinance(...args);
        assert.deepEqual(calculateFinance(...args), result);
        return result;
      });
      assert.equal(globalThis.Date, NativeDate);
      assert.deepEqual(calculateFinance(...args, {referenceDate}), expected);
      const envelope = calculateFinanceJson({...birth, referenceDate});
      assert.equal(envelope.referenceDate, referenceDate);
      assert.deepEqual(envelope.data, expected);
    });
  }
}

test('fixed test clock restores after exceptions', () => {
  const NativeDate = globalThis.Date;
  assert.throws(() => withFixedClock(REFERENCE_DATES[0], () => { throw new Error('clock-test'); }), /clock-test/);
  assert.equal(globalThis.Date, NativeDate);
});
