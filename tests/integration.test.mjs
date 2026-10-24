import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import fixtures from './fixtures/synthetic-births.json' with {type:'json'};
import { withFixedClock, REFERENCE_DATES } from './helpers/fixed-clock.mjs';

const modulePaths=[
  '../index.js','../src/ziwei.js','../src/crosssihua.js','../src/bazi.js','../src/finance.js',
  '../src/daily.js','../src/json-envelope.js','../mcp/schemas.js','../mcp/handlers.js','../mcp/server.js',
];
const births=fixtures.map(({id,...birth})=>birth);
const cwd=fileURLToPath(new URL('..',import.meta.url));
const allLevels=['natal','palace','decadal','yearly','pastDecadal','pastDecadal2','monthly','daily'];

if (process.argv[2]==='--import-probe') {
  const target=process.argv[3];
  assert.ok(modulePaths.includes(target));
  const events=['data','end','error','readable'];
  const counts=()=>events.map(event=>process.stdin.listenerCount(event));
  const before=counts();
  const module=await import(new URL(target,import.meta.url));
  assert.deepEqual(counts(),before,'import must not attach stdin listeners');
  if (target==='../mcp/server.js') {
    assert.equal(typeof module.createServer,'function');
    const first=module.createServer(),second=module.createServer();
    try {
      assert.notEqual(first,second,'factory must make isolated servers');
      assert.deepEqual(counts(),before,'factory must not connect stdin');
    } finally {await first.close();await second.close();}
  }
} else {
  const root=await import('../index.js');
  const parts=birth=>birth.birthDate.split('-').map(Number);
  const rawChart=(birth,referenceDate)=>root.calculateChart(...parts(birth),birth.hour,birth.minute,birth.gender,{referenceDate});
  const checkJson=value=>{
    root.assertJsonData(value);
    assert.deepEqual(JSON.parse(JSON.stringify(value)),value);
    assert.equal(value.schema,'destiny-telling.calc/v1');
    assert.deepEqual(value.config,{school:'north',gengMutagens:['太陽','武曲','天同','天相']});
  };

  for (const modulePath of modulePaths) {
    test(`isolated import has no stdout/stderr, stdin startup or surviving child: ${modulePath}`, {timeout:10000}, async()=>{
      const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'--import-probe',modulePath],{cwd,env:getDefaultEnvironment(),stdio:['pipe','pipe','pipe']});
      const closed=once(child,'close');
      let stdout='',stderr='',timedOut=false;
      child.stdout.on('data',chunk=>{stdout+=chunk.toString();});
      child.stderr.on('data',chunk=>{stderr+=chunk.toString();});
      const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},5000);
      try {
        const [code,signal]=await closed;
        assert.equal(timedOut,false,'isolated import must terminate without EOF');
        assert.equal(code,0,stderr);assert.equal(signal,null);
        assert.equal(stdout,'');assert.equal(stderr,'');
        assert.throws(()=>process.kill(child.pid,0),{code:'ESRCH'});
      } finally {
        clearTimeout(timer);
        child.stdin.destroy();
        if (child.exitCode===null && child.signalCode===null) child.kill('SIGKILL');
        await closed;
      }
    });
  }

  for (const [index,birth] of births.entries()) {
    test(`all root calculation exports compose without input mutation and retain full JSON: ${fixtures[index].id}`,()=>{
      const referenceDate='2026-10-24',before=structuredClone(birth);
      const chart=rawChart(birth,referenceDate);
      const chartJson=root.calculateChartJson({...birth,referenceDate});
      assert.deepEqual(chartJson.data,chart);
      const transit=root.calculateTransitOverlay(chart,2026);
      const transitJson=root.calculateTransitOverlayJson({...birth,referenceDate});
      assert.deepEqual(transitJson.data.monthly,transit.monthly);
      assert.deepEqual(transitJson.data.yearly,transit.yearly);
      assert.deepEqual(transitJson.data.decadal,transit.decadal);
      const dayhour=root.calculateDayHourOverlay(chart,2026,10,24,23,59);
      const dayhourJson=root.calculateDayHourOverlayJson({...birth,targetDate:referenceDate,targetHour:23,targetMinute:59});
      assert.deepEqual(dayhourJson.data.daily,dayhour.daily);
      assert.deepEqual(dayhourJson.data.hourly,dayhour.hourly);
      const bazi=root.calculateBazi(...parts(birth),birth.hour,birth.gender,birth.minute);
      const baziJson=root.calculateBaziJson(birth);
      assert.deepEqual(baziJson.data,bazi);
      const finance=root.calculateFinance(...parts(birth),birth.hour,birth.gender,{referenceDate});
      const financeJson=root.calculateFinanceJson({...birth,referenceDate});
      assert.deepEqual(financeJson.data,finance);
      const daily=root.calculateDaily({birth_date:birth.birthDate,birth_hour:birth.hour,gender:birth.gender,target_date:referenceDate});
      const dailyJson=root.calculateDailyJson({...birth,targetDate:referenceDate});
      assert.deepEqual(dailyJson.data,daily);
      const tian=root.calculateChartByTianGanJson({birthDate:birth.birthDate,gender:birth.gender});
      const other=rawChart(births[(index+1)%births.length],referenceDate);
      const cross=root.calculateCrossSihua(chart,other);
      const crossJson=root.calculateCrossSihuaJson({a:birth,b:births[(index+1)%births.length],referenceDate});
      assert.deepEqual(crossJson.data,{flights:cross.flights,meta:cross.meta});
      const monthly=root.getMonthlySihuaStarsJson(chart,6);
      const dailyStars=root.getDailySihuaStarsJson(chart,2026,10,24);
      const decade=root.getDecadalSihuaStarsAtOffsetJson(chart,-1);
      assert.deepEqual(monthly.data,{stars:root.getMonthlySihuaStars(chart,6)});
      assert.deepEqual(dailyStars.data,{stars:root.getDailySihuaStars(chart,2026,10,24)});
      assert.deepEqual(decade.data,{result:root.getDecadalSihuaStarsAtOffset(chart,-1)});
      for (const output of [chartJson,transitJson,dayhourJson,baziJson,financeJson,dailyJson,tian,crossJson,monthly,dailyStars,decade]) checkJson(output);
      for (const text of [root.formatChart(chart),root.formatChartCompact(chart),root.formatChartByTianGan(...parts(birth),birth.gender),root.formatBazi(bazi),root.formatBaziCompact(bazi),root.formatFinance(finance)]) assert.ok(typeof text==='string' && text.length>0);
      assert.deepEqual(birth,before);
    });
  }

  test('root numerical northern geng and all 12 real Doujun outputs survive integration',t=>{
    const birth=births[1],referenceDate='2026-10-24';
    const chart=root.calculateChartJson({...birth,referenceDate}).data;
    assert.equal(chart.basic.yearGanZhi[0],'庚');
    assert.deepEqual(chart.siHua,{太陽:'祿',武曲:'權',天同:'科',天相:'忌'});
    assert.deepEqual(Object.values(chart.feiHua).find(row=>row.gan==='庚').sihua,['太陽化祿','武曲化權','天同化科','天相化忌']);
    const all=root.calculateTransitOverlayJson({...birth,referenceDate});
    const rows=[];
    for (let month=1;month<=12;month++) {
      const selected=root.calculateTransitOverlayJson({...birth,referenceDate,months:[month]});
      assert.deepEqual(selected.data.monthly[month],all.data.monthly[month]);
      const stars=root.getMonthlySihuaStars(chart,month);
      assert.ok(Array.isArray(stars) && stars.length===4);
      assert.deepEqual(root.getMonthlySihuaStarsJson(chart,month).data,{stars});
      rows.push(all.data.monthly[month]);
    }
    assert.equal(rows.length,12);
    assert.equal(new Set(rows.map(row=>row.mingGongZhi)).size,12);
    t.diagnostic(JSON.stringify({doujunMonths:rows}));
  });

  test('explicit referenceDate is deterministic under all four fixed clocks and changes temporal data',()=>{
    const birth=births[2],referenceDate='2026-10-24';
    const operations=[
      ()=>root.calculateChartJson({...birth,referenceDate}),
      ()=>root.calculateTransitOverlayJson({...birth,referenceDate}),
      ()=>root.calculateDayHourOverlayJson({...birth,targetDate:referenceDate,targetHour:23}),
      ()=>root.calculateFinanceJson({...birth,referenceDate}),
      ()=>root.calculateDailyJson({...birth,targetDate:referenceDate}),
      ()=>root.calculateCrossSihuaJson({a:birth,b:births[3],referenceDate,levels:allLevels,month:6,targetDate:'2026-10-25'}),
    ];
    const expected=operations.map(operation=>operation());
    for (const clock of REFERENCE_DATES) {
      assert.deepEqual(withFixedClock(clock,()=>operations.map(operation=>operation())),expected);
      for (const calculate of [root.calculateChartJson,root.calculateFinanceJson]) assert.deepEqual(withFixedClock(clock,()=>calculate(birth)),calculate({...birth,referenceDate:clock}));
    }
    const first=root.calculateChartJson({...birth,referenceDate:REFERENCE_DATES[0]}),last=root.calculateChartJson({...birth,referenceDate:REFERENCE_DATES.at(-1)});
    assert.notDeepEqual(first.data.horoscope,last.data.horoscope);
    assert.deepEqual(first.data.gongs,last.data.gongs);
    assert.notDeepEqual(root.calculateTransitOverlayJson({...birth,referenceDate:REFERENCE_DATES[0]}).data,root.calculateTransitOverlayJson({...birth,referenceDate:REFERENCE_DATES.at(-1)}).data);
    assert.notDeepEqual(root.calculateFinanceJson({...birth,referenceDate:REFERENCE_DATES[0]}).data.yearly,root.calculateFinanceJson({...birth,referenceDate:REFERENCE_DATES.at(-1)}).data.yearly);
  });

  test('root JSON contracts reject meaningful invalid combinations rather than coercing or ignoring',()=>{
    const birth=births[0],referenceDate='2026-10-24';
    const invalid=[
      ()=>root.calculateChartJson({...birth,timezone:'UTC'}),
      ()=>root.calculateChartJson({...birth,referenceDate:'1900-02-29'}),
      ()=>root.calculateTransitOverlayJson({...birth,referenceDate,months:[1,1]}),
      ()=>root.calculateTransitOverlayJson({...birth,referenceDate,months:['1']}),
      ()=>root.calculateTransitOverlayJson(birth),
      ()=>root.calculateDayHourOverlayJson({...birth,targetDate:referenceDate,targetMinute:1}),
      ()=>root.calculateDayHourOverlayJson({...birth,targetDate:referenceDate,targetHour:24}),
      ()=>root.calculateChartByTianGanJson({birthDate:birth.birthDate,gender:birth.gender,hour:0}),
      ()=>root.calculateBaziJson({...birth,hour:'6'}),
      ()=>root.calculateFinanceJson({...birth,referenceDate:'2026-02-30'}),
      ()=>root.calculateDailyJson({...birth,targetDate:'2025-02-29'}),
      ()=>root.calculateDailyJson({...birth,targetDate:referenceDate,referenceDate}),
      ()=>root.calculateCrossSihuaJson({a:{...birth,name:'unused'},b:births[1],referenceDate}),
      ()=>root.calculateCrossSihuaJson({a:birth,b:births[1],referenceDate,levels:['monthly'],targetDate:referenceDate}),
      ()=>root.calculateCrossSihuaJson({a:birth,b:births[1],referenceDate,levels:['daily'],month:6}),
      ()=>root.getMonthlySihuaStarsJson(null,0),
      ()=>root.getDailySihuaStarsJson(null,2026,2,30),
      ()=>root.getDecadalSihuaStarsAtOffsetJson(null,0.5),
    ];
    for (const operation of invalid) assert.throws(operation);
  });
}
