import {
  calculateChartJson, calculateTransitOverlayJson, calculateDayHourOverlayJson,
  calculateBaziJson, calculateCrossSihuaJson, calculateFinanceJson,
} from '../index.js';
import { toolSchemas } from './schemas.js';

function overlay(input) {
  const {scope,targetDate,month,targetHour,targetMinute,...birth}=input;
  if (scope === 'day') return calculateDayHourOverlayJson({
    ...birth,targetDate,
    ...(targetHour === undefined ? {} : {targetHour}),
    ...(targetMinute === undefined ? {} : {targetMinute}),
  });
  return calculateTransitOverlayJson({
    ...birth,referenceDate:targetDate,...(scope === 'month' ? {months:[month]} : {}),
  });
}
const calculators = Object.freeze({
  ziwei_chart:calculateChartJson,
  ziwei_overlay:overlay,
  bazi_chart:calculateBaziJson,
  cross_sihua:calculateCrossSihuaJson,
  finance_chart:calculateFinanceJson,
});

// Never return exception messages or echo birth payloads from calculation failures.
export function handleTool(name,input) {
  try {
    if (!Object.hasOwn(toolSchemas,name)) throw new TypeError('Unknown tool');
    const parsed=toolSchemas[name].parse(input);
    const structuredContent=calculators[name](parsed);
    return {structuredContent,content:[{type:'text',text:JSON.stringify(structuredContent)}]};
  } catch {
    return {isError:true,content:[{type:'text',text:'Calculation rejected: invalid or unsupported input.'}]};
  }
}
