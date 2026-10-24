import test from 'node:test';
import assert from 'node:assert/strict';
import * as root from '../index.js';
import * as ziwei from '../src/ziwei.js';
import * as cross from '../src/crosssihua.js';
import * as bazi from '../src/bazi.js';
import * as finance from '../src/finance.js';
import * as daily from '../src/daily.js';
import * as envelope from '../src/json-envelope.js';

const expected = [
  'DI_ZHI','SHI_CHEN_RANGE','TIAN_GAN','__internals','assertJsonData','assertKeys','assertRecord','birthFromParts',
  'calculateBazi','calculateBaziJson','calculateChart','calculateChartByTianGanJson','calculateChartJson',
  'calculateCrossSihua','calculateCrossSihuaJson','calculateDaily','calculateDailyJson','calculateDayHourOverlay',
  'calculateDayHourOverlayJson','calculateFinance','calculateFinanceJson','calculateTransitOverlay',
  'calculateTransitOverlayJson','createJsonEnvelope','formatBazi','formatBaziCompact','formatChart',
  'formatChartByTianGan','formatChartCompact','formatFinance','getDailySihuaStars','getDailySihuaStarsJson',
  'getDecadalSihuaStarsAtOffset','getDecadalSihuaStarsAtOffsetJson','getMonthlySihuaStars',
  'getMonthlySihuaStarsJson','normalizeBirthInput','normalizeDate',
];

test('root has the exact public API and original module identities', t => {
  assert.deepEqual(Object.keys(root).sort(), expected.sort());
  for (const module of [ziwei,cross,bazi,finance,daily,envelope]) {
    for (const [name,value] of Object.entries(module)) assert.equal(root[name],value,name);
  }
  t.diagnostic(`root exports: ${Object.keys(root).length}`);
});
