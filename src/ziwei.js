import { astro } from './iztro-north.js';
import { assertKeys, birthFromParts, normalizeBirthInput, normalizeDate, createJsonEnvelope } from './json-envelope.js';

export const SHI_CHEN_RANGE = ['子 (23:00-01:00)','丑 (01:00-03:00)','寅 (03:00-05:00)','卯 (05:00-07:00)','辰 (07:00-09:00)','巳 (09:00-11:00)','午 (11:00-13:00)','未 (13:00-15:00)','申 (15:00-17:00)','酉 (17:00-19:00)','戌 (19:00-21:00)','亥 (21:00-23:00)'];
export const DI_ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
export const TIAN_GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const SC2TC = {
  '贪狼':'貪狼','巨门':'巨門','禄存':'祿存','文曲':'文曲','廉贞':'廉貞',
  '武曲':'武曲','破军':'破軍','天机':'天機','太阳':'太陽','天同':'天同',
  '天梁':'天梁','紫微':'紫微','太阴':'太陰','七杀':'七殺','天相':'天相',
  '天府':'天府','左辅':'左輔','右弼':'右弼','文昌':'文昌',
  '火星':'火星','铃星':'鈴星','擎羊':'擎羊','陀罗':'陀羅',
  '天魁':'天魁','天钺':'天鉞','地空':'地空','地劫':'地劫',
  '天马':'天馬','天姚':'天姚','天刑':'天刑','化禄':'化祿',
  '化权':'化權','化科':'化科','化忌':'化忌',
  '命宫':'命宮','兄弟':'兄弟宮','夫妻':'夫妻宮','子女':'子女宮',
  '财帛':'財帛宮','疾厄':'疾厄宮','迁移':'遷移宮','仆役':'交友宮',
  '官禄':'官祿宮','田宅':'田宅宮','福德':'福德宮','父母':'父母宮',
  '庙':'廟','旺':'旺','得':'得','利':'利','平':'平','不':'不','陷':'陷',
  '禄':'祿','权':'權','科':'科','忌':'忌',
  '水二局':'水二局','木三局':'木三局','金四局':'金四局','土五局':'土五局','火六局':'火六局',
  '长生':'長生','沐浴':'沐浴','冠带':'冠帶','临官':'臨官','帝旺':'帝旺',
  '衰':'衰','病':'病','死':'死','墓':'墓','绝':'絕','胎':'胎','养':'養',
};
function toTC(str) {
  if (!str) return str;
  let result = str;
  for (const k of Object.keys(SC2TC).sort((a,b)=>b.length-a.length)) result = result.replaceAll(k,SC2TC[k]);
  return result;
}
const PALACE_NAME_MAP = {
  '命宫':'命宮','命宮':'命宮','兄弟':'兄弟宮','兄弟宮':'兄弟宮',
  '夫妻':'夫妻宮','夫妻宮':'夫妻宮','子女':'子女宮','子女宮':'子女宮',
  '财帛':'財帛宮','財帛宮':'財帛宮','财帛宮':'財帛宮',
  '疾厄':'疾厄宮','疾厄宮':'疾厄宮','迁移':'遷移宮','遷移宮':'遷移宮','迁移宮':'遷移宮',
  '仆役':'交友宮','交友宮':'交友宮','仆役宮':'交友宮',
  '官禄':'官祿宮','官祿宮':'官祿宮','官禄宮':'官祿宮',
  '田宅':'田宅宮','田宅宮':'田宅宮','福德':'福德宮','福德宮':'福德宮','父母':'父母宮','父母宮':'父母宮',
};
const normPalace = n => PALACE_NAME_MAP[n] || toTC(n);
const SI_HUA_TABLE = {
  '甲':['廉貞','破軍','武曲','太陽'],'乙':['天機','天梁','紫微','太陰'],
  '丙':['天同','天機','文昌','廉貞'],'丁':['太陰','天同','天機','巨門'],
  '戊':['貪狼','太陰','右弼','天機'],'己':['武曲','貪狼','天梁','文曲'],
  '庚':['太陽','武曲','天同','天相'],'辛':['巨門','太陽','文曲','文昌'],
  '壬':['天梁','紫微','左輔','武曲'],'癸':['破軍','巨門','太陰','貪狼'],
};
const HUA_NAMES = ['化祿','化權','化科','化忌'];
const fullSihua = gan => SI_HUA_TABLE[gan]?.map((s,i)=>s+HUA_NAMES[i]);
const hourToShiChenIdx = hour => hour >= 23 || hour < 1 ? 0 : Math.floor((hour+1)/2);
const BIRTH_KEYS = ['birthDate','hour','minute','gender'];
const MINUTE_LIMIT = 'UPSTREAM_ZIWEI_BIRTH_MINUTE_NOT_APPLIED';
function birthFields(input) {
  return normalizeBirthInput(Object.fromEntries(BIRTH_KEYS.filter(k=>Object.hasOwn(input,k)).map(k=>[k,input[k]])));
}
function referenceDate(options) {
  assertKeys(options,['referenceDate']);
  if (options.referenceDate !== undefined) return normalizeDate(options.referenceDate);
  const now = new Date();
  return normalizeDate(`${String(now.getFullYear()).padStart(4,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`);
}
function chartForBirth(birth,date) {
  return calculateChart(...birth.birthDate.split('-').map(Number),birth.hour,birth.minute,birth.gender,{referenceDate:date});
}

export function calculateChart(solarYear,solarMonth,solarDay,hour,minute,gender,options={}) {
  birthFromParts(solarYear,solarMonth,solarDay,hour,gender,minute);
  const date = referenceDate(options);
  const shiChenIdx = hourToShiChenIdx(hour);
  const result = astro.bySolar(`${solarYear}-${solarMonth}-${solarDay}`,shiChenIdx,gender === '男' ? '男' : '女');
  const gongs = {}, gongGan = {}, daXian = [], siHua = {};
  let mingGongZhi = '', mingGongGan = '', shenGongName = '';
  for (const p of result.palaces) {
    const zhi = toTC(p.earthlyBranch), gan = toTC(p.heavenlyStem), name = normPalace(p.name);
    gongGan[zhi] = gan;
    const stars = [], minor = [], sihua = [];
    for (const [list,target] of [[p.majorStars || [],stars],[p.minorStars || [],minor]]) {
      for (const s of list) {
        const star = toTC(s.name);
        target.push(star);
        if (s.mutagen) { const hua = toTC(s.mutagen); sihua.push(star+hua); siHua[star] = hua; }
      }
    }
    gongs[zhi] = {name,stars,minor,sihua,changSheng:p.changsheng12 ? toTC(p.changsheng12) : ''};
    if (name === '命宮') { mingGongZhi = zhi; mingGongGan = gan; }
    if (p.decadal) daXian.push({zhi,startAge:p.decadal.range[0],endAge:p.decadal.range[1]});
    if (p.isBodyPalace) shenGongName = name;
  }
  const yearGanZhi = (result.chineseDate || '').split(' ')[0] || '';
  const feiHua = {};
  for (const zhi of DI_ZHI) if (gongGan[zhi] && SI_HUA_TABLE[gongGan[zhi]]) feiHua[zhi] = {gan:gongGan[zhi],sihua:fullSihua(gongGan[zhi])};
  let horoscope = null;
  try {
    const h = result.horoscope(date), benPalaceMap = {};
    for (const p of result.palaces) benPalaceMap[toTC(p.earthlyBranch)] = normPalace(p.name);
    const period = p => ({ganZhi:toTC(p.heavenlyStem)+toTC(p.earthlyBranch),sihua:(p.mutagen || []).map(toTC),mingGongZhi:toTC(p.earthlyBranch),dieBenGong:benPalaceMap[toTC(p.earthlyBranch)] || '',palaceNames:(p.palaceNames || []).map(normPalace)});
    horoscope = {
      decadal:period(h.decadal),yearly:period(h.yearly),
      age:{nominalAge:h.age?.nominalAge || 0,ganZhi:toTC((h.age?.heavenlyStem || '')+(h.age?.earthlyBranch || '')),sihua:(h.age?.mutagen || []).map(toTC),dieBenGong:benPalaceMap[toTC(h.age?.earthlyBranch || '')] || ''},
    };
  } catch { /* Upstream returns null when horoscope is unavailable. */ }
  return {
    basic:{solarDate:`${solarYear}年${solarMonth}月${solarDay}日`,lunarDate:`農曆${result.lunarDate}`,yearGanZhi,shiChen:DI_ZHI[shiChenIdx],gender,yinYang:TIAN_GAN.indexOf(yearGanZhi[0])%2 === 0 ? '陽' : '陰',mingGong:mingGongGan+mingGongZhi,mingGongZhi,shenGong:shenGongName,commandStar:result.soul ? toTC(result.soul) : '',bodyStar:result.body ? toTC(result.body) : '',wuXingJu:toTC(result.fiveElementsClass),lunarMonth:result.rawDates?.lunarDate?.lunarMonth || 0,shiChenIdx},
    gongs,gongGan,daXian,siHua,feiHua,horoscope,
  };
}
const TIGER_MAP = {'甲':'丙','乙':'戊','丙':'庚','丁':'壬','戊':'甲','己':'丙','庚':'戊','辛':'庚','壬':'壬','癸':'甲'};
const PALACE_ORDER = ['命宮','兄弟宮','夫妻宮','子女宮','財帛宮','疾厄宮','遷移宮','交友宮','官祿宮','田宅宮','福德宮','父母宮'];
function monthGan(yearGan,month) {
  const start = TIGER_MAP[yearGan];
  return start ? TIAN_GAN[(TIAN_GAN.indexOf(start)+month-1)%10] : null;
}
function lookup(chart) {
  const zhiToGong = {};
  for (const zhi of DI_ZHI) if (chart.gongs[zhi]) zhiToGong[zhi] = chart.gongs[zhi].name;
  function findStarZhi(star) {
    for (const zhi of DI_ZHI) {
      const g = chart.gongs[zhi];
      if (!g) continue;
      if (g.stars.includes(star) || g.minor.includes(star)) return zhi;
      if (g.sihua.some(s=>s.startsWith(star))) return zhi;
    }
    return null;
  }
  return {zhiToGong,findStarZhi};
}
export function calculateTransitOverlay(chart,targetYear=null,targetMonths=null) {
  if (!chart || !chart.horoscope) return null;
  const h = chart.horoscope, year = targetYear || new Date().getFullYear();
  const {zhiToGong,findStarZhi} = lookup(chart);
  const zhiToYearlyGong = {}, ynMingIdx = DI_ZHI.indexOf(h.yearly.mingGongZhi);
  for (let i=0;i<12;i++) zhiToYearlyGong[DI_ZHI[(ynMingIdx-i+12)%12]] = PALACE_ORDER[i];
  function dualName(zhi) {
    const ben = zhiToGong[zhi] || '', yn = zhiToYearlyGong[zhi] || '';
    return ben === yn ? ben : `本命${ben}/流年${yn}`;
  }
  const palaceEffects = {};
  for (const zhi of DI_ZHI) palaceEffects[zhi] = {gongName:dualName(zhi),stars:chart.gongs[zhi]?.stars || [],natal:[],decadal:[],yearly:[],monthly:{}};
  for (const [star,hua] of Object.entries(chart.siHua)) {
    const zhi = findStarZhi(star);
    if (zhi) palaceEffects[zhi].natal.push({star,hua,source:'本命'});
  }
  const dxGan = h.decadal.ganZhi?.[0], ynGan = h.yearly.ganZhi?.[0];
  for (const [level,gan,source] of [['decadal',dxGan,`大限(${h.decadal.ganZhi})`],['yearly',ynGan,`流年(${h.yearly.ganZhi})`]]) {
    if (gan && SI_HUA_TABLE[gan]) SI_HUA_TABLE[gan].forEach((star,i)=>{
      const zhi = findStarZhi(star);
      if (zhi) palaceEffects[zhi][level].push({star,hua:HUA_NAMES[i],source});
    });
  }
  const months = targetMonths || [1,2,3,4,5,6,7,8,9,10,11,12];
  const taiSuiIdx = DI_ZHI.indexOf(h.yearly.mingGongZhi), lunarMonth = chart.basic.lunarMonth || 1, shiChenIdx = chart.basic.shiChenIdx || 0;
  const step1Idx = (taiSuiIdx-(lunarMonth-1)+12)%12, douJunIdx = (step1Idx+shiChenIdx)%12;
  const monthly = {};
  for (const m of months) {
    const mingGongZhi = DI_ZHI[(douJunIdx+(m-1))%12], gan = monthGan(ynGan,m), effects = [];
    if (gan && SI_HUA_TABLE[gan]) SI_HUA_TABLE[gan].forEach((star,i)=>{
      const zhi = findStarZhi(star);
      if (zhi) {
        const eff = {star,hua:HUA_NAMES[i],source:`流月${m}月(${gan})`};
        effects.push({...eff,zhi,gongName:dualName(zhi)});
        (palaceEffects[zhi].monthly[m] ||= []).push(eff);
      }
    });
    monthly[m] = {mingGongZhi,dieBenGong:dualName(mingGongZhi),gan,effects};
  }
  const highlights = [];
  for (const zhi of DI_ZHI) {
    const pe = palaceEffects[zhi], all = [...pe.natal,...pe.decadal,...pe.yearly];
    const count = hua => all.filter(e=>e.hua === hua).length;
    const lu = count('化祿'), ji = count('化忌'), quan = count('化權');
    const sources = hua => all.filter(e=>e.hua === hua).map(e=>`${e.source}${e.star}${hua}`).join(' + ');
    if (lu>=2) highlights.push({type:'雙祿',zhi,gongName:pe.gongName,detail:sources('化祿')});
    if (ji>=2) highlights.push({type:'雙忌',zhi,gongName:pe.gongName,detail:sources('化忌')});
    if (lu>=1 && ji>=1) highlights.push({type:'祿忌同宮',zhi,gongName:pe.gongName,detail:`祿忌交會於${pe.gongName}`});
    if (quan>=2) highlights.push({type:'雙權',zhi,gongName:pe.gongName});
    const oppGong = dualName(DI_ZHI[(DI_ZHI.indexOf(zhi)+6)%12]);
    if (ji>=1 && oppGong) highlights.push({type:'化忌沖',zhi,gongName:pe.gongName,targetGong:oppGong,detail:`${pe.gongName}化忌沖${oppGong}`});
    for (const m of months) {
      const combined = [...all,...(pe.monthly[m] || [])];
      if (combined.filter(e=>e.hua === '化祿').length>=3) highlights.push({type:'三祿疊',zhi,gongName:pe.gongName,month:m,detail:`${m}月三祿疊於${pe.gongName}`});
      if (combined.filter(e=>e.hua === '化忌').length>=3) highlights.push({type:'三忌疊',zhi,gongName:pe.gongName,month:m,detail:`${m}月三忌疊於${pe.gongName}`});
    }
  }
  const period = (p,gan) => ({ganZhi:p.ganZhi,mingGongZhi:p.mingGongZhi,dieBenGong:p.dieBenGong,sihua:gan ? SI_HUA_TABLE[gan].map((star,i)=>({star,hua:HUA_NAMES[i],zhi:findStarZhi(star),gongName:zhiToGong[findStarZhi(star)] || ''})) : []});
  return {decadal:period(h.decadal,dxGan),yearly:period(h.yearly,ynGan),monthly,palaceEffects,highlights,summary:`流年標籤：${year}；大限：${h.decadal.ganZhi}；流年：${h.yearly.ganZhi}\n${highlights.map(x=>`${x.type}：${x.detail || x.gongName}`).join('\n')}`,_lookup:{zhiToGong,findStarZhi,dualName,SI_HUA_TABLE,HUA_NAMES}};
}
function validateMonth(month) {
  if (!Number.isInteger(month) || month<1 || month>12) throw new RangeError('month must be an integer from 1 to 12 in Doujun order');
}
export function calculateTransitOverlayJson(input) {
  assertKeys(input,[...BIRTH_KEYS,'referenceDate','months']);
  const birth = birthFields(input), date = normalizeDate(input.referenceDate);
  const months = input.months === undefined ? [1,2,3,4,5,6,7,8,9,10,11,12] : input.months;
  if (!Array.isArray(months) || !months.length || new Set(months).size !== months.length) throw new TypeError('months must be a nonempty unique array');
  months.forEach(validateMonth);
  const raw = calculateTransitOverlay(chartForBirth(birth,date),Number(date.slice(0,4)),months);
  const data = raw === null ? {result:null} : (({summary,_lookup,...rest})=>rest)(raw);
  return createJsonEnvelope('ziwei.transit',{...birth,months:[...months]},data,{referenceDate:date,omitted:['summary','_lookup','highlights[].impact','highlights[type=雙權].detail'],limitations:[MINUTE_LIMIT,'MONTHS_ARE_DOUJUN_ORDER_NOT_CALENDAR_CONVERSION','RAW_TARGET_YEAR_IS_LABEL_ONLY']});
}
export function getMonthlySihuaStars(chart,month) {
  const yearGan = chart?.horoscope?.yearly?.ganZhi?.[0];
  if (!yearGan || month<1 || month>12) return null;
  const startGan = TIGER_MAP[yearGan];
  if (!startGan) return null;
  const gan = TIAN_GAN[(TIAN_GAN.indexOf(startGan)+(month-1))%10];
  return SI_HUA_TABLE[gan] ? [...SI_HUA_TABLE[gan]] : null;
}

const HOUR_START_GAN = {'甲':'甲','己':'甲','乙':'丙','庚':'丙','丙':'戊','辛':'戊','丁':'庚','壬':'庚','戊':'壬','癸':'壬'};
function julianDay(y,m,d) {
  if (m<=2) { y-=1; m+=12; }
  const a = Math.floor(y/100), b = 2-a+Math.floor(a/4);
  return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(m+1))+d+b-1524;
}
function dayGanZhi(y,m,d) {
  const offset = julianDay(y,m,d)-2415021;
  const ganIdx = ((0+offset)%10+10)%10, zhiIdx = ((10+offset)%12+12)%12;
  return {gan:TIAN_GAN[ganIdx],zhi:DI_ZHI[zhiIdx],ganIdx,zhiIdx};
}
function hourGan(dayGan,index) {
  const start = HOUR_START_GAN[dayGan];
  return start ? TIAN_GAN[(TIAN_GAN.indexOf(start)+index)%10] : null;
}
export function calculateDayHourOverlay(chart,year,month,day,hour=null,minute=null) {
  if (!chart || !chart.gongs) return null;
  const {zhiToGong,findStarZhi} = lookup(chart), gongOrPlain = zhi => zhiToGong[zhi] || `${zhi}宮`;
  const {gan:dayGan,zhi:dayZhi} = dayGanZhi(year,month,day);
  const entries = gan => SI_HUA_TABLE[gan] ? SI_HUA_TABLE[gan].map((star,i)=>{
    const zhi = findStarZhi(star);
    return {star,hua:HUA_NAMES[i],zhi,gongName:zhi ? gongOrPlain(zhi) : '（本命無此星）'};
  }) : [];
  const dailySihua = entries(dayGan);
  let hourly = null;
  if (hour !== null && hour !== undefined) {
    const shichenIdx = hourToShiChenIdx(hour), gan = hourGan(dayGan,shichenIdx), zhi = DI_ZHI[shichenIdx];
    hourly = {gan,zhi,shichenIdx,ganZhi:gan ? gan+zhi : null,sihua:entries(gan)};
  }
  const palaceHits = {};
  for (const zhi of DI_ZHI) palaceHits[zhi] = {lu:[],ji:[]};
  for (const [star,hua] of Object.entries(chart.siHua || {})) {
    const z = findStarZhi(star);
    if (!z) continue;
    if (hua === '化祿') palaceHits[z].lu.push(`本命${star}化祿`);
    if (hua === '化忌') palaceHits[z].ji.push(`本命${star}化忌`);
  }
  for (const [list,source] of [[dailySihua,'流日'],[hourly?.sihua || [],'流時']]) for (const s of list) {
    if (!s.zhi) continue;
    if (s.hua === '化祿') palaceHits[s.zhi].lu.push(`${source}${s.star}化祿`);
    if (s.hua === '化忌') palaceHits[s.zhi].ji.push(`${source}${s.star}化忌`);
  }
  const highlights = [];
  for (const zhi of DI_ZHI) {
    const hit = palaceHits[zhi];
    if (hit.lu.length>=2) highlights.push({type:'多祿疊',gongName:gongOrPlain(zhi),detail:hit.lu.join(' + ')});
    if (hit.ji.length>=2) highlights.push({type:'多忌疊',gongName:gongOrPlain(zhi),detail:hit.ji.join(' + ')});
    if (hit.lu.length>=1 && hit.ji.length>=1) highlights.push({type:'祿忌同宮',gongName:gongOrPlain(zhi),detail:`${hit.lu.join(',')} 與 ${hit.ji.join(',')}`});
  }
  return {daily:{gan:dayGan,zhi:dayZhi,ganZhi:dayGan+dayZhi,sihua:dailySihua},hourly,highlights,summary:`日期：${year}/${month}/${day}；流日：${dayGan}${dayZhi}${hourly ? `；流時：${hourly.ganZhi}` : ''}\n${highlights.map(h=>`${h.type}：${h.detail}`).join('\n')}`};
}
export function calculateDayHourOverlayJson(input) {
  assertKeys(input,[...BIRTH_KEYS,'targetDate','targetHour','targetMinute']);
  const birth = birthFields(input), date = normalizeDate(input.targetDate);
  const hasHour = Object.hasOwn(input,'targetHour'), hasMinute = Object.hasOwn(input,'targetMinute');
  if (hasMinute && !hasHour) throw new TypeError('targetMinute requires targetHour');
  if (hasHour && (!Number.isInteger(input.targetHour) || input.targetHour<0 || input.targetHour>23)) throw new RangeError('targetHour must be an integer from 0 to 23');
  if (hasMinute && (!Number.isInteger(input.targetMinute) || input.targetMinute<0 || input.targetMinute>59)) throw new RangeError('targetMinute must be an integer from 0 to 59');
  const raw = calculateDayHourOverlay(chartForBirth(birth,date),...date.split('-').map(Number),hasHour ? input.targetHour : null,hasMinute ? input.targetMinute : null);
  const data = raw === null ? {result:null} : (({summary,...rest})=>rest)(raw);
  return createJsonEnvelope('ziwei.dayhour',{...birth,targetDate:date,...(hasHour ? {targetHour:input.targetHour} : {}),...(hasMinute ? {targetMinute:input.targetMinute} : {})},data,{referenceDate:date,omitted:['summary','highlights[].impact'],limitations:[MINUTE_LIMIT,'UPSTREAM_TARGET_MINUTE_NOT_APPLIED']});
}
export function getDailySihuaStars(chart,year,month,day) {
  const overlay = calculateDayHourOverlay(chart,year,month,day);
  if (!overlay?.daily?.sihua?.length) return null;
  return overlay.daily.sihua.map(s=>s.star);
}
export function getDecadalSihuaStarsAtOffset(chart,offset=0) {
  const daXian = chart?.daXian || [], age = chart?.horoscope?.age?.nominalAge;
  if (!daXian.length || !age) return null;
  const curIdx = daXian.findIndex(dx=>age>=dx.startAge && age<=dx.endAge);
  if (curIdx<0) return null;
  const targetIdx = curIdx+offset;
  if (targetIdx<0 || targetIdx>=daXian.length) return null;
  const target = daXian[targetIdx], gan = chart.gongGan?.[target.zhi];
  if (!gan || !SI_HUA_TABLE[gan]) return {stars:null,gan,zhi:target.zhi,startAge:target.startAge,endAge:target.endAge};
  return {stars:[...SI_HUA_TABLE[gan]],gan,zhi:target.zhi,startAge:target.startAge,endAge:target.endAge};
}

function tianganData(solarYear,solarMonth,solarDay,gender) {
  birthFromParts(solarYear,solarMonth,solarDay,0,gender);
  const ref = astro.bySolar(`${solarYear}-${solarMonth}-${solarDay}`,0,gender === '男' ? '男' : '女');
  const yearGanZhi = (ref.chineseDate || '').split(' ')[0] || '', yearGan = yearGanZhi ? yearGanZhi[0] : '';
  const starMap = {}, feiHua = {};
  for (const p of ref.palaces) starMap[toTC(p.earthlyBranch)] = {gan:toTC(p.heavenlyStem),stars:(p.majorStars || []).map(s=>toTC(s.name))};
  for (const zhi of DI_ZHI) if (starMap[zhi] && SI_HUA_TABLE[toTC(starMap[zhi].gan)]) feiHua[zhi] = {gan:starMap[zhi].gan,sihua:fullSihua(toTC(starMap[zhi].gan))};
  return {solarDate:`${solarYear}年${solarMonth}月${solarDay}日`,lunarDate:ref.lunarDate || '',yearGanZhi,yearGan:toTC(yearGan),gender,referenceShiChenIdx:0,yearSiHua:fullSihua(toTC(yearGan)) || [],starMap,feiHua};
}
export function calculateChartByTianGanJson(input) {
  assertKeys(input,['birthDate','gender']);
  const birth = normalizeBirthInput({...input,hour:0});
  return createJsonEnvelope('ziwei.tiangan',{birthDate:birth.birthDate,gender:birth.gender},tianganData(...birth.birthDate.split('-').map(Number),birth.gender),{limitations:['INDEX0_REFERENCE_CHART_NOT_KNOWN_BIRTHTIME']});
}
export function formatChartByTianGan(solarYear,solarMonth,solarDay,gender) {
  const data = tianganData(solarYear,solarMonth,solarDay,gender);
  let text = `## 紫微斗數天干參考盤\n\n### 基本資料\n- 陽曆：${data.solarDate}\n- 農曆：農曆${data.lunarDate}\n- 年柱：${data.yearGanZhi}年\n- 性別：${gender}\n- 參考時辰索引：0（非已知出生時間）\n\n`;
  text += `### 生年四化（年干「${data.yearGan}」）\n${data.yearSiHua.map(h=>`- ${h}\n`).join('')}`;
  text += '\n### 參考盤十二宮主星分佈\n| 地支 | 宮干 | 主星 |\n|------|------|------|\n';
  for (const zhi of DI_ZHI) {
    const info = data.starMap[zhi];
    if (info) text += `| ${zhi} | ${info.gan} | ${info.stars.join('、') || '-'} |\n`;
  }
  text += '\n### 天干飛化對照\n';
  for (const zhi of DI_ZHI) if (data.feiHua[zhi]) text += `- ${zhi}宮（宮干${data.feiHua[zhi].gan}）→ ${data.feiHua[zhi].sihua.join('、')}\n`;
  return text;
}
export function getMonthlySihuaStarsJson(chart,month) {
  validateMonth(month);
  return createJsonEnvelope('ziwei.monthlyStars',{chart,month},{stars:getMonthlySihuaStars(chart,month)},{limitations:['CHART_REFERENCE_DATE_UNKNOWN','MONTHS_ARE_DOUJUN_ORDER_NOT_CALENDAR_CONVERSION']});
}
export function getDailySihuaStarsJson(chart,year,month,day) {
  const targetDate = birthFromParts(year,month,day,0,'男').birthDate;
  return createJsonEnvelope('ziwei.dailyStars',{chart,targetDate},{stars:getDailySihuaStars(chart,year,month,day)},{limitations:['CHART_REFERENCE_DATE_UNKNOWN']});
}
export function getDecadalSihuaStarsAtOffsetJson(chart,offset=0) {
  if (!Number.isInteger(offset)) throw new TypeError('offset must be an integer');
  const result = getDecadalSihuaStarsAtOffset(chart,offset);
  const normalized = result && result.gan === undefined ? {...result,gan:null} : result;
  return createJsonEnvelope('ziwei.decadalStars',{chart,offset},{result:normalized},{limitations:['CHART_REFERENCE_DATE_UNKNOWN','MISSING_DECADAL_GAN_NORMALIZED_TO_NULL']});
}
export function formatChart(chart) {
  const b=chart.basic;
  let text=`## 紫微斗數命盤\n\n### 基本資料\n- 陽曆：${b.solarDate}\n- 農曆：${b.lunarDate}\n- 年柱：${b.yearGanZhi}年\n- 時辰：${b.shiChen}時\n- 性別：${b.gender}（${b.yinYang}${b.gender}）\n- 命宮：${b.mingGong}（${b.mingGongZhi}宮）\n- 身宮：${b.shenGong}\n- 命主：${b.commandStar}\n- 身主：${b.bodyStar}\n- 五行局：${b.wuXingJu}\n\n`;
  text+='### 十二宮排盤\n| 地支 | 宮干 | 宮位 | 主星 | 輔星 | 四化 | 長生 |\n|------|------|------|------|------|------|------|\n';
  for (const zhi of DI_ZHI) {
    const g=chart.gongs[zhi];
    if (g) text+=`| ${zhi} | ${chart.gongGan[zhi]} | ${g.name} | ${g.stars.join('、') || '-'} | ${g.minor.join('、') || '-'} | ${g.sihua.join('、') || '-'} | ${g.changSheng || '-'} |\n`;
  }
  text+='\n### 四化\n';
  for (const [star,hua] of Object.entries(chart.siHua)) text+=`- ${star}${hua}\n`;
  text+='\n### 大限\n';
  for (const dx of chart.daXian) text+=`- ${dx.zhi}宮：${dx.startAge}-${dx.endAge}歲\n`;
  if (chart.feiHua) {
    text+='\n### 宮位飛化表\n| 宮位 | 宮干 | 化祿 | 化權 | 化科 | 化忌 |\n|------|------|------|------|------|------|\n';
    for (const zhi of DI_ZHI) {
      const g=chart.gongs[zhi],fh=chart.feiHua[zhi];
      if (g && fh) text+=`| ${g.name} | ${fh.gan} | ${fh.sihua[0]} | ${fh.sihua[1]} | ${fh.sihua[2]} | ${fh.sihua[3]} |\n`;
    }
  }
  if (chart.horoscope) {
    const h=chart.horoscope;
    text+=`\n### 當前大限\n- 大限干支：${h.decadal.ganZhi}\n- 大限命宮位置：${h.decadal.mingGongZhi}（疊本命${h.decadal.dieBenGong}）\n- 大限四化：${h.decadal.sihua[0]}化祿、${h.decadal.sihua[1]}化權、${h.decadal.sihua[2]}化科、${h.decadal.sihua[3]}化忌\n`;
    text+=`\n### 流年\n- 流年干支：${h.yearly.ganZhi}\n- 流年命宮位置：${h.yearly.mingGongZhi}（疊本命${h.yearly.dieBenGong}）\n- 流年四化：${h.yearly.sihua[0]}化祿、${h.yearly.sihua[1]}化權、${h.yearly.sihua[2]}化科、${h.yearly.sihua[3]}化忌\n`;
    if (h.age && h.age.nominalAge) text+=`\n### 小限\n- 虛歲：${h.age.nominalAge}\n- 小限干支：${h.age.ganZhi}\n- 小限命宮疊本命：${h.age.dieBenGong}\n- 小限四化：${h.age.sihua[0]}化祿、${h.age.sihua[1]}化權、${h.age.sihua[2]}化科、${h.age.sihua[3]}化忌\n`;
    if (h.decadal.palaceNames?.length === 12 && h.yearly.palaceNames?.length === 12) {
      text+='\n### 疊宮對照（大限/流年宮位 vs 本命宮位）\n| 地支 | 本命宮位 | 大限宮位 | 流年宮位 |\n|------|----------|----------|----------|\n';
      for (const zhi of DI_ZHI) {
        const idx=DI_ZHI.indexOf(zhi),dx=(idx-DI_ZHI.indexOf(h.decadal.mingGongZhi)+12)%12,yn=(idx-DI_ZHI.indexOf(h.yearly.mingGongZhi)+12)%12;
        text+=`| ${zhi} | ${chart.gongs[zhi]?.name || '-'} | ${h.decadal.palaceNames[dx] || '-'} | ${h.yearly.palaceNames[yn] || '-'} |\n`;
      }
    }
  }
  return text;
}
export function formatChartCompact(chart) {
  const b=chart.basic;
  let t=`[紫微] ${b.solarDate} ${b.lunarDate} ${b.yearGanZhi}年 ${b.shiChen}時 ${b.gender}(${b.yinYang}) 命宮:${b.mingGong}(${b.mingGongZhi}) 身宮:${b.shenGong} 命主:${b.commandStar} 身主:${b.bodyStar} ${b.wuXingJu}\n[宮盤]\n`;
  for (const zhi of DI_ZHI) {
    const g=chart.gongs[zhi];
    if (!g) continue;
    const stars=g.stars.join(',') || '',minor=g.minor.length ? ` +${g.minor.join(',')}` : '',sh=g.sihua.length ? ` 化:${g.sihua.join(',')}` : '',cs=g.changSheng ? ` ${g.changSheng}` : '';
    t+=`${zhi}(${chart.gongGan[zhi]})${g.name}: ${stars}${minor}${sh}${cs}\n`;
  }
  t+=`[四化] ${Object.entries(chart.siHua).map(([s,h])=>`${s}${h}`).join(' ')}\n[大限] ${chart.daXian.map(d=>`${d.zhi}:${d.startAge}-${d.endAge}`).join(' ')}\n`;
  if (chart.feiHua) {
    t+='[飛化]\n';
    for (const zhi of DI_ZHI) {
      const g=chart.gongs[zhi],fh=chart.feiHua[zhi];
      if (g && fh) t+=`${g.name}(${fh.gan}): 祿${fh.sihua[0]} 權${fh.sihua[1]} 科${fh.sihua[2]} 忌${fh.sihua[3]}\n`;
    }
  }
  if (chart.horoscope) {
    const h=chart.horoscope;
    t+=`[大限] ${h.decadal.ganZhi} 命宮:${h.decadal.mingGongZhi}(疊${h.decadal.dieBenGong}) 四化:${h.decadal.sihua.join(',')}\n[流年] ${h.yearly.ganZhi} 命宮:${h.yearly.mingGongZhi}(疊${h.yearly.dieBenGong}) 四化:${h.yearly.sihua.join(',')}\n`;
    if (h.age && h.age.nominalAge) t+=`[小限] 虛歲${h.age.nominalAge} ${h.age.ganZhi} 疊${h.age.dieBenGong} 四化:${h.age.sihua.join(',')}\n`;
    if (h.decadal.palaceNames?.length === 12 && h.yearly.palaceNames?.length === 12) {
      t+='[疊宮] ';
      for (const zhi of DI_ZHI) {
        const ben=chart.gongs[zhi]?.name || '-',idx=DI_ZHI.indexOf(zhi),dxName=h.decadal.palaceNames[(idx-DI_ZHI.indexOf(h.decadal.mingGongZhi)+12)%12] || '-',ynName=h.yearly.palaceNames[(idx-DI_ZHI.indexOf(h.yearly.mingGongZhi)+12)%12] || '-';
        t+=ben === dxName && ben === ynName ? `${zhi}=${ben} ` : `${zhi}=${ben}/${dxName}/${ynName} `;
      }
      t+='\n';
    }
  }
  return t;
}

export function calculateChartJson(input) {
  assertKeys(input,[...BIRTH_KEYS,'referenceDate']);
  const birth = birthFields(input), date = referenceDate(Object.hasOwn(input,'referenceDate') ? {referenceDate:input.referenceDate} : {});
  return createJsonEnvelope('ziwei.chart',birth,chartForBirth(birth,date),{referenceDate:date,limitations:[MINUTE_LIMIT]});
}
