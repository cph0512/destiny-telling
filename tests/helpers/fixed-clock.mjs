import { normalizeDate } from '../../src/json-envelope.js';
export const REFERENCE_DATES = Object.freeze(['2024-02-10', '2025-12-31', '2026-10-24', '2027-01-01']);

export function withFixedClock(referenceDate, operation) {
  const date = normalizeDate(referenceDate);
  const NativeDate = globalThis.Date;
  const [year, month, day] = date.split('-').map(Number);
  const instant = new NativeDate(year, month - 1, day, 12).getTime();
  class FixedDate extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [instant])); }
    static now() { return instant; }
  }
  globalThis.Date = FixedDate;
  try {
    const result = operation();
    if (result && typeof result.then === 'function') throw new TypeError('Fixed clock operations must be synchronous');
    return result;
  } finally { globalThis.Date = NativeDate; }
}
