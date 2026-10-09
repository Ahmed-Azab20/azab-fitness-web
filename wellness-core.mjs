import { effectiveTargetsForDate, sumNutrition } from './nutrition-core.mjs';

export const MEASUREMENT_TYPES = Object.freeze(['waist', 'chest', 'arms', 'shoulders', 'thighs', 'neck']);

export function waterForDate(rows, localDate) {
  const logs = (rows || []).filter(row => !row.deleted_at && row.local_date === localDate);
  return {
    amount_ml: logs.reduce((sum, row) => sum + (Number(row.amount_ml) || 0), 0),
    count: logs.length,
  };
}

export function sleepForWakeDate(rows, wakeDate) {
  const logs = (rows || []).filter(row => !row.deleted_at && row.local_date === wakeDate);
  const minutes = logs.reduce((sum, row) => sum + (Number(row.duration_minutes) || 0), 0);
  const latest = logs.slice().sort((a, b) => (b.sleep_end || 0) - (a.sleep_end || 0))[0] || null;
  return { duration_minutes: minutes, count: logs.length, latest };
}

export function sleepDuration(start, end) {
  const startMs = start instanceof Date ? start.getTime() : new Date(start).getTime();
  const endMs = end instanceof Date ? end.getTime() : new Date(end).getTime();
  const minutes = (endMs - startMs) / 60000;
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) {
    throw new RangeError('Sleep must be between 1 minute and 24 hours.');
  }
  return Math.round(minutes);
}

export function sleepRecordFromLocalInputs(startInput, endInput) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startInput) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(endInput)) {
    throw new TypeError('Enter both sleep and wake-up times.');
  }
  const minutes = sleepDuration(startInput, endInput);
  return {
    sleep_start: new Date(startInput).getTime(),
    sleep_end: new Date(endInput).getTime(),
    duration_minutes: minutes,
    local_date: endInput.slice(0, 10),
  };
}

export function latestMeasurement(rows, type, customType = null) {
  return (rows || [])
    .filter(row => !row.deleted_at && row.type === type && (type !== 'custom' || customType === null || row.custom_type === customType))
    .sort((a, b) => (b.local_date || '').localeCompare(a.local_date || '') || (b.logged_at || b.timestamp || 0) - (a.logged_at || a.timestamp || 0))[0] || null;
}

export function measurementChange(rows, type, customType = null) {
  const history = (rows || [])
    .filter(row => !row.deleted_at && row.type === type && (type !== 'custom' || customType === null || row.custom_type === customType))
    .sort((a, b) => (b.local_date || '').localeCompare(a.local_date || '') || (b.logged_at || b.timestamp || 0) - (a.logged_at || a.timestamp || 0));
  if (history.length < 2) return null;
  return Number(history[0].value_cm) - Number(history[1].value_cm);
}

export function dailyNutrition(logs, targets, localDate) {
  const todaysLogs = (logs || []).filter(row => !row.deleted_at && row.local_date === localDate);
  const totals = sumNutrition(todaysLogs);
  const target = effectiveTargetsForDate(targets, localDate);
  return {
    logs: todaysLogs,
    target,
    totals,
    calories_remaining: Number.isFinite(Number(target?.calories)) && totals.kcal !== null
      ? Number(target.calories) - totals.kcal : null,
    protein_remaining: Number.isFinite(Number(target?.protein_g)) && totals.protein_g !== null
      ? Number(target.protein_g) - totals.protein_g : null,
  };
}

export function dailyConsistencyScore({ foodLogs = [], waterLogs = [], sleepLogs = [], targets = {}, localDate }) {
  const nutritionRows = foodLogs.filter(row => !row.deleted_at && row.local_date === localDate);
  const waterRows = waterLogs.filter(row => !row.deleted_at && row.local_date === localDate);
  const sleepRows = sleepLogs.filter(row => !row.deleted_at && row.local_date === localDate);
  const items = [];
  const add = (key, available, met) => { if (available) items.push({ key, met }); };
  const totals = sumNutrition(nutritionRows);
  const calorieTarget = Number(targets.calories);
  if (nutritionRows.length && calorieTarget > 0 && Number.isFinite(calorieTarget) && totals.kcal !== null) {
    add('calories', true, totals.kcal >= calorieTarget * 0.9 && totals.kcal <= calorieTarget * 1.1);
  }
  const proteinTarget = Number(targets.protein_g);
  if (nutritionRows.length && proteinTarget > 0 && Number.isFinite(proteinTarget) && totals.protein_g !== null) {
    add('protein', true, totals.protein_g >= proteinTarget * 0.9);
  }
  const waterTarget = Number(targets.water_ml);
  if (waterRows.length && waterTarget > 0 && Number.isFinite(waterTarget)) {
    add('water', true, waterForDate(waterRows, localDate).amount_ml >= waterTarget * 0.9);
  }
  const sleepTarget = Number(targets.sleep_minutes);
  if (sleepRows.length && sleepTarget > 0 && Number.isFinite(sleepTarget)) {
    add('sleep', true, sleepForWakeDate(sleepRows, localDate).duration_minutes >= sleepTarget * 0.9);
  }
  const met = items.filter(item => item.met).length;
  return { score: items.length ? Math.round((met / items.length) * 100) : null, met, available: items.length, items };
}

export function goalProgress({ goal, startingWeight, currentWeight }) {
  if (!goal || goal.goal_type === 'maintain') return null;
  if (startingWeight == null || startingWeight === '' || currentWeight == null || currentWeight === '' || goal.target_weight_kg == null || goal.target_weight_kg === '') return null;
  const start = Number(startingWeight);
  const current = Number(currentWeight);
  const target = Number(goal.target_weight_kg);
  if (![start, current, target].every(Number.isFinite) || target === start) return null;
  const raw = ((current - start) / (target - start)) * 100;
  return Math.max(0, Math.min(100, raw));
}

export function remaining(target, consumed) {
  const a = Number(target);
  const b = Number(consumed);
  return Number.isFinite(a) && Number.isFinite(b) ? a - b : null;
}

export function dataUrlToImageBlob(dataUrl) {
  if (typeof dataUrl !== 'string') throw new TypeError('Photo data is missing.');
  const match = /^data:(image\/(?:jpeg|png|webp|avif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new TypeError('Photo backup data is invalid.');
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: match[1] });
}
