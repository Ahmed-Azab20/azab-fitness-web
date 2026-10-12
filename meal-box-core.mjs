import { buildFoodSnapshot } from './nutrition-core.mjs';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const GEMINI_API_KEY_STORAGE_KEY = 'azab-gemini-api-key';
export const GEMINI_MODEL_STORAGE_KEY = 'azab-gemini-model';
export const GEMINI_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          grams: { type: 'NUMBER' },
          kcal: { type: 'NUMBER' },
          protein_g: { type: 'NUMBER' },
          carbs_g: { type: 'NUMBER' },
          fat_g: { type: 'NUMBER' },
        },
        required: ['name', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g'],
      },
    },
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          grams: { type: 'NUMBER' },
          question: { type: 'STRING' },
        },
        required: ['name', 'grams', 'question'],
      },
    },
  },
  required: ['items', 'questions'],
};

const portionFields = ['kcal', 'protein_g', 'carbs_g', 'fat_g'];
const per100Limits = { kcal: 1200, protein_g: 100, carbs_g: 100, fat_g: 100 };
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';

function mealError(en, ar, ErrorType = Error) {
  return new ErrorType(`${ar} / ${en}`);
}

export function normalizeFoodName(value) {
  return String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
}

function normalizeDigits(value) {
  return String(value).replace(/[٠-٩۰-۹]/gu, digit => {
    const code = digit.codePointAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  }).replace(/٫/gu, '.');
}

export function parseMealText(input) {
  const parts = String(input ?? '').split(/[\r\n,،]+/u);
  const items = [];
  const errors = [];
  parts.forEach((part, index) => {
    const raw = part.trim();
    if (!raw) return;
    const normalized = normalizeDigits(raw);
    const match = normalized.match(/^(.*?)\s*(\d+(?:\.\d+)?)\s*(?:grams?|gr|g|جرام|جم)\s*$/iu);
    if (!match) {
      errors.push({ line: index + 1, raw, code: 'missing_or_invalid_grams' });
      return;
    }
    const name = match[1].trim();
    const grams = Number(match[2]);
    if (!name || !Number.isFinite(grams) || grams <= 0) {
      errors.push({ line: index + 1, raw, code: !name ? 'missing_name' : 'invalid_grams' });
      return;
    }
    items.push({ line: index + 1, inputName: name, grams });
  });
  return { items, errors };
}

function editDistance(left, right) {
  const a = [...left];
  const b = [...right];
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

function similarity(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const edit = 1 - editDistance(left, right) / Math.max([...left].length, [...right].length);
  const leftWords = new Set(left.split(' '));
  const rightWords = new Set(right.split(' '));
  const intersection = [...leftWords].filter(word => rightWords.has(word)).length;
  const union = new Set([...leftWords, ...rightWords]).size;
  const word = union ? intersection / union : 0;
  return Math.max(edit, word * 0.85);
}

function allFoodNames(food) {
  return [food?.name, food?.name_ar].map(normalizeFoodName).filter(Boolean);
}

export function matchMealItems(parsedItems, foods, limit = 3) {
  const available = (foods || []).filter(food => !food.deleted_at);
  return (parsedItems || []).map(item => {
    const target = normalizeFoodName(item.inputName);
    const exactMatches = available.filter(food => allFoodNames(food).includes(target));
    const similarFoods = exactMatches.length ? [] : available.map(food => ({
      food,
      score: Math.max(...allFoodNames(food).map(name => similarity(target, name)), 0),
    })).filter(match => match.score >= 0.24)
      .sort((a, b) => b.score - a.score || String(a.food.id).localeCompare(String(b.food.id)))
      .slice(0, Math.max(0, Math.min(3, limit)));
    return {
      ...item,
      exactMatches,
      similarFoods,
      choice: exactMatches.length === 1 ? `food:${exactMatches[0].id}` : null,
      method: null,
      manualValues: null,
      aiValues: null,
      question: null,
      answer: '',
    };
  });
}

export function prepareMealDraft(input, foods) {
  const parsed = parseMealText(input);
  return { entries: matchMealItems(parsed.items, foods), errors: parsed.errors, initialAiRequested: false };
}

export function portionToPer100(values, grams) {
  const amount = Number(grams);
  if (!Number.isFinite(amount) || amount <= 0) throw mealError('Food amount must be greater than zero grams.', 'يجب أن تكون كمية الطعام أكبر من صفر جرام.', RangeError);
  const converted = {};
  for (const field of portionFields) {
    const raw = values?.[field];
    if (raw === '' || raw === null || raw === undefined || !Number.isFinite(Number(raw)) || Number(raw) < 0) {
      throw mealError(`Enter a valid non-negative ${field} value.`, `أدخل قيمة ${field} صحيحة وغير سالبة.`, TypeError);
    }
    const rounded = Math.round(((Number(raw) * 100 / amount) + Number.EPSILON) * 10) / 10;
    if (rounded > per100Limits[field]) throw mealError(`${field} per 100 g exceeds the app's accepted range.`, `تتجاوز قيمة ${field} لكل 100 جم النطاق المقبول في التطبيق.`, RangeError);
    converted[field] = rounded;
  }
  return converted;
}

export function isReadyMealEntry(entry, foods = []) {
  if (!entry?.choice) return false;
  if (entry.choice.startsWith('food:')) {
    const id = entry.choice.slice(5);
    return foods.some(food => food.id === id && !food.deleted_at);
  }
  if (entry.choice !== 'new') return false;
  if (entry.method === 'manual') {
    try { portionToPer100(entry.manualValues, entry.grams); return true; }
    catch { return false; }
  }
  if (entry.method === 'ai' && !entry.question && entry.aiValues) {
    try { portionToPer100(entry.aiValues, entry.grams); return true; }
    catch { return false; }
  }
  return false;
}

export function canApproveMeal(entries, foods = []) {
  return Array.isArray(entries) && entries.length > 0 && entries.every(entry => isReadyMealEntry(entry, foods));
}

export function sumPortionValues(valueRows) {
  const rows = Array.isArray(valueRows) ? valueRows : [valueRows];
  return Object.fromEntries(portionFields.map(field => [field, rows.reduce((total, row) => total + (Number(row?.[field]) || 0), 0)]));
}

export function buildNewFoodRecord({ id, name, nameAr = null, grams, method, portionValues, timestamp }) {
  if (!['manual', 'ai'].includes(method)) throw mealError('Choose manual entry or an AI estimate.', 'اختر الإدخال اليدوي أو تقدير الذكاء الاصطناعي.', TypeError);
  if (!id || !String(name || '').trim() || !Number.isFinite(Number(timestamp))) throw mealError('A food name, ID, and timestamp are required.', 'اسم الطعام ومعرّفه والطابع الزمني مطلوبة.', TypeError);
  const per100 = portionToPer100(portionValues, grams);
  return {
    id, name: String(name).trim(), name_ar: nameAr ? String(nameAr).trim() : null,
    brand: null, barcode: null,
    kcal_per_100g: per100.kcal, protein_g_per_100g: per100.protein_g,
    carbs_g_per_100g: per100.carbs_g, fat_g_per_100g: per100.fat_g,
    fiber_g_per_100g: null, sugar_g_per_100g: null, sodium_mg_per_100g: null,
    serving_g: Number(grams), data_note: null, is_favorite: false, last_used_at: Number(timestamp),
    source: method === 'manual' ? 'manual' : 'AI estimate', is_estimate: method === 'ai',
    created_at: Number(timestamp), updated_at: Number(timestamp), deleted_at: null,
  };
}

export function buildMealFoodLog({ id, food, grams, meal, localDate, timestamp }) {
  if (!id || !food?.id || !Number.isFinite(Number(timestamp)) || !localDate) throw mealError('A saved food, log ID, date, and timestamp are required.', 'الطعام المحفوظ ومعرّف السجل والتاريخ والطابع الزمني مطلوبة.', TypeError);
  return {
    id, ...buildFoodSnapshot(food, grams), ...(meal || {}), note: null,
    logged_at: Number(timestamp), timestamp: Number(timestamp), local_date: String(localDate),
    deleted_at: null, created_at: Number(timestamp), updated_at: Number(timestamp),
  };
}

export function buildMealApprovalPlan({ entries, foods = [], meal, localDate, timestamp, createId }) {
  if (!canApproveMeal(entries, foods)) return null;
  if (typeof createId !== 'function') throw mealError('A record ID generator is required.', 'يلزم توفير مُنشئ لمعرّفات السجلات.', TypeError);
  const foodsToWrite = [];
  const logsToWrite = [];
  for (const entry of entries) {
    let food;
    if (entry.choice === 'new') {
      const portionValues = entry.method === 'manual' ? entry.manualValues : entry.aiValues;
      const arabicName = /[\u0600-\u06ff]/u.test(entry.inputName) ? entry.inputName : null;
      food = buildNewFoodRecord({ id: createId(), name: entry.inputName, nameAr: arabicName, grams: entry.grams, method: entry.method, portionValues, timestamp });
    } else {
      const id = entry.choice.slice(5);
      const savedFood = foods.find(row => String(row.id) === id && !row.deleted_at);
      if (!savedFood) return null;
      food = { ...savedFood, last_used_at: timestamp, updated_at: timestamp, deleted_at: savedFood.deleted_at ?? null };
    }
    foodsToWrite.push(food);
    logsToWrite.push(buildMealFoodLog({ id: createId(), food, grams: entry.grams, meal, localDate, timestamp }));
  }
  return { foodsToWrite, logsToWrite };
}

export async function applyMealApprovalAction(action, { plan, write, onCancel } = {}) {
  if (action === 'cancel') {
    await onCancel?.();
    return false;
  }
  if (action !== 'approve' || !plan || typeof write !== 'function') return false;
  await write(plan);
  return true;
}

export function selectedAiItems(entries, onlyUnanswered = false) {
  return (entries || []).filter(entry => entry.choice === 'new' && entry.method === 'ai' && (!onlyUnanswered || (entry.question && entry.answer?.trim())))
    .map(entry => ({ name: entry.inputName, grams: Number(entry.grams) }));
}

function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === [...expected].sort().join('|');
}

function expectedIndex(requested, name, grams, used) {
  const normalized = normalizeFoodName(name);
  return requested.findIndex((item, index) => !used.has(index)
    && normalizeFoodName(item.name) === normalized
    && Math.abs(Number(item.grams) - Number(grams)) <= 0.01);
}

export function validateGeminiResult(input, requestedItems) {
  let result;
  try { result = typeof input === 'string' ? JSON.parse(input) : input; }
  catch { throw mealError('Gemini returned invalid JSON. Nothing was saved.', 'أعاد Gemini بيانات JSON غير صالحة. لم يُحفظ أي شيء.', TypeError); }
  if (!exactKeys(result, ['items', 'questions']) || !Array.isArray(result.items) || !Array.isArray(result.questions)) {
    throw mealError('Gemini response must contain only items and questions arrays. Nothing was saved.', 'يجب أن يحتوي رد Gemini على مصفوفتَي العناصر والأسئلة فقط. لم يُحفظ أي شيء.', TypeError);
  }
  const requested = (requestedItems || []).map(item => ({ name: String(item.name), grams: Number(item.grams) }));
  const used = new Set();
  const items = [];
  const questions = [];
  for (const item of result.items) {
    if (!exactKeys(item, ['name', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g'])) {
      throw mealError('Gemini returned an unexpected item shape. Nothing was saved.', 'أعاد Gemini شكل عنصر غير متوقع. لم يُحفظ أي شيء.', TypeError);
    }
    if (typeof item.name !== 'string' || typeof item.grams !== 'number' || !Number.isFinite(item.grams)) {
      throw mealError('Gemini returned an invalid food name or amount. Nothing was saved.', 'أعاد Gemini اسم طعام أو كمية غير صالحة. لم يُحفظ أي شيء.', TypeError);
    }
    const index = expectedIndex(requested, item.name, item.grams, used);
    if (index < 0) throw mealError('Gemini changed a requested food name or amount. Nothing was saved.', 'غيّر Gemini اسم الطعام أو كميته المطلوبة. لم يُحفظ أي شيء.', TypeError);
    for (const field of portionFields) {
      if (typeof item[field] !== 'number' || !Number.isFinite(item[field]) || item[field] < 0) {
        throw mealError('Gemini returned an invalid nutrition value. Nothing was saved.', 'أعاد Gemini قيمة غذائية غير صالحة. لم يُحفظ أي شيء.', TypeError);
      }
    }
    portionToPer100(item, item.grams);
    used.add(index);
    items.push({ name: requested[index].name, grams: requested[index].grams, kcal: item.kcal, protein_g: item.protein_g, carbs_g: item.carbs_g, fat_g: item.fat_g });
  }
  for (const question of result.questions) {
    if (!exactKeys(question, ['name', 'grams', 'question']) || typeof question.name !== 'string'
      || typeof question.grams !== 'number' || !Number.isFinite(question.grams)
      || typeof question.question !== 'string' || !question.question.trim()) {
      throw mealError('Gemini returned an invalid clarification question. Nothing was saved.', 'أعاد Gemini سؤال توضيح غير صالح. لم يُحفظ أي شيء.', TypeError);
    }
    const index = expectedIndex(requested, question.name, question.grams, used);
    if (index < 0) throw mealError('Gemini asked about an unrequested food or amount. Nothing was saved.', 'سأل Gemini عن طعام أو كمية لم تُطلب. لم يُحفظ أي شيء.', TypeError);
    used.add(index);
    questions.push({ name: requested[index].name, grams: requested[index].grams, question: question.question.trim() });
  }
  if (used.size !== requested.length) throw mealError('Gemini did not resolve every requested food. Nothing was saved.', 'لم يعالج Gemini كل الأطعمة المطلوبة. لم يُحفظ أي شيء.', TypeError);
  return { items, questions };
}

export function buildGeminiRequest({ model, items, clarifications = [] }) {
  const selected = (items || []).map(item => ({ name: String(item.name), grams: Number(item.grams) }));
  if (!selected.length || selected.some(item => !item.name.trim() || !Number.isFinite(item.grams) || item.grams <= 0)) {
    throw mealError('Choose at least one new food with a valid gram amount.', 'اختر طعامًا جديدًا واحدًا على الأقل واكتب كمية صحيحة بالجرام.', TypeError);
  }
  const cleanClarifications = (clarifications || []).map(item => ({
    name: String(item.name), grams: Number(item.grams), question: String(item.question ?? '').trim(), answer: String(item.answer ?? '').trim(),
  }));
  if (cleanClarifications.some(item => !item.question || !item.answer)) throw mealError('Answer each question before requesting another estimate.', 'أجب عن كل سؤال قبل طلب تقدير جديد.', TypeError);
  const modelName = String(model || '').trim();
  if (!modelName || !/^[A-Za-z0-9._-]+$/u.test(modelName)) throw mealError('Enter a valid Gemini model name.', 'أدخل اسم موديل Gemini صالحًا.', TypeError);
  const input = { items: selected };
  if (cleanClarifications.length) input.clarifications = cleanClarifications;
  const prompt = [
    'Estimate nutrition for only the exact new foods and gram amounts in the input JSON below.',
    'Return strict JSON matching the supplied schema. Names must stay in the same language as the input.',
    'For an unclear food, do not guess: put one {name, grams, question} entry in questions instead of an item.',
    'Each clear item must report kcal, protein_g, carbs_g, and fat_g for the specified grams, not per 100 g.',
    'Do not return a meal total, extra foods, explanations, or any other fields.',
    `Input JSON: ${JSON.stringify(input)}`,
  ].join('\n');
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: GEMINI_JSON_SCHEMA },
  };
  return {
    url: `${GEMINI_ENDPOINT}${encodeURIComponent(modelName)}:generateContent`,
    headers: { 'Content-Type': 'application/json' },
    body,
    requestedItems: selected,
  };
}

function responseText(response) {
  return (response?.candidates?.[0]?.content?.parts || []).map(part => typeof part.text === 'string' ? part.text : '').join('').trim();
}

export async function requestGeminiEstimates({ apiKey, model, items, clarifications = [], fetchImpl = globalThis.fetch }) {
  const key = String(apiKey || '').trim();
  if (!key) throw mealError('Add your Gemini API key in Settings first.', 'أضف مفتاح Gemini API من الإعدادات أولًا.', TypeError);
  if (typeof fetchImpl !== 'function') throw mealError('This browser does not support the request API.', 'هذا المتصفح لا يدعم واجهة الطلبات.', Error);
  const request = buildGeminiRequest({ model, items, clarifications });
  let response;
  try {
    response = await fetchImpl(request.url, {
      method: 'POST',
      headers: { ...request.headers, 'x-goog-api-key': key },
      body: JSON.stringify(request.body),
    });
  } catch (error) {
    const message = String(error?.message || 'Request failed').split(key).join('[redacted]');
    throw new Error(`تعذر الاتصال بخدمة Gemini: ${message} / Could not reach Gemini: ${message}`);
  }
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const message = String(payload?.error?.message || response.statusText || 'Request rejected').split(key).join('[redacted]');
    throw new Error(`خطأ في واجهة Gemini (HTTP ${response.status}): ${message} / Gemini API error (HTTP ${response.status}): ${message}`);
  }
  const text = responseText(payload);
  if (!text) throw mealError('Gemini returned no JSON text. Nothing was saved.', 'لم يُرجع Gemini نص JSON. لم يُحفظ أي شيء.', TypeError);
  return validateGeminiResult(text, request.requestedItems);
}

export async function requestSelectedAiItems(entries, options = {}) {
  const items = selectedAiItems(entries);
  if (!items.length) return { items: [], questions: [], skipped: true };
  return requestGeminiEstimates({ ...options, items });
}

export function readGeminiModel(storage) {
  try { return String(storage?.getItem(GEMINI_MODEL_STORAGE_KEY) || DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL; }
  catch { return DEFAULT_GEMINI_MODEL; }
}

export function readGeminiApiKey(storage) {
  try { return String(storage?.getItem(GEMINI_API_KEY_STORAGE_KEY) || '').trim(); }
  catch { return ''; }
}

export function saveGeminiModel(storage, value) {
  const model = String(value || '').trim();
  if (!model || !/^[A-Za-z0-9._-]+$/u.test(model)) throw new TypeError('Enter a valid Gemini model name.');
  storage.setItem(GEMINI_MODEL_STORAGE_KEY, model);
  return model;
}

export function saveGeminiApiKey(storage, value) {
  const key = String(value || '').trim();
  if (!key) throw new TypeError('Paste a Gemini API key, or use Clear key to remove the saved key.');
  storage.setItem(GEMINI_API_KEY_STORAGE_KEY, key);
}

export function clearGeminiApiKey(storage) {
  storage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
}
