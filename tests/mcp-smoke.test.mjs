import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, symlink, rm, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import fixtures from './fixtures/synthetic-births.json' with {type:'json'};
import * as root from '../index.js';
const births=fixtures.map(({id,...birth})=>birth);
const referenceDate='2026-10-24';
const levels=['natal','palace','decadal','yearly','pastDecadal','pastDecadal2','monthly','daily'];

const serverPath = fileURLToPath(new URL('../mcp/server.js',import.meta.url));
const cwd = fileURLToPath(new URL('..',import.meta.url));
const toolNames = ['ziwei_chart','ziwei_overlay','bazi_chart','cross_sihua','finance_chart'];

async function withClient(run,{command=process.execPath,args=[serverPath]}={}) {
  const transport = new StdioClientTransport({command,args,cwd,stderr:'pipe'});
  const client = new Client({name:'destiny-telling-tests',version:'0.1.0'});
  let stderr = '';
  transport.stderr.on('data',chunk=>{stderr+=chunk.toString();});
  let pid;
  try {
    await client.connect(transport);
    pid=transport.pid;
    assert.ok(Number.isInteger(pid));
    await run(client);
  } finally {
    await client.close();
    await transport.close();
    assert.equal(transport.pid,null);
    if (pid) assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
  }
  assert.equal(stderr,'');
}

test('real stdio initialization and exact five-tool discovery', {timeout:15000}, async () => {
  await withClient(async client => {
    const {tools}=await client.listTools();
    assert.deepEqual(tools.map(tool=>tool.name).sort(),[...toolNames].sort());
    const fields={
      ziwei_chart:['birthDate','hour','minute','gender','referenceDate'],
      ziwei_overlay:['birthDate','hour','minute','gender','scope','targetDate','month','targetHour','targetMinute'],
      bazi_chart:['birthDate','hour','minute','gender'],
      cross_sihua:['a','b','referenceDate','levels','month','targetDate'],
      finance_chart:['birthDate','hour','minute','gender','referenceDate'],
    };
    const required={
      ziwei_chart:['birthDate','hour','gender'],bazi_chart:['birthDate','hour','gender'],
      finance_chart:['birthDate','hour','gender'],ziwei_overlay:['birthDate','hour','gender','scope','targetDate'],
      cross_sihua:['a','b','referenceDate'],
    };
    for (const tool of tools) {
      const schema=tool.inputSchema;
      assert.equal(schema.type,'object');
      assert.equal(schema.additionalProperties,false);
      assert.deepEqual(Object.keys(schema.properties).sort(),fields[tool.name].sort());
      assert.deepEqual([...schema.required].sort(),required[tool.name].sort());
      assert.equal(schema.anyOf,undefined);
      assert.equal(schema.oneOf,undefined);
      if (tool.name === 'cross_sihua') {
        for (const side of ['a','b']) {
          assert.equal(schema.properties[side].additionalProperties,false);
          assert.deepEqual(Object.keys(schema.properties[side].properties).sort(),['birthDate','gender','hour','minute']);
          assert.deepEqual([...schema.properties[side].required].sort(),['birthDate','gender','hour']);
        }
        assert.deepEqual(schema.properties.levels.items.enum,levels);
        assert.equal(schema.properties.levels.minItems,1);
      } else {
        assert.equal(schema.properties.hour.type,'integer');
        assert.equal(schema.properties.hour.minimum,0);
        assert.equal(schema.properties.hour.maximum,23);
        assert.equal(schema.properties.minute.maximum,59);
        assert.equal(schema.properties.birthDate.pattern,'^\\d{4}-\\d{2}-\\d{2}$');
      }
      assert.equal(tool.annotations.readOnlyHint,true);
      assert.equal(tool.annotations.openWorldHint,false);
    }
    const overlay=tools.find(tool=>tool.name === 'ziwei_overlay');
    assert.deepEqual(overlay.inputSchema.properties.scope.enum,['year','month','day']);
    for (const name of ['ziwei_overlay','cross_sihua']) {
      const tool=tools.find(tool=>tool.name === name);
      assert.match(tool.inputSchema.properties.month.description,/Doujun-order/);
      assert.match(tool.description,/requires.*month|month=explicit/);
    }
  });
});

async function assertWire(client,name,input,expected) {
  const result=await client.callTool({name,arguments:input});
  assert.notEqual(result.isError,true,name);
  assert.deepEqual(result.structuredContent,expected,name);
  assert.equal(result.content.length,1);
  assert.equal(result.content[0].type,'text');
  assert.deepEqual(JSON.parse(result.content[0].text),expected,name);
  root.assertJsonData(result.structuredContent);
  return result.structuredContent;
}

test('declared bin symlink initializes, lists and calls through node and executable shebang', {timeout:15000}, async t=>{
  const directory=await mkdtemp(join(tmpdir(),'destiny-telling-bin-smoke-'));
  const entry=join(directory,'destiny-telling-mcp');
  try {
    await symlink(serverPath,entry);
    for (const launch of [{command:process.execPath,args:[entry]},{command:entry,args:[]}]) {
      await withClient(async client=>{
        const {tools}=await client.listTools();
        assert.deepEqual(tools.map(tool=>tool.name).sort(),[...toolNames].sort());
        await assertWire(client,'bazi_chart',births[0],root.calculateBaziJson(births[0]));
      },launch);
    }
  } finally {
    await rm(directory,{recursive:true});
  }
  await assert.rejects(lstat(directory),{code:'ENOENT'});
  t.diagnostic('node-symlink and executable-shebang MCP initialize/list/call passed; both children reaped; owned temporary directory removed');
});

test('all five real wire tools equal complete public calculator envelopes', {timeout:15000}, async t=>{
  let calls=0;
  await withClient(async client=>{
    const birth=births[0], dated={...birth,referenceDate};
    const cases=[
      ['ziwei_chart',dated,root.calculateChartJson(dated)],
      ['bazi_chart',birth,root.calculateBaziJson(birth)],
      ['finance_chart',dated,root.calculateFinanceJson(dated)],
      ['ziwei_overlay',{...birth,scope:'year',targetDate:referenceDate},root.calculateTransitOverlayJson(dated)],
      ['cross_sihua',{a:births[2],b:births[3],referenceDate},root.calculateCrossSihuaJson({a:births[2],b:births[3],referenceDate})],
    ];
    for (const [name,input,expected] of cases) {await assertWire(client,name,input,expected);calls++;}
    const {minute,...noMinute}=birth;
    await assertWire(client,'bazi_chart',noMinute,root.calculateBaziJson(noMinute));calls++;
    assert.equal(root.calculateBaziJson(noMinute).input.minute,0);
    for (const [name,calculate] of [['ziwei_chart',root.calculateChartJson],['finance_chart',root.calculateFinanceJson]]) {
      const result=await client.callTool({name,arguments:noMinute});calls++;
      assert.notEqual(result.isError,true);
      assert.equal(root.normalizeDate(result.structuredContent.referenceDate),result.structuredContent.referenceDate);
      const expected=calculate({...noMinute,referenceDate:result.structuredContent.referenceDate});
      assert.deepEqual(result.structuredContent,expected);
      assert.deepEqual(JSON.parse(result.content[0].text),expected);
    }
  });
  t.diagnostic(`live success calls: ${calls}; all five names, omitted-minute and actual-local-date defaults`);
});

test('wire overlay year/month/day, all 12 explicit Doujun months and retained minute limitations', {timeout:15000}, async t=>{
  let calls=0;
  await withClient(async client=>{
    const birth=births[1],dated={...birth,referenceDate};
    const all=await assertWire(client,'ziwei_overlay',{...birth,scope:'year',targetDate:referenceDate},root.calculateTransitOverlayJson(dated));calls++;
    assert.equal(Object.keys(all.data.monthly).length,12);
    for (let month=1;month<=12;month++) {
      const result=await assertWire(client,'ziwei_overlay',{...birth,scope:'month',targetDate:referenceDate,month},root.calculateTransitOverlayJson({...dated,months:[month]}));calls++;
      assert.deepEqual(Object.keys(result.data.monthly),[String(month)]);
      assert.deepEqual(result.data.monthly[month],all.data.monthly[month]);
    }
    const daily=await assertWire(client,'ziwei_overlay',{...birth,scope:'day',targetDate:referenceDate},root.calculateDayHourOverlayJson({...birth,targetDate:referenceDate}));calls++;
    assert.equal(daily.data.hourly,null);
    for (const targetMinute of [0,59]) {
      const input={...birth,targetDate:referenceDate,targetHour:23,targetMinute};
      const result=await assertWire(client,'ziwei_overlay',{...input,scope:'day'},root.calculateDayHourOverlayJson(input));calls++;
      assert.equal(result.data.hourly.zhi,'子');
      assert.ok(result.limitations.includes('UPSTREAM_TARGET_MINUTE_NOT_APPLIED'));
    }
  });
  t.diagnostic(`live overlay calls: ${calls}; year + 12 months + day + hour at minute 0/59`);
});

test('wire cross all eight temporal layers, each single level, and missing historical decades', {timeout:15000}, async t=>{
  let calls=0;
  await withClient(async client=>{
    const base={a:births[2],b:births[3],referenceDate};
    const input={...base,levels,month:6,targetDate:'2026-10-25'};
    const all=await assertWire(client,'cross_sihua',input,root.calculateCrossSihuaJson(input));calls++;
    for (const direction of ['aToB','bToA']) {
      for (const code of ['L1','L2','L3','L3b','L3c','L4','L5','L6']) {
        assert.ok(all.data.flights[direction].some(f=>f.layer===code),`${direction} ${code} must be nonempty`);
      }
      t.diagnostic(JSON.stringify({direction,counts:Object.fromEntries(['L1','L2','L3','L3b','L3c','L4','L5','L6'].map(code=>[code,all.data.flights[direction].filter(f=>f.layer===code).length]))}));
    }
    const codes={natal:'L1',palace:'L2',decadal:'L3',yearly:'L4',pastDecadal:'L3b',pastDecadal2:'L3c',monthly:'L5',daily:'L6'};
    for (const level of levels) {
      const selected={...base,levels:[level],...(level==='monthly'?{month:6}:{}),...(level==='daily'?{targetDate:input.targetDate}:{})};
      const result=await assertWire(client,'cross_sihua',selected,root.calculateCrossSihuaJson(selected));calls++;
      for (const direction of ['aToB','bToA']) assert.deepEqual(result.data.flights[direction],all.data.flights[direction].filter(f=>f.layer===codes[level]));
    }
    const missing={a:births[2],b:births[1],referenceDate,levels:['pastDecadal','pastDecadal2']};
    const result=await assertWire(client,'cross_sihua',missing,root.calculateCrossSihuaJson(missing));calls++;
    assert.ok(result.data.flights.aToB.some(f=>f.layer==='L3b'));
    assert.ok(result.data.flights.aToB.some(f=>f.layer==='L3c'));
    assert.deepEqual(result.data.flights.bToA,[]);
  });
  t.diagnostic(`live cross temporal calls: ${calls}`);
});

test('live validation rejects calendar/time/unknown/unused/deep fields without payload echoes and recovers', {timeout:15000}, async t=>{
  const birth=births[0],pair={a:births[2],b:births[3],referenceDate};
  const invalid=[];
  for (const name of ['ziwei_chart','bazi_chart','finance_chart']) {
    const base={...birth,...(name==='bazi_chart'?{}:{referenceDate})};
    for (const change of [
      {birthDate:'2001-02-29'},{birthDate:'1900-02-29'},{birthDate:'0000-01-01'},
      {birthDate:'2001-04-31'},{birthDate:'2001-00-01'},{birthDate:'2001-03-00'},
      {birthDate:'2001-3-07'},{birthDate:'2001-03-07T00:00:00Z'},
      {hour:-1},{hour:24},{hour:1.5},{hour:'6'},{hour:null},
      {minute:-1},{minute:60},{minute:0.5},{minute:'10'},{minute:null},
      {gender:'M'},{gender:null},{name:'REJECTED_VALUE_MARKER'},
      {timezone:'REJECTED_VALUE_MARKER'},{unused:{nested:'REJECTED_VALUE_MARKER'}},
    ]) invalid.push([name,{...base,...change}]);
    for (const key of ['birthDate','hour','gender']) {
      const missing={...base};delete missing[key];invalid.push([name,missing]);
    }
    invalid.push([name,{}]);
    if (name!=='bazi_chart') for (const referenceDate of ['2025-02-29','2026-04-31','0000-01-01',null,123]) invalid.push([name,{...base,referenceDate}]);
    else invalid.push([name,{...base,referenceDate}]);
  }
  const targetDate=referenceDate;
  for (const change of [
    {scope:'month'}, {scope:'month',month:0}, {scope:'month',month:13},
    {scope:'month',month:1.5},{scope:'month',month:'6'}, {scope:'month',month:null},
    {scope:'year',month:6},{scope:'day',month:6},{scope:'year',targetHour:0},
    {scope:'year',targetMinute:0},{scope:'month',month:6,targetHour:0},
    {scope:'month',month:6,targetMinute:0},{scope:'day',targetMinute:0},
    {scope:'day',targetHour:24},{scope:'day',targetHour:0.5},
    {scope:'day',targetHour:'1'},{scope:'day',targetHour:0,targetMinute:60},
    {scope:'day',targetHour:0,targetMinute:'1'}, {scope:'day',targetHour:null},
    {scope:'day',targetDate:'2026-02-30'}, {scope:'year',targetDate:'1900-02-29'},
    {scope:'unknown'}, {scope:null}, {scope:'year',referenceDate},
    {scope:'day',extra:{nested:'REJECTED_VALUE_MARKER'}},
  ]) invalid.push(['ziwei_overlay',{...birth,scope:'year',targetDate,...change}]);
  invalid.push(['ziwei_overlay',{...birth,scope:'year'}]);
  for (const change of [
    {referenceDate:'2025-02-29'},{referenceDate:null},{levels:[]},
    {levels:['natal','natal']},{levels:['unknown']},{levels:'natal'},{levels:[null]},
    {levels:['monthly']},{levels:['monthly'],targetDate},{levels:['monthly'],month:13},
    {levels:['monthly'],month:0},{levels:['monthly'],month:'6'},{levels:['daily']},
    {levels:['daily'],month:6},{levels:['daily'],targetDate:'2026-02-30'},
    {month:6},{targetDate},{levels:['monthly'],month:6,targetDate},
    {levels:['daily'],targetDate,month:6},{nameA:'REJECTED_VALUE_MARKER'},
    {a:{...pair.a,name:'REJECTED_VALUE_MARKER'}},
    {b:{...pair.b,unused:{nested:'REJECTED_VALUE_MARKER'}}},
    {a:{...pair.a,hour:'0'}},{b:{...pair.b,minute:60}},
    {a:null},{b:[]},{a:{...pair.a,birthDate:'1975-02-29'}},
  ]) invalid.push(['cross_sihua',{...pair,...change}]);
  for (const key of ['a','b','referenceDate']) {const missing={...pair};delete missing[key];invalid.push(['cross_sihua',missing]);}
  invalid.push(['ziwei_chart',{...birth,[JSON.stringify(birth)]:'REJECTED_VALUE_MARKER'}]);
  await withClient(async client=>{
    for (const [name,input] of invalid) {
      const result=await client.callTool({name,arguments:input});
      assert.equal(result.isError,true,`${name} must reject invalid arguments`);
      assert.equal(result.structuredContent,undefined);
      assert.ok(result.content.length>0);
      const text=result.content.map(c=>c.text??'').join('\n');
      assert.ok(!text.includes('REJECTED_VALUE_MARKER'));
      for (const {birthDate} of births) assert.ok(!text.includes(birthDate),'must not echo a birth date');
      assert.ok(!text.includes(JSON.stringify(input)),'must not echo entire input');
    }
    await assertWire(client,'ziwei_chart',{...birth,referenceDate:'2024-02-29'},root.calculateChartJson({...birth,referenceDate:'2024-02-29'}));
  });
  t.diagnostic(`live rejected calls: ${invalid.length}; one valid leap-date recovery call`);
});

test('owned raw stdio child emits only complete JSON-RPC lines and exits cleanly on EOF', {timeout:15000}, async t=>{
  const child=spawn(process.execPath,[serverPath],{cwd,env:getDefaultEnvironment(),stdio:['pipe','pipe','pipe']});
  const closed=once(child,'close');
  const pending=new Map(),messages=[];
  let buffer='',stderr='',parseError;
  child.stderr.on('data',chunk=>{stderr+=chunk.toString();});
  child.stdout.setEncoding('utf8');
  child.stdout.on('data',chunk=>{
    buffer+=chunk;
    let end;
    while ((end=buffer.indexOf('\n'))!==-1) {
      const line=buffer.slice(0,end);buffer=buffer.slice(end+1);
      try {
        const message=JSON.parse(line);
        assert.equal(message.jsonrpc,'2.0');
        assert.ok(Object.hasOwn(message,'id') || typeof message.method==='string');
        messages.push(message);
        const waiting=pending.get(message.id);
        if (waiting) {pending.delete(message.id);clearTimeout(waiting.timer);waiting.resolve(message);}
      } catch (error) {
        parseError=error;
        for (const waiting of pending.values()) {clearTimeout(waiting.timer);waiting.reject(error);}
        pending.clear();
      }
    }
  });
  const send=(id,method,params)=>new Promise((resolve,reject)=>{
    if (parseError) {reject(parseError);return;}
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Owned child response deadline'));},5000);
    pending.set(id,{resolve,reject,timer});
    child.stdin.write(`${JSON.stringify({jsonrpc:'2.0',id,method,...(params===undefined?{}:{params})})}\n`);
  });
  try {
    const initialized=await send(1,'initialize',{protocolVersion:LATEST_PROTOCOL_VERSION,capabilities:{},clientInfo:{name:'raw-protocol-test',version:'0.1.0'}});
    assert.ok(initialized.result.capabilities.tools);
    child.stdin.write(`${JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})}\n`);
    const listed=await send(2,'tools/list');
    assert.deepEqual(listed.result.tools.map(tool=>tool.name).sort(),[...toolNames].sort());
    const result=await send(3,'tools/call',{name:'bazi_chart',arguments:births[0]});
    assert.deepEqual(result.result.structuredContent,root.calculateBaziJson(births[0]));
    assert.deepEqual(JSON.parse(result.result.content[0].text),result.result.structuredContent);
    const invalid=await send(4,'tools/call',{name:'ziwei_overlay',arguments:{...births[0],scope:'month',targetDate:referenceDate}});
    assert.equal(invalid.result.isError,true);
    child.stdin.end();
    const [code,signal]=await closed;
    assert.equal(code,0);assert.equal(signal,null);
    assert.equal(parseError,undefined);
    assert.equal(buffer,'');assert.equal(stderr,'');
    assert.equal(messages.length,4);
    assert.deepEqual(messages.map(message=>message.id),[1,2,3,4]);
    assert.throws(()=>process.kill(child.pid,0),{code:'ESRCH'});
    t.diagnostic(`raw stdout JSON-RPC lines: ${messages.length}; exit ${code}; no stderr/trailing bytes; child reaped`);
  } finally {
    for (const waiting of pending.values()) {clearTimeout(waiting.timer);waiting.reject(new Error('Owned child cleanup'));}
    pending.clear();
    if (child.exitCode===null && child.signalCode===null) child.kill('SIGTERM');
    await closed;
  }
});
