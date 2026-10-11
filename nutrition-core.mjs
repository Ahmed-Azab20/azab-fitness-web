export const FOOD_FIELDS = Object.freeze({
  kcal: 'kcal_per_100g',
  protein_g: 'protein_g_per_100g',
  carbs_g: 'carbs_g_per_100g',
  fat_g: 'fat_g_per_100g',
  fiber_g: 'fiber_g_per_100g',
  sugar_g: 'sugar_g_per_100g',
  sodium_mg: 'sodium_mg_per_100g',
});

export function nutritionPer100g(food) {
  return Object.fromEntries(Object.entries(FOOD_FIELDS).map(([key, field]) => {
    const value = food?.[field];
    return [key, Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value) : null];
  }));
}

export function scaleNutrition(per100g, quantityG) {
  const grams = Number(quantityG);
  if (!Number.isFinite(grams) || grams <= 0) throw new RangeError('Quantity must be greater than zero grams.');
  const result = {};
  for (const key of Object.keys(FOOD_FIELDS)) {
    const value = per100g?.[key];
    result[key] = Number.isFinite(Number(value)) && value !== null
      ? (Number(value) * grams) / 100
      : null;
  }
  return result;
}

export function buildFoodSnapshot(food, quantityG) {
  const per100g = nutritionPer100g(food);
  return {
    food_id: food.id || null,
    food_name_snapshot: String(food.name || ''),
    food_name_ar_snapshot: String(food.name_ar || food.name || ''),
    nutrition_per_100g_snapshot: per100g,
    quantity_g: Number(quantityG),
    ...scaleNutrition(per100g, quantityG),
  };
}

export function sumNutrition(logs) {
  const result = Object.fromEntries(Object.keys(FOOD_FIELDS).map(key => [key, 0]));
  const knownCounts = Object.fromEntries(Object.keys(FOOD_FIELDS).map(key => [key, 0]));
  for (const log of logs || []) {
    if (log.deleted_at) continue;
    for (const key of Object.keys(FOOD_FIELDS)) {
      const value = log[key];
      if (Number.isFinite(Number(value)) && value !== null && value !== '') {
        result[key] += Number(value);
        knownCounts[key] += 1;
      }
    }
  }
  for (const key of Object.keys(FOOD_FIELDS)) {
    if (knownCounts[key] === 0) result[key] = null;
  }
  return { ...result, knownCounts };
}

export function caloriesRemaining(targetCalories, consumedCalories) {
  const target = Number(targetCalories);
  const consumed = Number(consumedCalories);
  if (!Number.isFinite(target) || !Number.isFinite(consumed)) return null;
  return target - consumed;
}

export function effectiveTargetsForDate(targets, localDate) {
  return (targets || [])
    .filter(row => !row.deleted_at && typeof row.effective_from === 'string' && row.effective_from <= localDate)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from) || (b.updated_at || 0) - (a.updated_at || 0))[0] || null;
}

export function macroEnergyCheck(target) {
  if (!target || !Number.isFinite(Number(target.calories)) || Number(target.calories) <= 0) {
    return { macroCalories: null, differencePercent: null, warning: false };
  }
  const macroCalories = (Number(target.protein_g) || 0) * 4
    + (Number(target.carbs_g) || 0) * 4
    + (Number(target.fat_g) || 0) * 9;
  const differencePercent = Math.abs(macroCalories - Number(target.calories)) / Number(target.calories) * 100;
  return { macroCalories, differencePercent, warning: differencePercent > 5 };
}

export function shouldAcceptImportedRow(incoming, current) {
  if (!current) return true;
  const incomingTime = Number(incoming?.updated_at || incoming?.created_at || 0);
  const currentTime = Number(current?.updated_at || current?.created_at || 0);
  return incomingTime > currentTime;
}

export function restoreSavedMealWithItems(meal, items, updatedAt) {
  if (!meal?.id) throw new TypeError('A saved meal with an ID is required.');
  return {
    meal: { ...meal, deleted_at: null, updated_at: updatedAt },
    items: (items || [])
      .filter(item => item.saved_meal_id === meal.id && item.deleted_at)
      .map(item => ({ ...item, deleted_at: null, updated_at: updatedAt })),
  };
}
