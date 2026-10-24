import { z } from 'zod';
import { normalizeDate } from '../index.js';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine(value => {
  try { normalizeDate(value); return true; } catch { return false; }
}, 'Invalid calendar date').describe('Real Gregorian calendar date, YYYY-MM-DD; no timezone conversion.');
const hour = z.number().int().min(0).max(23);
const minute = z.number().int().min(0).max(59);
const month = z.number().int().min(1).max(12).describe('Explicit Doujun-order month 1..12, NOT the Gregorian/lunar month of targetDate. targetDate cannot substitute for this field.');
const birthShape = {
  birthDate: date,
  hour: hour.describe('Birth civil hour 0..23; no timezone conversion.'),
  minute: minute.optional().describe('Birth minute 0..59, default 0. Upstream ziwei/finance do not apply minute precision.'),
  gender: z.enum(['男','女']),
};
const strict = shape => z.strictObject(shape,{error:'Unsupported input fields'});
export const birthSchema = strict(birthShape);
export const CROSS_LEVELS = Object.freeze(['natal','palace','decadal','yearly','pastDecadal','pastDecadal2','monthly','daily']);
const chartSchema = strict({...birthShape,referenceDate:date.optional().describe('Date for temporal calculations; omitted means the actual local date at execution.')});
const overlaySchema = strict({
  ...birthShape,
  scope:z.enum(['year','month','day']).describe('year: all 12 Doujun-order months; month: requires explicit month; day: daily overlay with optional targetHour/targetMinute. Reject fields unused by the selected scope.'),
  targetDate:date.describe('Required date: rebuild chart for this date. Does not infer Doujun month.'),
  month:month.optional(),
  targetHour:hour.optional().describe('Only day scope; optional civil hour 0..23.'),
  targetMinute:minute.optional().describe('Only day scope and requires targetHour; retained but not applied by upstream, no subhour precision.'),
}).superRefine((value,ctx)=>{
  const issue = (path,message)=>ctx.addIssue({code:'custom',path:[path],message});
  if (value.scope === 'month' && value.month === undefined) issue('month','month scope requires explicit Doujun-order month');
  if (value.scope !== 'month' && value.month !== undefined) issue('month','month is only allowed for month scope');
  if (value.scope !== 'day' && (value.targetHour !== undefined || value.targetMinute !== undefined)) issue('scope','targetHour and targetMinute are only allowed for day scope');
  if (value.targetMinute !== undefined && value.targetHour === undefined) issue('targetMinute','targetMinute requires targetHour');
});
const crossSchema = strict({
  a:birthSchema.describe('Synthetic/local first birth; no identity/name fields.'),
  b:birthSchema.describe('Synthetic/local second birth; no identity/name fields.'),
  referenceDate:date.describe('Required reference date used to build BOTH charts and select historical decades.'),
  levels:z.array(z.enum(CROSS_LEVELS)).min(1).max(CROSS_LEVELS.length).refine(values=>new Set(values).size===values.length,'levels must be unique').optional().describe('Default natal,palace,decadal,yearly. monthly requires month; daily requires targetDate. Unselected temporal fields are rejected.'),
  month:month.optional(),
  targetDate:date.optional().describe('Required only when daily is selected; rejected otherwise.'),
}).superRefine((value,ctx)=>{
  const levels=value.levels ?? ['natal','palace','decadal','yearly'];
  const issue=(path,message)=>ctx.addIssue({code:'custom',path:[path],message});
  if (levels.includes('monthly') !== (value.month !== undefined)) issue('month','monthly selection requires month, otherwise month is not allowed');
  if (levels.includes('daily') !== (value.targetDate !== undefined)) issue('targetDate','daily selection requires targetDate, otherwise targetDate is not allowed');
});

export const toolSchemas = Object.freeze({
  ziwei_chart:chartSchema,
  ziwei_overlay:overlaySchema,
  bazi_chart:birthSchema,
  cross_sihua:crossSchema,
  finance_chart:chartSchema,
});
export const toolDescriptions = Object.freeze({
  ziwei_chart:'Local northern-school numerical ziwei chart. Optional referenceDate defaults to actual local date. Birth minute is retained but not applied upstream.',
  ziwei_overlay:'Local numerical overlay: year=all 12 Doujun-order months; month=explicit month 1..12 (never inferred from targetDate); day=optional hour. targetDate is required. Only day allows targetHour/targetMinute; targetMinute requires targetHour and is not applied upstream.',
  bazi_chart:'Local numerical bazi chart from a strict birth object; minute defaults to zero.',
  cross_sihua:'Local bidirectional numerical flights, with required referenceDate for both charts. Default natal/palace/decadal/yearly; optional previous two decades/monthly/daily. monthly requires explicit Doujun-order month; daily requires targetDate. Unused temporal fields and identity names are rejected. Missing historical decades produce no flights.',
  finance_chart:'Local numerical finance chart; optional referenceDate defaults to actual local date. Birth minute is retained but not applied upstream. No investment advice.',
});
