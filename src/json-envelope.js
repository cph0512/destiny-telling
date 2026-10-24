const SCHEMA = 'destiny-telling.calc/v1';
const CONFIG = { school: 'north', gengMutagens: ['太陽', '武曲', '天同', '天相'] };

export function assertRecord(value, name = 'input') {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${name} must be a plain object`);
  }
}

export function assertKeys(value, keys) {
  assertRecord(value);
  for (const key of Reflect.ownKeys(value)) {
    if (!keys.includes(key)) throw new TypeError(`Unsupported input field: ${String(key)}`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !('value' in descriptor)) throw new TypeError('Input fields must be enumerable data properties');
  }
}

export function normalizeDate(value, { allowUnpadded = false } = {}) {
  const pattern = allowUnpadded ? /^(\d{4})-(\d{1,2})-(\d{1,2})$/ : /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = typeof value === 'string' && pattern.exec(value);
  if (!match) throw new TypeError('Date must use YYYY-MM-DD');
  const [year, month, day] = match.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) throw new RangeError('Invalid calendar date');
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function normalizeBirthInput(input) {
  assertKeys(input, ['birthDate', 'hour', 'minute', 'gender']);
  const birthDate = normalizeDate(input.birthDate);
  const { hour, gender, minute = 0 } = input;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new RangeError('hour must be an integer from 0 to 23');
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) throw new RangeError('minute must be an integer from 0 to 59');
  if (gender !== '男' && gender !== '女') throw new TypeError('gender must be 男 or 女');
  return { birthDate, hour, minute, gender };
}

export function birthFromParts(year, month, day, hour, gender, minute = 0) {
  if (![year, month, day].every(Number.isInteger)) throw new TypeError('Calendar components must be integers');
  return normalizeBirthInput({ birthDate: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, hour, minute, gender });
}

export function assertJsonData(value) {
  const active = new Set();
  function visit(item) {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number' && Number.isFinite(item) && !Object.is(item, -0)) return;
    if (typeof item !== 'object' || active.has(item)) throw new TypeError('Value is not lossless JSON data');
    if (Array.isArray(item)) {
      if (Object.getPrototypeOf(item) !== Array.prototype) throw new TypeError('JSON arrays must have the standard prototype');
    } else assertRecord(item, 'JSON value');
    active.add(item);
    const keys = Reflect.ownKeys(item);
    if (Array.isArray(item) && (keys.length !== item.length + 1 || !keys.every(key => key === 'length' || /^(0|[1-9]\d*)$/.test(String(key))))) {
      throw new TypeError('JSON arrays must be dense and have no extra properties');
    }
    for (const key of keys) {
      if (Array.isArray(item) && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (typeof key !== 'string' || !descriptor.enumerable || !('value' in descriptor)) throw new TypeError('JSON properties must be enumerable string data properties');
      visit(descriptor.value);
    }
    active.delete(item);
  }
  visit(value);
}

export function createJsonEnvelope(kind, input, data, { referenceDate = null, omitted = [], limitations = [] } = {}) {
  if (typeof kind !== 'string' || !kind.length) throw new TypeError('kind is required');
  if (![omitted, limitations].every(list => Array.isArray(list) && list.every(item => typeof item === 'string'))) throw new TypeError('Metadata must contain string arrays');
  const envelope = {
    schema: SCHEMA, kind, input,
    referenceDate: referenceDate === null ? null : normalizeDate(referenceDate),
    config: CONFIG, data, omitted, limitations,
  };
  assertJsonData(envelope);
  return JSON.parse(JSON.stringify(envelope));
}
