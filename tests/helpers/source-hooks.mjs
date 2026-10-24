import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { sourceUrl } from './source-integrity.mjs';

const originals = new Set([
  'src-mirror/src/ziwei-calc.js', 'src-mirror/src/crosssihua.js',
  'src-mirror/src/bazi-calc.js', 'src-mirror/src/finance-calc.js',
  'src-api/calc-daily.mjs',
].map(path => sourceUrl(path).href));
const dependencies = new Map([
  ['iztro', import.meta.resolve('iztro')],
  ['lunar-javascript', import.meta.resolve('lunar-javascript')],
]);

export function installSourceHooks() {
  return registerHooks({
    resolve(specifier, context, nextResolve) {
      if (originals.has(context.parentURL) && dependencies.has(specifier)) {
        return { url: dependencies.get(specifier), shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  });
}

if (process.execArgv.some((arg, index, args) => arg === '--import' && args[index + 1] && pathToFileURL(args[index + 1]).href === import.meta.url)) {
  installSourceHooks();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  switch (process.argv[2]) {
    case '--probe-native': {
      installSourceHooks();
      await import(sourceUrl('src-mirror/src/bazi-calc.js'));
      break;
    }
    case '--probe-finance': {
      const { calculateFinance } = await import('../../src/finance.js');
      const chart = calculateFinance(1990, 11, 2, 21, '男', {referenceDate: '2026-10-24'});
      process.stdout.write(JSON.stringify(chart.basic.yearSihua));
      break;
    }
    case '--probe-daily-import': {
      await import('../../src/daily.js');
      break;
    }
    case '--probe-json': {
      const { calculateBaziJson } = await import('../../src/bazi.js');
      const { calculateFinanceJson } = await import('../../src/finance.js');
      const { calculateDailyJson } = await import('../../src/daily.js');
      const birth = {birthDate: '2001-03-07', hour: 6, minute: 10, gender: '女'};
      process.stdout.write(JSON.stringify([
        calculateBaziJson(birth),
        calculateFinanceJson({...birth, referenceDate: '2026-10-24'}),
        calculateDailyJson({...birth, targetDate: '2026-10-24'}),
      ]));
      break;
    }
    default: throw new Error('Unsupported helper mode');
  }
}
