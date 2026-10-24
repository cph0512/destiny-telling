import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateBazi, calculateBaziJson, formatBazi, formatBaziCompact } from '../src/bazi.js';
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/synthetic-births.json', import.meta.url), 'utf8'));

test('bazi public tracer returns four pillars and eight counted elements', () => {
  const chart = calculateBazi(2001, 3, 7, 6, '女', 10);
  assert.equal(chart.solarDate, '2001年3月7日');
  assert.equal(Object.keys(chart.pillars).length, 4);
  assert.equal(Object.values(chart.wuXing).reduce((a, b) => a + b, 0), 8);
});

for (const {id, ...birth} of fixtures) {
  test(`bazi JSON and factual formatters ${id}`, () => {
    const args = [...birth.birthDate.split('-').map(Number), birth.hour, birth.gender, birth.minute];
    const raw = calculateBazi(...args);
    const json = calculateBaziJson(birth);
    assert.equal(json.kind, 'bazi.chart');
    assert.equal(json.referenceDate, null);
    assert.deepEqual(json.input, birth);
    assert.deepEqual(json.data, raw);
    assert.ok(formatBazi(raw).includes(raw.pillars.day.ganZhi));
    assert.ok(formatBaziCompact(raw).includes(raw.pillars.time.ganZhi));
    assert.deepEqual(JSON.parse(JSON.stringify(json)), json);
  });
}

test('bazi default minute is zero and invalid arguments are rejected', () => {
  assert.deepEqual(calculateBazi(2001, 3, 7, 6, '女'), calculateBazi(2001, 3, 7, 6, '女', 0));
  assert.throws(() => calculateBazi(2001, 2, 29, 6, '女'), /calendar/);
  assert.throws(() => calculateBazi(2001, 3, 7, 24, '女'), /hour/);
  assert.throws(() => calculateBazi(2001, 3, 7, 6, '女', 60), /minute/);
  assert.throws(() => calculateBazi(2001, 3, 7, 6, 'other'), /gender/);
  assert.throws(() => calculateBazi('2001', 3, 7, 6, '女'), /integers/);
});
