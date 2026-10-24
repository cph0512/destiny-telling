import { calculateChartJson, getMonthlySihuaStars, getDailySihuaStars, getDecadalSihuaStarsAtOffset } from './ziwei.js';
import { assertKeys, normalizeBirthInput, normalizeDate, createJsonEnvelope } from './json-envelope.js';

const DI_ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const HUA_ORDER = ['化祿','化權','化科','化忌'];
const DEFAULT_LEVELS = ['natal','palace','decadal','yearly'];
const LAYER_META = {
  L1:{key:'natal',label:'本命四化 (生年干)'},L2:{key:'palace',label:'宮干飛化'},
  L3:{key:'decadal',label:'當前大限四化'},L3b:{key:'pastDecadal',label:'上一大限四化'},
  L3c:{key:'pastDecadal2',label:'再上一大限四化'},L4:{key:'yearly',label:'流年四化'},
  L5:{key:'monthly',label:'流月四化'},L6:{key:'daily',label:'流日四化'},
};
function findStarPalace(chart,starName) {
  for (const zhi of DI_ZHI) {
    const g=chart.gongs?.[zhi];
    if (g && (g.stars || []).includes(starName)) return {zhi,name:g.name,kind:'major'};
  }
  for (const zhi of DI_ZHI) {
    const g=chart.gongs?.[zhi];
    if (g && (g.minor || []).includes(starName)) return {zhi,name:g.name,kind:'minor'};
  }
  return null;
}
function parseSihuaEntry(entry) {
  if (!entry || typeof entry !== 'string') return null;
  for (const hua of HUA_ORDER) if (entry.endsWith(hua)) return {star:entry.slice(0,-hua.length),hua};
  return null;
}
function layerNatal(srcChart,dstChart,srcName) {
  const out=[];
  for (const [star,hua] of Object.entries(srcChart.siHua || {})) {
    const huaFull=hua.startsWith('化') ? hua : `化${hua}`, dst=findStarPalace(dstChart,star);
    if (!dst) continue;
    out.push({layer:'L1',layerLabel:LAYER_META.L1.label,sourceLabel:`${srcName} 生年`,fromPalace:null,star,hua:huaFull,toPalace:dst.name,toPalaceZhi:dst.zhi,starKind:dst.kind});
  }
  return out;
}
function layerPalace(srcChart,dstChart,srcName) {
  const out=[];
  for (const zhi of DI_ZHI) {
    const fh=(srcChart.feiHua || {})[zhi], srcGong=srcChart.gongs?.[zhi];
    if (!fh || !srcGong) continue;
    for (let i=0;i<4;i++) {
      const parsed=parseSihuaEntry(fh.sihua?.[i]);
      if (!parsed) continue;
      const dst=findStarPalace(dstChart,parsed.star);
      if (!dst) continue;
      out.push({layer:'L2',layerLabel:LAYER_META.L2.label,sourceLabel:`${srcName} ${srcGong.name}(${fh.gan}干)`,fromPalace:srcGong.name,fromPalaceZhi:zhi,fromGan:fh.gan,star:parsed.star,hua:HUA_ORDER[i],toPalace:dst.name,toPalaceZhi:dst.zhi,starKind:dst.kind});
    }
  }
  return out;
}
function layerFromSihuaArray(srcChart,dstChart,srcName,sihuaArr,layerCode,srcLabel) {
  const out=[];
  if (!Array.isArray(sihuaArr)) return out;
  for (let i=0;i<Math.min(4,sihuaArr.length);i++) {
    const star=sihuaArr[i];
    if (!star) continue;
    const dst=findStarPalace(dstChart,star);
    if (!dst) continue;
    out.push({layer:layerCode,layerLabel:LAYER_META[layerCode].label,sourceLabel:`${srcName} ${srcLabel}`,fromPalace:null,star,hua:HUA_ORDER[i],toPalace:dst.name,toPalaceZhi:dst.zhi,starKind:dst.kind});
  }
  return out;
}
function layerDecadal(srcChart,dstChart,srcName) {
  const h=srcChart.horoscope?.decadal;
  return h ? layerFromSihuaArray(srcChart,dstChart,srcName,h.sihua,'L3',`當前大限${h.ganZhi || ''}`) : [];
}
function layerYearly(srcChart,dstChart,srcName) {
  const h=srcChart.horoscope?.yearly;
  return h ? layerFromSihuaArray(srcChart,dstChart,srcName,h.sihua,'L4',`流年${h.ganZhi || ''}`) : [];
}
function runDirection(srcChart,dstChart,srcName,levels,extras={}) {
  const want=new Set(levels), flights=[];
  if (want.has('natal')) flights.push(...layerNatal(srcChart,dstChart,srcName));
  if (want.has('palace')) flights.push(...layerPalace(srcChart,dstChart,srcName));
  if (want.has('decadal')) flights.push(...layerDecadal(srcChart,dstChart,srcName));
  if (want.has('yearly')) flights.push(...layerYearly(srcChart,dstChart,srcName));
  const side=srcName === extras.nameA ? 'a' : 'b';
  for (const [level,field,code,labelField,fallback] of [
    ['pastDecadal','pastDecadalSihua','L3b','pastDecadalLabel','上一大限'],
    ['pastDecadal2','pastDecadal2Sihua','L3c','pastDecadal2Label','再上一大限'],
    ['monthly','monthlySihua','L5','monthlyLabel','流月'],
    ['daily','dailySihua','L6','dailyLabel','流日'],
  ]) if (want.has(level) && Array.isArray(extras[field]?.[side])) flights.push(...layerFromSihuaArray(srcChart,dstChart,srcName,extras[field][side],code,extras[labelField] || fallback));
  return flights;
}
function buildSummary(flights,{nameA,nameB,levels}) {
  let text=`交叉飛化\n層級：${levels.join('、')}\n`;
  for (const [key,src,dst] of [['aToB',nameA,nameB],['bToA',nameB,nameA]]) {
    text+=`${src} → ${dst}\n`;
    for (const f of flights[key]) text+=`${f.layer} ${f.layerLabel} ${f.sourceLabel} ${f.star}${f.hua} → ${f.toPalace}(${f.toPalaceZhi})\n`;
  }
  return text.trimEnd();
}
export function calculateCrossSihua(chartA,chartB,opts={}) {
  const {levels=DEFAULT_LEVELS,nameA='甲方',nameB='乙方'}=opts;
  const extras={nameA,nameB,pastDecadalSihua:opts.pastDecadalSihua,pastDecadalLabel:opts.pastDecadalLabel,pastDecadal2Sihua:opts.pastDecadal2Sihua,pastDecadal2Label:opts.pastDecadal2Label,monthlySihua:opts.monthlySihua,dailySihua:opts.dailySihua,monthlyLabel:opts.monthlyLabel,dailyLabel:opts.dailyLabel};
  const flights={aToB:runDirection(chartA,chartB,nameA,levels,extras),bToA:runDirection(chartB,chartA,nameB,levels,extras)};
  return {flights,summary:buildSummary(flights,{nameA,nameB,levels}),meta:{levels,nameA,nameB}};
}
export function calculateCrossSihuaJson(input) {
  assertKeys(input,['a','b','referenceDate','levels','month','targetDate']);
  const a=normalizeBirthInput(input.a), b=normalizeBirthInput(input.b), referenceDate=normalizeDate(input.referenceDate);
  const levels=input.levels === undefined ? [...DEFAULT_LEVELS] : input.levels;
  const allowed=Object.values(LAYER_META).map(v=>v.key);
  if (!Array.isArray(levels) || !levels.length || new Set(levels).size !== levels.length) throw new TypeError('levels must be a nonempty unique array');
  for (const level of levels) if (!allowed.includes(level)) throw new TypeError('Unknown cross level');
  if (!levels.includes('monthly') && Object.hasOwn(input,'month')) throw new TypeError('month requires monthly level');
  if (!levels.includes('daily') && Object.hasOwn(input,'targetDate')) throw new TypeError('targetDate requires daily level');
  if (levels.includes('monthly') && (!Number.isInteger(input.month) || input.month<1 || input.month>12)) throw new RangeError('monthly requires month 1 to 12 in Doujun order');
  const targetDate=levels.includes('daily') ? normalizeDate(input.targetDate) : null;
  const A=calculateChartJson({...a,referenceDate}).data, B=calculateChartJson({...b,referenceDate}).data;
  const opts={levels:[...levels],nameA:'甲方',nameB:'乙方'};
  if (levels.includes('monthly')) opts.monthlySihua={a:getMonthlySihuaStars(A,input.month),b:getMonthlySihuaStars(B,input.month)};
  if (levels.includes('daily')) {
    const parts=targetDate.split('-').map(Number);
    opts.dailySihua={a:getDailySihuaStars(A,...parts),b:getDailySihuaStars(B,...parts)};
  }
  if (levels.includes('pastDecadal')) opts.pastDecadalSihua={a:getDecadalSihuaStarsAtOffset(A,-1)?.stars,b:getDecadalSihuaStarsAtOffset(B,-1)?.stars};
  if (levels.includes('pastDecadal2')) opts.pastDecadal2Sihua={a:getDecadalSihuaStarsAtOffset(A,-2)?.stars,b:getDecadalSihuaStarsAtOffset(B,-2)?.stars};
  const {flights,meta}=calculateCrossSihua(A,B,opts);
  return createJsonEnvelope('cross.sihua',{a,b,levels:[...levels],...(levels.includes('monthly') ? {month:input.month} : {}),...(targetDate ? {targetDate} : {})},{flights,meta},{referenceDate,omitted:['summary'],limitations:['UPSTREAM_ZIWEI_BIRTH_MINUTE_NOT_APPLIED','MONTHS_ARE_DOUJUN_ORDER_NOT_CALENDAR_CONVERSION','MISSING_HISTORICAL_DECADES_PRODUCE_NO_FLIGHTS']});
}
export const __internals={findStarPalace,parseSihuaEntry,layerNatal,layerPalace,layerDecadal,layerYearly,DI_ZHI,HUA_ORDER,LAYER_META};
