import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { calculateDaily, calculateDailyJson } from '../src/daily.js';
import { sourceUrl, sourceHashes, expectedHashes } from './helpers/source-integrity.mjs';
import { REFERENCE_DATES } from './helpers/fixed-clock.mjs';
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/synthetic-births.json', import.meta.url), 'utf8'));
const seen = new Set();

function runOriginal(input) {
  const child = spawnSync(process.execPath, [
    '--import', fileURLToPath(new URL('./helpers/source-hooks.mjs', import.meta.url)),
    fileURLToPath(sourceUrl('src-api/calc-daily.mjs')), JSON.stringify(input),
  ], {cwd: new URL('../', import.meta.url), encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024});
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stderr, '');
  return JSON.parse(child.stdout);
}

function projectOriginal(original) {
  const projected = structuredClone(original);
  delete projected.bazi.daily.dayYi;
  delete projected.bazi.daily.dayJi;
  const {relation, ...structural} = projected.bazi.interaction;
  assert.equal(typeof relation, 'string');
  const stems = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const elements = ['木','木','火','火','土','土','金','金','水','水'];
  const n = stems.indexOf(structural.natalDayStem), d = stems.indexOf(structural.dailyStem);
  const sheng = {'木':'火','火':'土','土':'金','金':'水','水':'木'};
  const ke = {'木':'土','土':'水','水':'火','火':'金','金':'木'};
  let relationCode = 'UNKNOWN', relationTerm = '未知';
  if (n >= 0 && d >= 0) {
    const a = elements[n], b = elements[d];
    assert.equal(structural.natalElement, a);
    assert.equal(structural.dailyElement, b);
    if (a === b) { relationCode = 'SAME'; relationTerm = '比和'; }
    else if (sheng[a] === b) { relationCode = 'NATAL_GENERATES_DAILY'; relationTerm = '我生'; }
    else if (sheng[b] === a) { relationCode = 'DAILY_GENERATES_NATAL'; relationTerm = '生我'; }
    else if (ke[a] === b) { relationCode = 'NATAL_CONTROLS_DAILY'; relationTerm = '我剋'; }
    else if (ke[b] === a) { relationCode = 'DAILY_CONTROLS_NATAL'; relationTerm = '剋我'; }
  }
  projected.bazi.interaction = {...structural, relationCode, relationTerm};
  seen.add(relationCode);
  return projected;
}

assert.deepEqual(sourceHashes(), expectedHashes());
for (const {id, ...birth} of fixtures) {
  for (const targetDate of REFERENCE_DATES) {
    test(`daily real-original CLI narrow projection ${id} ${targetDate}`, () => {
      const input = {birth_date: birth.birthDate, birth_hour: birth.hour, gender: birth.gender, target_date: targetDate};
      const expected = projectOriginal(runOriginal(input));
      assert.deepEqual(calculateDaily(input), expected);
      assert.deepEqual(calculateDailyJson({...birth, targetDate}).data, expected);
    });
  }
}

test('daily defaults and unpadded raw dates retain original stdout fields', () => {
  const input = {birth_date: '2001-3-7', target_date: '2026-10-24'};
  assert.deepEqual(calculateDaily(input), projectOriginal(runOriginal(input)));
});

test('daily matrix exercises all five reachable relation branches', () => {
  assert.deepEqual([...seen].sort(), ['SAME','NATAL_GENERATES_DAILY','DAILY_GENERATES_NATAL','NATAL_CONTROLS_DAILY','DAILY_CONTROLS_NATAL'].sort());
  assert.deepEqual(sourceHashes(), expectedHashes());
});
