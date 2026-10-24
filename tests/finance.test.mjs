import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFinance, calculateFinanceJson, formatFinance } from '../src/finance.js';
import { withFixedClock } from './helpers/fixed-clock.mjs';

test('finance tracer imports independently and returns twelve months', () => {
  const chart = calculateFinance(1990, 11, 2, 21, '男', { referenceDate: '2026-10-24' });
  assert.equal(chart.months.length, 12);
  assert.equal(chart.basic.yearSihua['天相'], '忌');
});

test('finance JSON declares hour precision and preserves normalized reference date', () => {
  const birth = {birthDate: '2001-03-07', hour: 6, minute: 10, gender: '女'};
  const NativeDate = globalThis.Date;
  const json = calculateFinanceJson({...birth, referenceDate: '2026-10-24'});
  assert.equal(globalThis.Date, NativeDate);
  assert.equal(json.kind, 'finance.chart');
  assert.deepEqual(json.input, birth);
  assert.equal(json.referenceDate, '2026-10-24');
  assert.ok(json.limitations.includes('UPSTREAM_FINANCE_HOUR_PRECISION_MINUTE_NOT_APPLIED'));
  assert.deepEqual(json.data, calculateFinanceJson({...birth, minute: 0, referenceDate: '2026-10-24'}).data);
  assert.deepEqual(json.data.months.map(item => item.month), [1,2,3,4,5,6,7,8,9,10,11,12]);
  const formatted = formatFinance(json.data);
  assert.ok(formatted.includes(json.data.yearly.ganZhi));
  assert.ok(formatted.includes('12 個月'));
});

test('finance default clock reports the actual local reference day', () => {
  const NativeDate = globalThis.Date;
  withFixedClock('2025-12-31', () => {
    const json = calculateFinanceJson({birthDate: '2001-03-07', hour: 6, gender: '女'});
    assert.equal(json.referenceDate, '2025-12-31');
    assert.deepEqual(json.data, calculateFinance(2001, 3, 7, 6, '女', {referenceDate: '2025-12-31'}));
  });
  assert.equal(globalThis.Date, NativeDate);
});

test('finance rejects invalid dates, times and unsupported temporal options', () => {
  const birth = {birthDate: '2001-03-07', hour: 6, gender: '女'};
  for (const referenceDate of ['2026-02-29','2026-13-01','2026-1-01', null]) {
    assert.throws(() => calculateFinanceJson({...birth, referenceDate}));
  }
  assert.throws(() => calculateFinance(2001, 2, 29, 6, '女'), /calendar/);
  assert.throws(() => calculateFinance(2001, 3, 7, 6.5, '女'), /hour/);
  assert.throws(() => calculateFinance(2001, 3, 7, 6, 'other'), /gender/);
  assert.throws(() => calculateFinance(2001, 3, 7, 6, '女', {targetYear: 2027}), /Unsupported/);
  assert.throws(() => calculateFinanceJson({...birth, timeZone: 'UTC'}), /Unsupported/);
});
