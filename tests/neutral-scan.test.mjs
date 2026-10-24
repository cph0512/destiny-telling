import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateBazi, calculateBaziJson, formatBazi, formatBaziCompact } from '../src/bazi.js';
import { calculateFinance, calculateFinanceJson, formatFinance } from '../src/finance.js';
import { calculateDailyJson } from '../src/daily.js';
import { forbiddenProse, proseMatches, scanCandidateFiles } from './helpers/neutral-scan.mjs';
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/synthetic-births.json', import.meta.url), 'utf8'));

test('neutral scan covers actual on-disk candidates including untracked files', t => {
  const result = scanCandidateFiles();
  assert.ok(result.inspected.length > 0);
  for (const file of ['src/bazi.js','src/finance.js','src/daily.js','package.json','package-lock.json','tests/neutral-scan.test.mjs']) assert.ok(result.inspected.includes(file));
  assert.deepEqual(result.matches, []);
  t.diagnostic(JSON.stringify(result));
});

test('neutral scanner detects prose derived in memory from originals', () => {
  const forbidden = forbiddenProse();
  assert.ok(forbidden.length > 0);
  assert.ok(proseMatches(forbidden[0], forbidden).length > 0);
  assert.deepEqual(proseMatches('SAME NATAL_GENERATES_DAILY DAILY_GENERATES_NATAL NATAL_CONTROLS_DAILY DAILY_CONTROLS_NATAL UNKNOWN', forbidden), []);
});

test('all seven synthetic outputs and factual formatters exclude original prose', () => {
  const forbidden = forbiddenProse();
  for (const {id, ...birth} of fixtures) {
    const args = [...birth.birthDate.split('-').map(Number), birth.hour, birth.gender];
    const bazi = calculateBazi(...args, birth.minute);
    const finance = calculateFinance(...args, {referenceDate: '2026-10-24'});
    const outputs = [
      calculateBaziJson(birth), calculateFinanceJson({...birth, referenceDate: '2026-10-24'}),
      calculateDailyJson({...birth, targetDate: '2026-10-24'}),
      formatBazi(bazi), formatBaziCompact(bazi), formatFinance(finance),
    ];
    assert.deepEqual(proseMatches(JSON.stringify(outputs), forbidden), [], id);
    const daily = outputs[2].data;
    assert.equal(Object.hasOwn(daily.bazi.daily, 'dayYi'), false);
    assert.equal(Object.hasOwn(daily.bazi.daily, 'dayJi'), false);
    assert.equal(Object.hasOwn(daily.bazi.interaction, 'relation'), false);
    assert.deepEqual(Object.keys(daily.bazi.interaction).sort(), ['dailyElement','dailyStem','natalDayStem','natalElement','relationCode','relationTerm'].sort());
  }
});
