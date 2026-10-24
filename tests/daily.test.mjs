import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDaily, calculateDailyJson } from '../src/daily.js';

test('daily tracer returns neutral relation fields without calendar activity lists', () => {
  const data = calculateDaily({birth_date: '2001-03-07', birth_hour: 6, gender: '女', target_date: '2026-10-24'});
  assert.equal(data.target_date, '2026-10-24');
  assert.equal(typeof data.bazi.interaction.relationCode, 'string');
  assert.equal(Object.hasOwn(data.bazi.interaction, 'relation'), false);
  assert.equal(Object.hasOwn(data.bazi.daily, 'dayYi'), false);
  assert.equal(Object.hasOwn(data.bazi.daily, 'dayJi'), false);
});

test('daily raw defaults stay hour twelve and male', () => {
  const input = {birth_date: '2001-3-7', target_date: '2026-10-24'};
  const raw = calculateDaily(input);
  assert.deepEqual(raw, calculateDaily({...input, birth_hour: 12, gender: '男'}));
  assert.equal(raw.birth_date, input.birth_date);
});

test('daily JSON records the target date and explicitly declares zero-minute calculation', () => {
  const birth = {birthDate: '2001-03-07', hour: 6, minute: 10, gender: '女', targetDate: '2026-10-24'};
  const json = calculateDailyJson(birth);
  assert.equal(json.kind, 'daily.chart');
  assert.equal(json.referenceDate, birth.targetDate);
  assert.deepEqual(json.input, birth);
  assert.ok(json.limitations.includes('UPSTREAM_DAILY_BIRTH_MINUTE_ZERO'));
  assert.deepEqual(json.data, calculateDailyJson({...birth, minute: 0}).data);
  assert.deepEqual(json.omitted, ['bazi.daily.dayYi','bazi.daily.dayJi','bazi.interaction.relation']);
  assert.deepEqual(JSON.parse(JSON.stringify(json)), json);
});

test('daily rejects impossible dates and unsupported fields without coercion', () => {
  const input = {birth_date: '2001-03-07', birth_hour: 6, gender: '女', target_date: '2026-10-24'};
  for (const change of [
    {birth_date: '2001-02-29'}, {target_date: '2026-04-31'}, {birth_hour: -1},
    {birth_hour: 24}, {birth_hour: '6'}, {gender: 'other'}, {birth_minute: 10},
  ]) assert.throws(() => calculateDaily({...input, ...change}));
  assert.throws(() => calculateDaily(null));
  assert.throws(() => calculateDailyJson({birthDate: input.birth_date, hour: 6, gender: '女'}));
  assert.throws(() => calculateDailyJson({birthDate: input.birth_date, hour: 6, gender: '女', targetDate: '2026-2-1'}));
});
