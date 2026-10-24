import test from 'node:test';
import assert from 'node:assert/strict';
import fixtures from './fixtures/synthetic-births.json' with {type:'json'};
import {calculateChart,calculateCrossSihua,calculateCrossSihuaJson,getMonthlySihuaStars,getDailySihuaStars,getDecadalSihuaStarsAtOffset} from '../index.js';
import {installSourceHooks} from './helpers/source-hooks.mjs';
import {sourceUrl,sourceHashes,expectedHashes} from './helpers/source-integrity.mjs';
import {withFixedClock,REFERENCE_DATES} from './helpers/fixed-clock.mjs';
const hooks=installSourceHooks();
const originalZ=await import(sourceUrl('src-mirror/src/ziwei-calc.js'));
const originalC=await import(sourceUrl('src-mirror/src/crosssihua.js'));
const before=sourceHashes();
const args=f=>[...f.birthDate.split('-').map(Number),f.hour,f.minute,f.gender];
const birth=f=>{const {id,...b}=f;return b;};
const levels=['natal','palace','decadal','pastDecadal','pastDecadal2','yearly','monthly','daily'];
function extras(Z,A,B,month,date) {
  const parts=date.split('-').map(Number);
  return {
    monthlySihua:{a:Z.getMonthlySihuaStars(A,month),b:Z.getMonthlySihuaStars(B,month)},
    dailySihua:{a:Z.getDailySihuaStars(A,...parts),b:Z.getDailySihuaStars(B,...parts)},
    pastDecadalSihua:{a:Z.getDecadalSihuaStarsAtOffset(A,-1)?.stars,b:Z.getDecadalSihuaStarsAtOffset(B,-1)?.stars},
    pastDecadal2Sihua:{a:Z.getDecadalSihuaStarsAtOffset(A,-2)?.stars,b:Z.getDecadalSihuaStarsAtOffset(B,-2)?.stars},
  };
}
const localZ={getMonthlySihuaStars,getDailySihuaStars,getDecadalSihuaStarsAtOffset};
for (const [i,f] of fixtures.entries()) for (const date of REFERENCE_DATES) test(`${f.id} pair ${date} all cross layers direct-original`,()=>{
  const other=fixtures[(i+1)%fixtures.length];
  const A=calculateChart(...args(f),{referenceDate:date}), B=calculateChart(...args(other),{referenceDate:date});
  const OA=withFixedClock(date,()=>originalZ.calculateChart(...args(f))), OB=withFixedClock(date,()=>originalZ.calculateChart(...args(other)));
  for (let month=1;month<=12;month++) {
    const opts={levels,...extras(localZ,A,B,month,date)};
    const originalOpts={levels,...extras(originalZ,OA,OB,month,date)};
    assert.deepEqual(opts,originalOpts);
    const expected=originalC.calculateCrossSihua(OA,OB,originalOpts);
    const actual=calculateCrossSihua(A,B,opts);
    assert.deepEqual(actual.flights,expected.flights);
    assert.deepEqual(actual.meta,expected.meta);
    const json=calculateCrossSihuaJson({a:birth(f),b:birth(other),referenceDate:date,levels,month,targetDate:date});
    assert.deepEqual(json.data,{flights:expected.flights,meta:expected.meta});
    for (const level of levels) {
      const only=calculateCrossSihua(A,B,{...opts,levels:[level]});
      const originalOnly=originalC.calculateCrossSihua(OA,OB,{...originalOpts,levels:[level]});
      assert.deepEqual(only.flights,originalOnly.flights);
      assert.deepEqual(only.meta,originalOnly.meta);
    }
  }
  const expectedDefault=originalC.calculateCrossSihua(OA,OB);
  assert.deepEqual(calculateCrossSihuaJson({a:birth(f),b:birth(other),referenceDate:date}).data,{flights:expectedDefault.flights,meta:expectedDefault.meta});
});
test.after(()=>{assert.deepEqual(sourceHashes(),before);assert.deepEqual(before,expectedHashes());hooks.deregister();});
