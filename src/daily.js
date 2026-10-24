import { astro } from './iztro-north.js';
import { Solar } from 'lunar-javascript';
import { assertKeys, normalizeBirthInput, normalizeDate, createJsonEnvelope } from './json-envelope.js';

const SC2TC = {
  '七杀':'七殺','正财':'正財','偏财':'偏財','劫财':'劫財','伤官':'傷官',
  '贪狼':'貪狼','太阴':'太陰','右弼':'右弼','天机':'天機',
  '天梁':'天梁','天相':'天相','天同':'天同','武曲':'武曲',
  '太阳':'太陽','巨门':'巨門','天府':'天府','廉贞':'廉貞',
  '破军':'破軍','紫微':'紫微','七杀':'七殺','天魁':'天魁',
  '天钺':'天鉞','左辅':'左輔','文昌':'文昌','文曲':'文曲',
  '禄存':'祿存','擎羊':'擎羊','陀罗':'陀羅','火星':'火星',
  '铃星':'鈴星','地空':'地空','地劫':'地劫',
  '兄弟':'兄弟','命宫':'命宮','父母':'父母','福德':'福德',
  '田宅':'田宅','官禄':'官祿','仆役':'僕役','迁移':'遷移',
  '疾厄':'疾厄','财帛':'財帛','子女':'子女','夫妻':'夫妻',
  '大驿土':'大驛土','长流水':'長流水','钗钏金':'釵釧金',
  '剑锋金':'劍鋒金','覆灯火':'覆燈火','涧下水':'澗下水',
  '山头火':'山頭火','霹雳火':'霹靂火','佛灯火':'佛燈火',
  '城头土':'城頭土','壁上土':'壁上土','杨柳木':'楊柳木',
};
function toTC(str) {
  if (!str) return str;
  let result = String(str);
  for (const [k, v] of Object.entries(SC2TC)) result = result.replaceAll(k, v);
  return result;
}
function hourToShiChen(hour) {
  if (hour >= 23 || hour < 1) return 0;
  return Math.floor((hour + 1) / 2);
}

function getDayInteraction(natalDayStem, dailyStem) {
  const TIAN_GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const WU_XING = ['木','木','火','火','土','土','金','金','水','水'];
  const nIdx = TIAN_GAN.indexOf(natalDayStem);
  const dIdx = TIAN_GAN.indexOf(dailyStem);
  if (nIdx < 0 || dIdx < 0) return { relationCode: 'UNKNOWN', relationTerm: '未知' };
  const nElement = WU_XING[nIdx], dElement = WU_XING[dIdx];
  const SHENG = { '木':'火', '火':'土', '土':'金', '金':'水', '水':'木' };
  const KE = { '木':'土', '土':'水', '水':'火', '火':'金', '金':'木' };
  let relationCode, relationTerm;
  if (nElement === dElement) { relationCode = 'SAME'; relationTerm = '比和'; }
  else if (SHENG[nElement] === dElement) { relationCode = 'NATAL_GENERATES_DAILY'; relationTerm = '我生'; }
  else if (SHENG[dElement] === nElement) { relationCode = 'DAILY_GENERATES_NATAL'; relationTerm = '生我'; }
  else if (KE[nElement] === dElement) { relationCode = 'NATAL_CONTROLS_DAILY'; relationTerm = '我剋'; }
  else if (KE[dElement] === nElement) { relationCode = 'DAILY_CONTROLS_NATAL'; relationTerm = '剋我'; }
  else { relationCode = 'UNKNOWN'; relationTerm = '未知'; }
  return { natalDayStem, natalElement: nElement, dailyStem, dailyElement: dElement, relationCode, relationTerm };
}

export function calculateDaily(input) {
  assertKeys(input, ['birth_date', 'birth_hour', 'gender', 'target_date']);
  const { birth_date, birth_hour = 12, gender = '男', target_date } = input;
  const birthDate = normalizeDate(birth_date, { allowUnpadded: true });
  const targetDate = normalizeDate(target_date, { allowUnpadded: true });
  normalizeBirthInput({ birthDate, hour: birth_hour, gender });
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = targetDate.split('-').map(Number);
  const shiChen = hourToShiChen(birth_hour);
  const result = astro.bySolar(`${by}-${bm}-${bd}`, shiChen, gender === '男' ? '男' : '女');
  const h = result.horoscope(`${ty}-${tm}-${td}`);
  const benPalaceMap = {};
  for (const p of result.palaces) benPalaceMap[toTC(p.earthlyBranch)] = toTC(p.name);
  const ziwei = {
    natal: {
      mingGong: toTC(result.palaces.find(p => p.name.includes('命宫'))?.name || ''),
      mingGongStars: result.palaces.find(p => p.name.includes('命宫'))?.majorStars?.map(s => toTC(s.name)) || [],
    },
    decadal: {
      ganZhi: toTC(h.decadal.heavenlyStem) + toTC(h.decadal.earthlyBranch),
      mutagen: (h.decadal.mutagen || []).map(toTC),
      palaceNames: (h.decadal.palaceNames || []).map(toTC),
      dieBenGong: benPalaceMap[toTC(h.decadal.earthlyBranch)] || '',
    },
    yearly: {
      ganZhi: toTC(h.yearly.heavenlyStem) + toTC(h.yearly.earthlyBranch),
      mutagen: (h.yearly.mutagen || []).map(toTC),
      palaceNames: (h.yearly.palaceNames || []).map(toTC),
      dieBenGong: benPalaceMap[toTC(h.yearly.earthlyBranch)] || '',
    },
    monthly: {
      ganZhi: toTC(h.monthly.heavenlyStem) + toTC(h.monthly.earthlyBranch),
      mutagen: (h.monthly.mutagen || []).map(toTC),
      palaceNames: (h.monthly.palaceNames || []).map(toTC),
    },
    daily: {
      ganZhi: toTC(h.daily.heavenlyStem) + toTC(h.daily.earthlyBranch),
      mutagen: (h.daily.mutagen || []).map(toTC),
      palaceNames: (h.daily.palaceNames || []).map(toTC),
      dieBenGong: benPalaceMap[toTC(h.daily.earthlyBranch)] || '',
    },
  };
  const solar = Solar.fromYmd(ty, tm, td);
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();
  const natalSolar = Solar.fromYmdHms(by, bm, bd, birth_hour, 0, 0);
  const natalEC = natalSolar.getLunar().getEightChar();
  const bazi = {
    natal: { year: natalEC.getYear(), month: natalEC.getMonth(), day: natalEC.getDay(), hour: natalEC.getTime(), dayMaster: natalEC.getDay()[0] },
    daily: { dayPillar: eightChar.getDay(), monthPillar: eightChar.getMonth(), yearPillar: eightChar.getYear(), dayNayin: eightChar.getDayNaYin(), lunarDate: lunar.toString() },
    interaction: getDayInteraction(natalEC.getDay()[0], eightChar.getDay()[0]),
  };
  return { ziwei, bazi, target_date, birth_date };
}

export function calculateDailyJson(input) {
  assertKeys(input, ['birthDate', 'hour', 'minute', 'gender', 'targetDate']);
  const { targetDate: supplied, ...fields } = input;
  const birth = normalizeBirthInput(fields);
  const targetDate = normalizeDate(supplied);
  const data = calculateDaily({ birth_date: birth.birthDate, birth_hour: birth.hour, gender: birth.gender, target_date: targetDate });
  return createJsonEnvelope('daily.chart', { ...birth, targetDate }, data, {
    referenceDate: targetDate,
    omitted: ['bazi.daily.dayYi', 'bazi.daily.dayJi', 'bazi.interaction.relation'],
    limitations: ['UPSTREAM_DAILY_BIRTH_MINUTE_ZERO'],
  });
}
