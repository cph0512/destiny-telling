import test from 'node:test';
import assert from 'node:assert/strict';
import fixtures from './fixtures/synthetic-births.json' with {type:'json'};
import * as root from '../index.js';
import * as z from '../src/ziwei.js';
const {id, ...birth} = fixtures[0];

test('root exports all completed raw and JSON calculators',t=>{
  for (const [name,fn] of Object.entries(z)) assert.equal(root[name],fn);
  for (const name of ['calculateBazi','calculateBaziJson','formatBazi','formatBaziCompact','calculateFinance','calculateFinanceJson','formatFinance','calculateDaily','calculateDailyJson','calculateCrossSihua','calculateCrossSihuaJson','createJsonEnvelope','normalizeBirthInput']) assert.equal(typeof root[name],'function',name);
  t.diagnostic(JSON.stringify({rootExports:Object.keys(root).sort(),count:Object.keys(root).length}));
});

test('raw chart and JSON companion retain complete calculation', () => {
  const raw = z.calculateChart(2001,3,7,6,10,'女',{referenceDate:'2026-10-24'});
  const json = z.calculateChartJson({...birth,referenceDate:'2026-10-24'});
  assert.equal(Object.keys(raw.gongs).length,12);
  assert.deepEqual(json.data,raw);
  assert.equal(json.kind,'ziwei.chart');
  assert.equal(json.referenceDate,'2026-10-24');
  assert.deepEqual(json.input,birth);
  assert.deepEqual(JSON.parse(JSON.stringify(json)),json);
  assert.ok(json.limitations.includes('UPSTREAM_ZIWEI_BIRTH_MINUTE_NOT_APPLIED'));
});

test('dayhour JSON optional clock, minute disclosure and strict targets', () => {
  const base = {...birth,targetDate:'2026-10-24'};
  const daily = z.calculateDayHourOverlayJson(base);
  assert.equal(daily.kind,'ziwei.dayhour');
  assert.equal(daily.referenceDate,base.targetDate);
  assert.equal(daily.data.hourly,null);
  const hourly = z.calculateDayHourOverlayJson({...base,targetHour:23,targetMinute:59});
  assert.equal(hourly.data.hourly.zhi,'子');
  assert.deepEqual(hourly.data,z.calculateDayHourOverlayJson({...base,targetHour:23,targetMinute:0}).data);
  assert.ok(hourly.limitations.includes('UPSTREAM_TARGET_MINUTE_NOT_APPLIED'));
  assert.deepEqual(JSON.parse(JSON.stringify(hourly)),hourly);
  assert.equal(z.calculateDayHourOverlay(null,2026,10,24),null);
  for (const extra of [{targetMinute:1},{targetHour:24},{targetHour:1.1},{targetHour:'1'},{targetHour:1,targetMinute:60},{targetHour:null},{targetDate:'2026-02-30'},{targetDate:undefined},{referenceDate:'2026-10-24'}]) assert.throws(()=>z.calculateDayHourOverlayJson({...base,...extra}));
});

test('helper JSON arrays/null and reference date provenance', () => {
  const chart = z.calculateChartJson({...birth,referenceDate:'2026-10-24'}).data;
  const monthly = z.getMonthlySihuaStarsJson(chart,1);
  const daily = z.getDailySihuaStarsJson(chart,2026,10,24);
  const decadal = z.getDecadalSihuaStarsAtOffsetJson(chart,-1);
  assert.equal(monthly.kind,'ziwei.monthlyStars');
  assert.equal(daily.kind,'ziwei.dailyStars');
  assert.equal(decadal.kind,'ziwei.decadalStars');
  assert.deepEqual(monthly.data,{stars:z.getMonthlySihuaStars(chart,1)});
  assert.deepEqual(daily.data,{stars:z.getDailySihuaStars(chart,2026,10,24)});
  assert.deepEqual(decadal.data,{result:z.getDecadalSihuaStarsAtOffset(chart,-1)});
  for (const value of [monthly,daily,decadal,z.getMonthlySihuaStarsJson(null,1),z.getDailySihuaStarsJson(null,2026,10,24),z.getDecadalSihuaStarsAtOffsetJson(null)]) {
    assert.equal(value.referenceDate,null);
    assert.ok(value.limitations.includes('CHART_REFERENCE_DATE_UNKNOWN'));
    assert.deepEqual(JSON.parse(JSON.stringify(value)),value);
  }
  assert.deepEqual(z.getMonthlySihuaStarsJson(null,1).data,{stars:null});
  const missing = structuredClone(chart);
  const current = missing.daXian.findIndex(dx=>missing.horoscope.age.nominalAge>=dx.startAge && missing.horoscope.age.nominalAge<=dx.endAge);
  assert.ok(current>=0);
  delete missing.gongGan[missing.daXian[current].zhi];
  const raw = z.getDecadalSihuaStarsAtOffset(missing);
  assert.equal(raw.gan,undefined);
  assert.deepEqual(z.getDecadalSihuaStarsAtOffsetJson(missing).data,{result:{...raw,gan:null}});
  for (const month of [0,13,1.5,'1']) assert.throws(()=>z.getMonthlySihuaStarsJson(chart,month));
  assert.throws(()=>z.getDailySihuaStarsJson(chart,2026,2,30));
  assert.throws(()=>z.getDecadalSihuaStarsAtOffsetJson(chart,0.5));
});

test('TianGan index0 reference chart and factual formats',()=>{
  const input={birthDate:birth.birthDate,gender:birth.gender};
  const result=z.calculateChartByTianGanJson(input);
  assert.equal(result.kind,'ziwei.tiangan');
  assert.equal(result.referenceDate,null);
  assert.equal(result.data.referenceShiChenIdx,0);
  assert.ok(result.limitations.includes('INDEX0_REFERENCE_CHART_NOT_KNOWN_BIRTHTIME'));
  assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
  assert.throws(()=>z.calculateChartByTianGanJson({...input,hour:0}));
  const chart=z.calculateChartJson({...birth,referenceDate:'2026-10-24'}).data;
  for (const text of [z.formatChart(chart),z.formatChartCompact(chart),z.formatChartByTianGan(2001,3,7,'女')]) assert.ok(typeof text === 'string' && text.includes('紫微'));
});

test('strict birth input and northern geng configuration',()=>{
  for (const extra of [{birthDate:'2001-02-29'},{hour:24},{minute:60},{gender:'M'},{timezone:'UTC'}]) assert.throws(()=>z.calculateChartJson({...birth,...extra}));
  const {id,...geng}=fixtures[1];
  const raw=z.calculateChartJson({...geng,referenceDate:'2026-10-24'}).data;
  assert.equal(raw.basic.yearGanZhi[0],'庚');
  assert.deepEqual(raw.siHua,{太陽:'祿',武曲:'權',天同:'科',天相:'忌'});
  const table=Object.values(raw.feiHua).find(f=>f.gan==='庚');
  assert.deepEqual(table.sihua,['太陽化祿','武曲化權','天同化科','天相化忌']);
  const first=z.calculateChartJson({...birth,minute:0,referenceDate:'2026-10-24'});
  const second=z.calculateChartJson({...birth,minute:59,referenceDate:'2026-10-24'});
  assert.deepEqual(first.data,second.data);
});

test('transit rebuilds for referenceDate and exposes all twelve Doujun months', () => {
  const json = z.calculateTransitOverlayJson({...birth,referenceDate:'2025-12-31'});
  assert.equal(json.kind,'ziwei.transit');
  assert.equal(Object.keys(json.data.monthly).length,12);
  assert.ok(!Object.hasOwn(json.data,'summary'));
  assert.ok(!Object.hasOwn(json.data,'_lookup'));
  assert.deepEqual(JSON.parse(JSON.stringify(json)),json);
  const selected = z.calculateTransitOverlayJson({...birth,referenceDate:'2025-12-31',months:[12,1,6]});
  assert.deepEqual(Object.keys(selected.data.monthly),['1','6','12']);
  assert.deepEqual(selected.data.monthly[6],json.data.monthly[6]);
  for (const months of [[],[0],[13],[1,1],[1.5],['1']]) assert.throws(()=>z.calculateTransitOverlayJson({...birth,referenceDate:'2025-12-31',months}));
  assert.throws(()=>z.calculateTransitOverlayJson(birth));
  assert.throws(()=>z.calculateTransitOverlayJson({...birth,referenceDate:'2025-02-29'}));
  assert.throws(()=>z.calculateTransitOverlayJson({...birth,referenceDate:'2025-12-31',targetYear:2027}));
  assert.equal(z.calculateTransitOverlay(null),null);
});
