import test from 'node:test';
import assert from 'node:assert/strict';
import fixtures from './fixtures/synthetic-births.json' with {type:'json'};
import {calculateCrossSihuaJson} from '../src/crosssihua.js';
const {id:aId,...a}=fixtures[2], {id:bId,...b}=fixtures[1];
const referenceDate='2026-10-24';
test('ported basic/monthly/timed mode invariants with owner synthetic births',()=>{
  const levels=['natal','palace','decadal','yearly'];
  const basic=calculateCrossSihuaJson({a,b,referenceDate});
  const monthly=calculateCrossSihuaJson({a,b,referenceDate,levels:[...levels,'monthly'],month:6});
  const timed=calculateCrossSihuaJson({a,b,referenceDate,levels:[...levels,'daily'],targetDate:'2026-10-24'});
  const flights = result => [...result.data.flights.aToB,...result.data.flights.bToA];
  const count = (result,layer) => flights(result).filter(f=>f.layer===layer).length;
  assert.equal(count(basic,'L5'),0); assert.equal(count(basic,'L6'),0);
  assert.ok(count(monthly,'L5')>0); assert.equal(count(monthly,'L6'),0);
  assert.ok(count(timed,'L6')>0); assert.equal(count(timed,'L5'),0);
  assert.ok(flights(monthly).length>flights(basic).length);
  assert.ok(flights(timed).length>flights(basic).length);
});
