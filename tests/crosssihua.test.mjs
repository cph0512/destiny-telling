import test from 'node:test';
import assert from 'node:assert/strict';
import fixtures from './fixtures/synthetic-births.json' with {type:'json'};
import * as z from '../src/ziwei.js';
import * as c from '../src/crosssihua.js';
const birth = i => {const {id,...b}=fixtures[i]; return b;};
const a = birth(2), b = birth(1), referenceDate = '2026-10-24';
const chart = input => z.calculateChartJson({...input,referenceDate}).data;

test('ported baseline cross invariants and raw helpers', () => {
  const A = chart(a), B = chart(b);
  assert.ok(A.siHua && A.feiHua && A.horoscope);
  const res = c.calculateCrossSihua(A,B);
  assert.ok(res.summary.includes('甲方') && res.summary.includes('乙方') && res.summary.includes('交叉飛化'));
  for (const dir of ['aToB','bToA']) {
    assert.ok(Array.isArray(res.flights[dir]));
    for (const f of res.flights[dir]) {
      assert.ok(['L1','L2','L3','L4'].includes(f.layer));
      assert.ok(f.toPalace.endsWith('宮'));
      assert.ok(c.__internals.HUA_ORDER.includes(f.hua));
    }
    for (const layer of ['L1','L3','L4']) assert.ok(res.flights[dir].filter(f=>f.layer===layer).length<=4);
    assert.ok(res.flights[dir].filter(f=>f.layer==='L2').length<=48);
    for (const [level,layer] of [['natal','L1'],['yearly','L4']]) assert.ok(c.calculateCrossSihua(A,B,{levels:[level]}).flights[dir].every(f=>f.layer===layer));
  }
  assert.deepEqual(c.__internals.parseSihuaEntry('太陽化祿'),{star:'太陽',hua:'化祿'});
  for (const value of [null,1,'太陽','']) assert.equal(c.__internals.parseSihuaEntry(value),null);
  assert.equal(c.__internals.findStarPalace({gongs:{}},'太陽'),null);
});

test('JSON cross all layers uses neutral names and helper extras', () => {
  const levels = ['natal','palace','decadal','pastDecadal','pastDecadal2','yearly','monthly','daily'];
  const json = c.calculateCrossSihuaJson({a,b,referenceDate,levels,month:6,targetDate:'2025-12-31'});
  assert.equal(json.kind,'cross.sihua');
  assert.equal(json.referenceDate,referenceDate);
  assert.deepEqual(json.data.meta,{levels,nameA:'甲方',nameB:'乙方'});
  assert.deepEqual(JSON.parse(JSON.stringify(json)),json);
  assert.ok(!Object.hasOwn(json.data,'summary'));
  for (const dir of ['aToB','bToA']) for (const layer of ['L1','L2','L3','L4','L5','L6']) assert.ok(json.data.flights[dir].some(f=>f.layer===layer),`${dir} ${layer}`);
  const A = chart(a), B = chart(b);
  for (const layer of ['L3b','L3c']) assert.ok(json.data.flights.aToB.some(f=>f.layer===layer));
  assert.equal(z.getDecadalSihuaStarsAtOffset(B,-1),null);
  assert.equal(z.getDecadalSihuaStarsAtOffset(B,-2),null);
  assert.ok(json.data.flights.bToA.every(f=>!['L3b','L3c'].includes(f.layer)));
  const options = {levels,monthlySihua:{a:z.getMonthlySihuaStars(A,6),b:z.getMonthlySihuaStars(B,6)},dailySihua:{a:z.getDailySihuaStars(A,2025,12,31),b:z.getDailySihuaStars(B,2025,12,31)},pastDecadalSihua:{a:z.getDecadalSihuaStarsAtOffset(A,-1)?.stars,b:z.getDecadalSihuaStarsAtOffset(B,-1)?.stars},pastDecadal2Sihua:{a:z.getDecadalSihuaStarsAtOffset(A,-2)?.stars,b:z.getDecadalSihuaStarsAtOffset(B,-2)?.stars}};
  const raw = c.calculateCrossSihua(A,B,options);
  assert.deepEqual(json.data,{flights:raw.flights,meta:raw.meta});
  assert.ok(raw.summary.includes('上一大限') && raw.summary.includes('再上一大限'));
  assert.notDeepEqual(z.getMonthlySihuaStars(A,5),z.getMonthlySihuaStars(A,6));
  assert.equal(z.getMonthlySihuaStars(A,5).length,4);
  assert.equal(z.getDailySihuaStars(A,2025,12,31).length,4);
  assert.notEqual(z.getDecadalSihuaStarsAtOffset(A,0).zhi,z.getDecadalSihuaStarsAtOffset(A,-1).zhi);
});

test('raw temporal labels, names and missing source extras preserve behavior',()=>{
  const A=chart(a),B=chart(b);
  const opts={levels:['monthly','daily'],nameA:'甲盤',nameB:'乙盤',monthlySihua:{a:z.getMonthlySihuaStars(A,6),b:z.getMonthlySihuaStars(B,6)},dailySihua:{a:z.getDailySihuaStars(A,2026,10,24),b:z.getDailySihuaStars(B,2026,10,24)},monthlyLabel:'斗君序6',dailyLabel:'2026-10-24'};
  const res=c.calculateCrossSihua(A,B,opts);
  assert.ok(res.summary.includes('斗君序6') && res.summary.includes('2026-10-24'));
  assert.ok(res.flights.aToB.every(f=>f.sourceLabel.startsWith('甲盤 ')));
  assert.ok(res.flights.bToA.every(f=>f.sourceLabel.startsWith('乙盤 ')));
  assert.deepEqual(c.calculateCrossSihua(A,B,{levels:['monthly','daily','pastDecadal','pastDecadal2']}).flights,{aToB:[],bToA:[]});
});

test('cross JSON rejects invalid fields and unused temporal inputs', () => {
  const base={a,b,referenceDate};
  for (const extra of [{levels:[]},{levels:['natal','natal']},{levels:['unknown']},{levels:'natal'},{month:1},{targetDate:referenceDate},{nameA:'甲'},{levels:['monthly']},{levels:['monthly'],month:0},{levels:['monthly'],month:13},{levels:['monthly'],month:1.5},{levels:['daily']},{levels:['daily'],targetDate:'2026-02-30'},{referenceDate:undefined},{referenceDate:'2026-02-30'},{a:{...a,timezone:'UTC'}}]) assert.throws(()=>c.calculateCrossSihuaJson({...base,...extra}));
  const json = c.calculateCrossSihuaJson(base);
  assert.deepEqual(json.data.meta.levels,['natal','palace','decadal','yearly']);
});
