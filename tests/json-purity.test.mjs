import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertJsonData, createJsonEnvelope, normalizeBirthInput, normalizeDate, birthFromParts } from '../src/json-envelope.js';
import { calculateBaziJson } from '../src/bazi.js';
import { calculateFinanceJson } from '../src/finance.js';
import { calculateDailyJson } from '../src/daily.js';
import { sourceUrl } from './helpers/source-integrity.mjs';
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/synthetic-births.json', import.meta.url), 'utf8'));

test('common birth contract normalizes only supported data and real calendar dates', () => {
  const birth = {birthDate: '2001-03-07', hour: 6, gender: '女'};
  assert.deepEqual(normalizeBirthInput(birth), {...birth, minute: 0});
  assert.deepEqual(birthFromParts(2001, 3, 7, 6, '女', 10), {...birth, minute: 10});
  assert.equal(normalizeDate('2000-02-29'), '2000-02-29');
  assert.equal(normalizeDate('2026-2-1', {allowUnpadded: true}), '2026-02-01');
  for (const value of ['1900-02-29','2025-02-29','2026-04-31','2026-00-01','0000-01-01','2026-10-00','2026-2-1','2026-10-24T12:00:00Z',new Date(),null]) {
    assert.throws(() => normalizeDate(value));
  }
  for (const change of [
    {hour: 24}, {hour: -1}, {hour: 1.5}, {hour: '6'}, {minute: 60}, {minute: -1},
    {minute: '10'}, {gender: 'other'}, {timeZone: 'UTC'}, {utcOffset: 8}, {second: 10},
  ]) assert.throws(() => normalizeBirthInput({...birth, ...change}));
  for (const input of [null, [], new Date(), Object.create(null)]) assert.throws(() => normalizeBirthInput(input));
  const accessor = {...birth};
  Object.defineProperty(accessor, 'minute', {enumerable: true, get() {throw new Error('must-not-run');}});
  assert.throws(() => normalizeBirthInput(accessor), /data properties/);
});

test('JSON validator rejects lossy, cyclic and nonplain values', () => {
  class ArraySubclass extends Array {}
  const values = [undefined, () => {}, NaN, Infinity, -Infinity, -0, 1n, Symbol('x'), new Date(), new Map(), new Set(), /x/, new (class Chart {})(), Object.create(null), new ArraySubclass(1)];
  for (const value of values) assert.throws(() => assertJsonData({value}));
  const cycle = {}; cycle.self = cycle;
  assert.throws(() => assertJsonData(cycle));
  assert.throws(() => assertJsonData([, 1]));
  const extra = [1]; extra.label = 'extra';
  assert.throws(() => assertJsonData(extra));
  assert.throws(() => assertJsonData({[Symbol('x')]: 1}));
  assert.throws(() => assertJsonData(Object.defineProperty({}, 'hidden', {value: 1})));
  assert.throws(() => assertJsonData({get value() {return 1;}}));
  assert.doesNotThrow(() => assertJsonData({value: [null, true, false, 1, '木', {nested: []}]}));
});

test('envelope is a detached lossless structure with fixed schema and northern config', () => {
  const input = {birthDate: '2001-03-07', hour: 6, minute: 0, gender: '女'};
  const data = {values: [1, 2, 3]};
  const envelope = createJsonEnvelope('test.structure', input, data);
  assert.deepEqual(Object.keys(envelope), ['schema','kind','input','referenceDate','config','data','omitted','limitations']);
  assert.equal(envelope.schema, 'destiny-telling.calc/v1');
  assert.deepEqual(envelope.config, {school: 'north', gengMutagens: ['太陽','武曲','天同','天相']});
  assert.equal(envelope.referenceDate, null);
  assert.deepEqual(envelope.omitted, []);
  assert.deepEqual(envelope.limitations, []);
  assert.deepEqual(JSON.parse(JSON.stringify(envelope)), envelope);
  data.values.push(4); input.hour = 7; envelope.config.gengMutagens[0] = 'changed';
  assert.deepEqual(envelope.data.values, [1, 2, 3]);
  assert.equal(envelope.input.hour, 6);
  assert.equal(createJsonEnvelope('test.structure', {}, {}).config.gengMutagens[0], '太陽');
  assert.throws(() => createJsonEnvelope('', {}, {}));
  assert.throws(() => createJsonEnvelope('test.structure', {}, {bad: undefined}));
  assert.throws(() => createJsonEnvelope('test.structure', {}, {}, {omitted: [1]}));
  assert.throws(() => createJsonEnvelope('test.structure', {}, {}, {referenceDate: '2026-02-29'}));
});

for (const {id, ...birth} of fixtures) {
  test(`all public JSON calculators are pure round-trippable values ${id}`, () => {
    const before = structuredClone(birth);
    const NativeDate = globalThis.Date;
    for (const output of [calculateBaziJson(birth), calculateFinanceJson({...birth, referenceDate: '2026-10-24'}), calculateDailyJson({...birth, targetDate: '2026-10-24'})]) {
      assert.doesNotThrow(() => assertJsonData(output));
      assert.deepEqual(JSON.parse(JSON.stringify(output)), output);
      assert.equal(Object.getPrototypeOf(output), Object.prototype);
    }
    assert.equal(globalThis.Date, NativeDate);
    assert.deepEqual(birth, before);
  });
}

test('source locator rejects any unlisted source path', () => {
  assert.throws(() => sourceUrl('../not-allowed.js'), /allowlist/);
  assert.throws(() => sourceUrl('src-mirror/src/other.js'), /allowlist/);
});
