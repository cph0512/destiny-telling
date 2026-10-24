import test from 'node:test';
import assert from 'node:assert/strict';
import fixtures from './fixtures/synthetic-births.json' with {type:'json'};
import * as z from '../src/ziwei.js';
import {installSourceHooks} from './helpers/source-hooks.mjs';
import {sourceUrl,sourceHashes,expectedHashes} from './helpers/source-integrity.mjs';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {forbiddenProse,proseMatches} from './helpers/neutral-scan.mjs';
import {withFixedClock,REFERENCE_DATES} from './helpers/fixed-clock.mjs';
const hooks = installSourceHooks();
const original = await import(sourceUrl('src-mirror/src/ziwei-calc.js'));
const before = sourceHashes();
const upstreamTests = [
  {file:'test-crosssihua.mjs',sha256:'ee4a9a00c0b6cf7bcc84a793bf6f69c5f326e2d26062e1bf8eda659ae591c0c3'},
  {file:'test-heban-modes.mjs',sha256:'b0a2a1e7ae2c1a2eda6fdca9cd15c0b356251a9ab8b0303c0a583d23d778c3ae'},
];
function upstreamTestHashes() {
  return upstreamTests.map(({file})=>({file,sha256:createHash('sha256').update(readFileSync(new URL(`../${file}`,sourceUrl('src-mirror/src/ziwei-calc.js')))).digest('hex')}));
}
const beforeTests=upstreamTestHashes();
const seenHighlightTypes=new Set();

const args = f => [...f.birthDate.split('-').map(Number),f.hour,f.minute,f.gender];

test('direct-original raw chart and injected reference date', () => {
  const f = fixtures[0], date = REFERENCE_DATES[2];
  const expected = withFixedClock(date,()=>original.calculateChart(...args(f)));
  assert.deepEqual(z.calculateChart(...args(f),{referenceDate:date}),expected);
  assert.deepEqual(withFixedClock(date,()=>z.calculateChart(...args(f))),expected);
});

function transitProjection(value) {
  if (value === null) return null;
  const {summary,_lookup,...data} = value;
  return {...data,highlights:data.highlights.map(({impact,...h})=>{
    if (h.type === '雙權') delete h.detail;
    return h;
  })};
}
for (const f of fixtures) for (const date of REFERENCE_DATES) {
  test(`${f.id} ${date} chart/transit all12 direct-original`, () => {
    const expectedChart = withFixedClock(date,()=>original.calculateChart(...args(f)));
    const chart = z.calculateChart(...args(f),{referenceDate:date});
    assert.deepEqual(chart,expectedChart);
    assert.deepEqual(withFixedClock(date,()=>z.calculateChart(...args(f))),expectedChart);
    const expected = original.calculateTransitOverlay(expectedChart,Number(date.slice(0,4)));
    const actual = z.calculateTransitOverlay(chart,Number(date.slice(0,4)));
    assert.deepEqual(transitProjection(actual),transitProjection(expected));
    const {id,...birth} = f;
    assert.deepEqual(z.calculateTransitOverlayJson({...birth,referenceDate:date}).data,transitProjection(expected));
    const taiSui = z.DI_ZHI.indexOf(chart.horoscope.yearly.mingGongZhi);
    const doujun = ((taiSui-((chart.basic.lunarMonth || 1)-1)+12)%12+(chart.basic.shiChenIdx || 0))%12;
    for (let m=1;m<=12;m++) {
      assert.equal(actual.monthly[m].mingGongZhi,z.DI_ZHI[(doujun+m-1)%12]);
      assert.deepEqual(z.getMonthlySihuaStars(chart,m),original.getMonthlySihuaStars(expectedChart,m));
      assert.deepEqual(actual.monthly[m],expected.monthly[m]);
    }
    const relabeled = z.calculateTransitOverlay(chart,2099);
    assert.deepEqual(transitProjection(relabeled),transitProjection(actual));
    for (const h of actual.highlights) {
      seenHighlightTypes.add(h.type);
      const pe = actual.palaceEffects[h.zhi];
      const effects = [...pe.natal,...pe.decadal,...pe.yearly,...(h.month ? pe.monthly[h.month] || [] : [])];
      const count = hua => effects.filter(e=>e.hua === hua).length;
      if (h.type === '雙祿') assert.ok(count('化祿')>=2);
      if (h.type === '雙忌') assert.ok(count('化忌')>=2);
      if (h.type === '雙權') assert.ok(count('化權')>=2);
      if (h.type === '祿忌同宮') assert.ok(count('化祿')>=1 && count('化忌')>=1);
      if (h.type === '三祿疊') assert.ok(count('化祿')>=3);
      if (h.type === '三忌疊') assert.ok(count('化忌')>=3);
      if (h.type === '化忌沖') { assert.ok(count('化忌')>=1); assert.equal(h.targetGong,actual._lookup.dualName(z.DI_ZHI[(z.DI_ZHI.indexOf(h.zhi)+6)%12])); }
      assert.ok(!Object.hasOwn(h,'impact'));
    }
  });
}

function dayProjection(value) {
  if (value === null) return null;
  const {summary,...data} = value;
  return {...data,highlights:data.highlights.map(({impact,...h})=>h)};
}
for (const f of fixtures) for (const date of REFERENCE_DATES) {
  test(`${f.id} ${date} daily and all24 hours direct-original`, () => {
    const chart = z.calculateChart(...args(f),{referenceDate:date});
    const originalChart = withFixedClock(date,()=>original.calculateChart(...args(f)));
    const parts = date.split('-').map(Number);
    const {id,...birth} = f;
    for (const hour of [null,...Array.from({length:24},(_,h)=>h)]) {
      const expected = original.calculateDayHourOverlay(originalChart,...parts,hour,59);
      const actual = z.calculateDayHourOverlay(chart,...parts,hour,59);
      if (actual.daily.gan === '庚') assert.deepEqual(actual.daily.sihua.map(s=>s.star),['太陽','武曲','天同','天相']);
      if (actual.hourly?.gan === '庚') assert.deepEqual(actual.hourly.sihua.map(s=>s.star),['太陽','武曲','天同','天相']);
      assert.deepEqual(dayProjection(actual),dayProjection(expected));
      const json = z.calculateDayHourOverlayJson({...birth,targetDate:date,...(hour === null ? {} : {targetHour:hour,targetMinute:59})});
      assert.deepEqual(json.data,dayProjection(expected));
      assert.deepEqual(JSON.parse(JSON.stringify(json)),json);
      assert.deepEqual(z.getDailySihuaStars(chart,...parts),original.getDailySihuaStars(originalChart,...parts));
    }
    for (const offset of [-20,-2,-1,0,1,2,20]) assert.deepEqual(z.getDecadalSihuaStarsAtOffset(chart,offset),original.getDecadalSihuaStarsAtOffset(originalChart,offset));
  });
}

for (const f of fixtures) test(`${f.id} factual TianGan/reference and formatter parity`,()=>{
  const [y,m,d]=f.birthDate.split('-').map(Number);
  const ref=withFixedClock(REFERENCE_DATES[2],()=>original.calculateChart(y,m,d,0,0,f.gender));
  const json=z.calculateChartByTianGanJson({birthDate:f.birthDate,gender:f.gender});
  const expected={solarDate:ref.basic.solarDate,lunarDate:ref.basic.lunarDate.slice(2),yearGanZhi:ref.basic.yearGanZhi,yearGan:ref.basic.yearGanZhi[0],gender:f.gender,referenceShiChenIdx:0,yearSiHua:ref.feiHua[Object.keys(ref.gongGan).find(zhi=>ref.gongGan[zhi]===ref.basic.yearGanZhi[0])].sihua,starMap:Object.fromEntries(Object.entries(ref.gongs).map(([zhi,g])=>[zhi,{gan:ref.gongGan[zhi],stars:g.stars}])),feiHua:ref.feiHua};
  assert.deepEqual(json.data,expected);
  const originalText=original.formatChartByTianGan(y,m,d,f.gender), text=z.formatChartByTianGan(y,m,d,f.gender);
  assert.deepEqual(text.split('\n').filter(line=>line.startsWith('|')),originalText.split('\n').filter(line=>line.startsWith('|')));
  for (const h of expected.yearSiHua) { assert.ok(originalText.includes(`- ${h}\n`)); assert.ok(text.includes(`- ${h}\n`)); }
  for (const zhi of z.DI_ZHI) { const info=expected.feiHua[zhi]; const line=`- ${zhi}宮（宮干${info.gan}）→ ${info.sihua.join('、')}\n`; assert.ok(originalText.includes(line)); assert.ok(text.includes(line)); }
  assert.deepEqual(proseMatches(text),[]);
  const chart=z.calculateChart(...args(f),{referenceDate:REFERENCE_DATES[2]});
  assert.equal(z.formatChartCompact(chart),original.formatChartCompact(chart));
  assert.equal(z.formatChart(chart),original.formatChart(chart).replace('### 今年流年','### 流年'));
  assert.deepEqual(z.SHI_CHEN_RANGE,original.SHI_CHEN_RANGE);
  assert.deepEqual(z.DI_ZHI,original.DI_ZHI);
  assert.deepEqual(z.TIAN_GAN,original.TIAN_GAN);
});

test('helper JSON direct-original projections and raw missing-star behavior',()=>{
  const f=fixtures[0], chart=z.calculateChart(...args(f),{referenceDate:REFERENCE_DATES[2]});
  for (let m=1;m<=12;m++) assert.deepEqual(z.getMonthlySihuaStarsJson(chart,m).data,{stars:original.getMonthlySihuaStars(chart,m)});
  for (const date of REFERENCE_DATES) {
    const parts=date.split('-').map(Number);
    assert.deepEqual(z.getDailySihuaStarsJson(chart,...parts).data,{stars:original.getDailySihuaStars(chart,...parts)});
  }
  for (let offset=-12;offset<=12;offset++) assert.deepEqual(z.getDecadalSihuaStarsAtOffsetJson(chart,offset).data,{result:original.getDecadalSihuaStarsAtOffset(chart,offset)});
  const missing=structuredClone(chart);
  for (const g of Object.values(missing.gongs)) {g.stars=[];g.minor=[];g.sihua=[];}
  const actual=z.calculateDayHourOverlay(missing,2026,10,24,0);
  assert.deepEqual(dayProjection(actual),dayProjection(original.calculateDayHourOverlay(missing,2026,10,24,0)));
  for (const s of [...actual.daily.sihua,...actual.hourly.sihua]) {assert.equal(s.zhi,null);assert.equal(s.gongName,'（本命無此星）');}
  assert.deepEqual(z.calculateTransitOverlay(missing,2026).decadal.sihua,original.calculateTransitOverlay(missing,2026).decadal.sihua);
  const cur=missing.daXian.find(dx=>missing.horoscope.age.nominalAge>=dx.startAge && missing.horoscope.age.nominalAge<=dx.endAge);
  delete missing.gongGan[cur.zhi];
  const expected=original.getDecadalSihuaStarsAtOffset(missing);
  assert.equal(expected.gan,undefined);
  assert.deepEqual(z.getDecadalSihuaStarsAtOffset(missing),expected);
  assert.deepEqual(z.getDecadalSihuaStarsAtOffsetJson(missing).data,{result:{...expected,gan:null}});
});

test('all transit flag branches observed; original hashes and prose gate',t=>{
  assert.deepEqual([...seenHighlightTypes].sort(),['雙祿','雙忌','祿忌同宮','雙權','化忌沖','三祿疊','三忌疊'].sort());
  assert.deepEqual(sourceHashes(),before);
  assert.deepEqual(before,expectedHashes());
  assert.deepEqual(upstreamTestHashes(),beforeTests);
  assert.deepEqual(beforeTests,upstreamTests);
  t.diagnostic(JSON.stringify({sourceHashes:before,upstreamTestHashes:beforeTests,highlightTypes:[...seenHighlightTypes].sort()}));
  const banned=forbiddenProse();
  assert.ok(banned.length>0);
  for (const f of fixtures) {
    const {id,...birth}=f;
    for (const envelope of [z.calculateChartJson({...birth,referenceDate:REFERENCE_DATES[2]}),z.calculateTransitOverlayJson({...birth,referenceDate:REFERENCE_DATES[2]}),z.calculateDayHourOverlayJson({...birth,targetDate:REFERENCE_DATES[2],targetHour:23}),z.calculateChartByTianGanJson({birthDate:birth.birthDate,gender:birth.gender})]) assert.deepEqual(proseMatches(JSON.stringify(envelope),banned),[]);
  }
});

test.after(() => { assert.deepEqual(sourceHashes(),before); assert.deepEqual(before,expectedHashes()); hooks.deregister(); });
