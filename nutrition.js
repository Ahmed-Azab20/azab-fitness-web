import { FOOD_SEEDS } from './food-seeds.js';
import { buildFoodSnapshot, effectiveTargetsForDate, macroEnergyCheck, nutritionPer100g, restoreSavedMealWithItems, scaleNutrition, sumNutrition } from './nutrition-core.mjs';
import { DEFAULT_GEMINI_MODEL, GEMINI_KEY_REQUIRED_MESSAGE, MEAL_METHOD_REQUIRED_MESSAGE, applyMealApprovalAction, buildMealApprovalPlan, canApproveMeal, clearGeminiApiKey, mealEntriesMissingMethod, mealEntryControlState, mealEstimateStatus, portionToPer100, prepareMealDraft, readGeminiApiKey, readGeminiModel, requestSelectedAiItems, saveGeminiApiKey, saveGeminiModel, selectedAiItems, setMealEntryChoice, setMealEntryMethod, sumPortionValues } from './meal-box-core.mjs';

const DB_NAME = 'azab-fitness-os';
const DB_VERSION = 5;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const uid = () => crypto.randomUUID();
const now = () => Date.now();
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const stamp = () => ({ created_at: now(), updated_at: now() });

const text = {
  ar: {
    title: 'التغذية', subtitle: 'سجّل أكلك بالجرام وتابع هدف يومك', day: 'اليوم', date: 'التاريخ',
    copyPrevious: 'انسخ أكل اليوم السابق', target: 'هدف اليوم', editTargets: 'تعديل الأهداف', noTarget: 'مفيش هدف يومي محفوظ للتاريخ ده.',
    calories: 'السعرات', consumed: 'مستهلك', remaining: 'متبقي', over: 'زيادة عن الهدف', protein: 'بروتين', carbs: 'كربوهيدرات', fat: 'دهون',
    fiber: 'ألياف', sugar: 'سكر', sodium: 'صوديوم', optionalNote: 'المغذيات الاختيارية تجمع الأطعمة اللي لها قيمة مسجلة فقط.',
    targetCheck: 'مراجعة الأهداف', targetBalanced: 'السعرات قريبة من حساب الماكروز 4/4/9.', targetWarning: 'تنبيه: طاقة الماكروز المحسوبة {macro} kcal تختلف عن هدف السعرات {target} kcal بنسبة {percent}٪. راجع الأهداف.',
    searchTitle: 'ابحث عن طعام وأضفه', search: 'اكتب اسم الطعام بالعربي أو الإنجليزي', allFoods: 'الكل', favorites: 'المفضلة', recent: 'الأحدث استخدامًا',
    addCustom: 'إضافة طعام مخصص', noFoods: 'مفيش أطعمة مطابقة. جرّب اسمًا تانيًا أو أضف طعامًا مخصصًا.', per100: 'لكل 100 جم', estimate: 'تقدير مبدئي', seedSource: 'قيمة بداية قابلة للتعديل', pick: 'اختار', edit: 'تعديل', favorite: 'إضافة للمفضلة', unfavorite: 'إزالة من المفضلة',
    addToLog: 'إضافة للسجل', amount: 'الكمية (جم)', serving: 'حصة', mealType: 'نوع الوجبة', breakfast: 'فطار', lunch: 'غداء', dinner: 'عشاء', snack: 'سناك', custom: 'نوع مخصص', mealLabel: 'اسم الوجبة المخصص', note: 'ملاحظة (اختياري)', preview: 'المجموع بهذه الكمية',
    mealsToday: 'وجبات اليوم', emptyDay: 'مفيش أكل متسجل في اليوم ده.', saveGroup: 'احفظ الوجبة كوصفة', duplicate: 'تكرار الوجبة', editLog: 'تعديل', deleteLog: 'حذف للسلة',
    savedTitle: 'وجبات ووصفات محفوظة', newRecipe: 'إنشاء وجبة / وصفة', meal: 'وجبة', recipe: 'وصفة', ingredients: 'المكونات', addIngredient: 'أضف مكون', noSaved: 'لسه مفيش وجبات محفوظة. تقدر تحفظ وجبة مسجلة أو تنشئ وصفة.', applyMeal: 'إضافة لليوم', deleteSaved: 'حذف للسلة', saved: 'اتحفظت الوجبة.', mealName: 'اسم الوجبة', mealNameAr: 'الاسم بالعربي (اختياري)', kind: 'النوع', favoriteFlag: 'حفظ في المفضلة', food: 'الطعام', remove: 'إزالة',
    foodName: 'الاسم بالإنجليزي', foodNameAr: 'الاسم بالعربي', brand: 'العلامة التجارية (اختياري)', barcode: 'الباركود (اختياري)', calories100: 'السعرات لكل 100 جم', protein100: 'البروتين جم / 100 جم', carbs100: 'الكربوهيدرات جم / 100 جم', fat100: 'الدهون جم / 100 جم', fiber100: 'الألياف جم / 100 جم (اختياري)', sugar100: 'السكر جم / 100 جم (اختياري)', sodium100: 'الصوديوم ملجم / 100 جم (اختياري)', servingG: 'حجم الحصة الافتراضي (جم)', dataNote: 'ملاحظة المصدر / الوصفة', save: 'حفظ', cancel: 'إلغاء', close: 'إغلاق',
    missingTargets: 'سجّل أهداف السعرات والماكروز من الملف الشخصي.', savedToast: 'اتسجل الطعام واتحفظت قيمه وقت التسجيل.', updatedToast: 'اتحدّث تعريف الطعام. السجلات القديمة لم تتغير.', deletedToast: 'اتنقل للسلة؛ السجلات القديمة محفوظة.', restore: 'استعادة', trash: 'سلة المحذوفات', hideTrash: 'إخفاء السلة', emptyTrash: 'السلة فاضية.', deletedFoods: 'أطعمة محذوفة', deletedLogs: 'سجلات محذوفة', deletedMeals: 'وجبات محفوظة محذوفة',
    confirmCopy: 'هيتم نسخ كل أطعمة اليوم السابق إلى التاريخ المحدد، مع الحفاظ على قيمها وقت التسجيل. تكمّل؟', confirmDuplicate: 'هيتكرر كل الطعام في مجموعة الوجبة دي في نفس اليوم. تكمّل؟', confirmDeleteLog: 'انقل سجل الأكل ده للسلة؟', confirmDeleteFood: 'اخفِ تعريف الطعام من البحث؟ السجلات القديمة لن تتأثر.', confirmDeleteMeal: 'انقل الوجبة/الوصفة ومكوناتها للسلة؟', copied: 'تم نسخ الأكل.', duplicated: 'تم تكرار الوجبة.', addedMeal: 'اتضافت الوجبة المحفوظة للسجل.', savedGroup: 'اتحفظت الوجبة والوصفة.', noYesterday: 'مفيش سجلات في اليوم السابق.', noItems: 'أضف مكونًا واحدًا على الأقل.',
    invalidQuantity: 'اكتب كمية أكبر من صفر بالجرام.', invalidFood: 'راجع اسم الطعام والسعرات والماكروز.', invalidRecipe: 'اكتب اسمًا وأضف مكونًا واحدًا على الأقل.', customTypeNeed: 'اكتب اسم نوع الوجبة المخصص.',
    sourceFooter: 'قيم البذور مرجعية أو تقديرية وقابلة للتعديل. الأكلات المركبة تختلف حسب الوصفة؛ سجّل المكونات منفصلة لو عايز دقة أعلى.', optionalPartial: 'الألياف والسكر والصوديوم ممكن يكونوا ناقصين لو المصدر ما نشرش القيمة.',
    grams: 'جم', kcal: 'kcal', deleted: 'محذوف', onlyKnown: 'القيم الاختيارية تشمل العناصر المعروفة فقط.', searchLoading: 'جاري تحميل قاعدة الأطعمة…',
  },
  en: {
    title: 'Nutrition', subtitle: 'Log food in grams and track today’s target', day: 'Day', date: 'Date',
    copyPrevious: 'Copy previous day', target: 'Daily target', editTargets: 'Edit targets', noTarget: 'No daily target is saved for this date.',
    calories: 'Calories', consumed: 'Consumed', remaining: 'Remaining', over: 'Over target', protein: 'Protein', carbs: 'Carbohydrates', fat: 'Fat',
    fiber: 'Fiber', sugar: 'Sugar', sodium: 'Sodium', optionalNote: 'Optional totals include only foods with a recorded value.',
    targetCheck: 'Target check', targetBalanced: 'Target calories are within 5% of the 4/4/9 macro estimate.', targetWarning: 'Notice: macro energy ({macro} kcal) differs from the calorie target ({target} kcal) by {percent}%. Review your targets.',
    searchTitle: 'Find and add food', search: 'Search in Arabic or English', allFoods: 'All', favorites: 'Favorites', recent: 'Recently used',
    addCustom: 'Add custom food', noFoods: 'No matching foods. Try another term or add a custom food.', per100: 'per 100 g', estimate: 'Starter estimate', seedSource: 'Editable starting value', pick: 'Select', edit: 'Edit', favorite: 'Add to favorites', unfavorite: 'Remove from favorites',
    addToLog: 'Add to log', amount: 'Amount (g)', serving: 'Serving', mealType: 'Meal type', breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack', custom: 'Custom', mealLabel: 'Custom meal name', note: 'Note (optional)', preview: 'Amount total',
    mealsToday: 'Meals for this day', emptyDay: 'No food has been logged for this date.', saveGroup: 'Save this meal as a recipe', duplicate: 'Duplicate meal', editLog: 'Edit', deleteLog: 'Move to trash',
    savedTitle: 'Saved meals & recipes', newRecipe: 'Create meal / recipe', meal: 'Meal', recipe: 'Recipe', ingredients: 'Ingredients', addIngredient: 'Add ingredient', noSaved: 'No saved meals yet. Save a logged meal or create a recipe.', applyMeal: 'Add to day', deleteSaved: 'Move to trash', saved: 'Meal saved.', mealName: 'Meal name', mealNameAr: 'Arabic name (optional)', kind: 'Kind', favoriteFlag: 'Save as favorite', food: 'Food', remove: 'Remove',
    foodName: 'Name', foodNameAr: 'Arabic name', brand: 'Brand (optional)', barcode: 'Barcode (optional)', calories100: 'Calories per 100 g', protein100: 'Protein g / 100 g', carbs100: 'Carbohydrates g / 100 g', fat100: 'Fat g / 100 g', fiber100: 'Fiber g / 100 g (optional)', sugar100: 'Sugar g / 100 g (optional)', sodium100: 'Sodium mg / 100 g (optional)', servingG: 'Default serving size (g)', dataNote: 'Source / recipe note', save: 'Save', cancel: 'Cancel', close: 'Close',
    missingTargets: 'Set calorie and macro targets in your profile.', savedToast: 'Food logged with its values saved as a snapshot.', updatedToast: 'Food definition updated. Previous logs were not changed.', deletedToast: 'Moved to trash; previous logs are preserved.', restore: 'Restore', trash: 'Trash', hideTrash: 'Hide trash', emptyTrash: 'Trash is empty.', deletedFoods: 'Deleted foods', deletedLogs: 'Deleted food logs', deletedMeals: 'Deleted saved meals',
    confirmCopy: 'Copy all food logs from the previous day to the selected date, preserving their logged nutrition snapshots. Continue?', confirmDuplicate: 'Duplicate every item in this meal group on the same day. Continue?', confirmDeleteLog: 'Move this food log to trash?', confirmDeleteFood: 'Hide this food from search? Existing logs will not change.', confirmDeleteMeal: 'Move this saved meal/recipe and its items to trash?', copied: 'Food logs copied.', duplicated: 'Meal duplicated.', addedMeal: 'Saved meal added to the log.', savedGroup: 'Meal/recipe saved.', noYesterday: 'No food logs exist for the previous day.', noItems: 'Add at least one ingredient.',
    invalidQuantity: 'Enter a quantity greater than zero grams.', invalidFood: 'Check the food name, calories, and macros.', invalidRecipe: 'Enter a name and add at least one ingredient.', customTypeNeed: 'Enter a custom meal type name.',
    sourceFooter: 'Seed values are references or estimates and can be edited. Composite dishes vary by recipe; log ingredients separately for more accuracy.', optionalPartial: 'Fiber, sugar, or sodium may be missing when the source did not report a value.',
    grams: 'g', kcal: 'kcal', deleted: 'Deleted', onlyKnown: 'Optional totals include known values only.', searchLoading: 'Loading the food database…',
  },
};
const tr = key => (text[document.documentElement.lang === 'en' ? 'en' : 'ar'][key] ?? key);
const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const fmt = (value, digits = 1) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? new Intl.NumberFormat(document.documentElement.lang === 'en' ? 'en-US' : 'ar-EG', { maximumFractionDigits: digits }).format(Number(value)) : '—';
const locale = () => document.documentElement.lang === 'en' ? 'en' : 'ar';
const mealCopy = {
  ar: {
    title: 'وجبة سريعة', hint: 'اكتب كل طعام والكمية بالجرام، في سطر أو بفاصلة.', inputLabel: 'الأطعمة والكميات', placeholder: 'شوفان 120 جرام، لبن 100 جرام', accepted: 'الوحدات: جرام، جم، g، gr، gram، grams', parse: 'راجع الوجبة',
    empty: 'اكتب طعامًا واحدًا على الأقل مع كمية بالجرام.', invalidLine: 'السطر {line} مش هيتسجل: اكتب اسم الطعام وكمية صحيحة بالجرام.', choose: 'اختار طعامًا محفوظًا أو طعامًا جديدًا', newFood: 'طعام جديد',
    method: 'اختار طريقة إدخال القيم', manual: 'أدخل القيم', ai: 'الـ AI يقدّرها', manualHint: 'اكتب القيم لهذه الكمية ({grams} جم). هتفضل قابلة للتعديل قبل الحفظ.', aiHint: 'تقدير تقريبي؛ راجع وعدّل كل قيمة قبل الحفظ.',
    estimate: 'قدّر الأطعمة الجديدة المحددة', answer: 'جاوب على السؤال واطلب التقدير مرة تانية', question: 'سؤال للتوضيح', answerPlaceholder: 'اكتب إجابتك', waiting: 'اختار يدوي أو AI لكل طعام جديد. مش هيحصل اتصال أو حفظ قبل اختيارك.',
    kcal: 'السعرات', protein: 'البروتين (جم)', carbs: 'الكربوهيدرات (جم)', fat: 'الدهون (جم)', total: 'مجموع الوجبة المحسوب في التطبيق', aiSavedEstimate: 'تقدير AI', methodRequired: MEAL_METHOD_REQUIRED_MESSAGE,
    approve: 'أوافق واحفظ الوجبة', cancel: 'إلغاء ومسح المسودة', skipped: 'الأسطر غير الصالحة هتتجاهل، ومش هتتحفظ.', invalidValues: 'راجع كل القيم؛ لازم تكون أرقامًا صحيحة غير سالبة.',
    saved: 'اتحفظت الوجبة والأطعمة الجديدة.', saveError: 'تعذر حفظ الوجبة. لم يتم اعتماد العملية؛ جرّب مرة أخرى.', keyCard: 'إعدادات Gemini للأطعمة فقط', keyHint: 'التقدير يرسل أسماء الأطعمة الجديدة المحددة وكمياتها فقط، وأي إجابة تكتبها لسؤال التوضيح. لا يرسل بيانات الملف أو التاريخ الصحي.',
    keyLabel: 'مفتاح Gemini API', modelLabel: 'اسم موديل Gemini', saveSettings: 'حفظ الإعدادات على هذا الجهاز', clearKey: 'مسح المفتاح', keySaved: 'المفتاح محفوظ على هذا الجهاز فقط؛ لا يدخل في المزامنة أو النسخة الاحتياطية.', noKey: 'لم يُحفظ مفتاح على هذا الجهاز.', settingsSaved: 'اتحفظ اسم الموديل؛ المفتاح السابق لم يتغير.', keyCleared: 'تم مسح المفتاح من هذا الجهاز.', settingsError: 'تعذر حفظ الإعدادات على هذا الجهاز.', keyRequired: GEMINI_KEY_REQUIRED_MESSAGE, apiError: 'رد Gemini: ',
  },
  en: {
    title: 'Quick meal box', hint: 'Enter each food and its gram amount on a line or separated by commas.', inputLabel: 'Foods and amounts', placeholder: 'oats 120 g, milk 100 g', accepted: 'Units: grams, gram, gr, g, جرام, جم', parse: 'Review meal',
    empty: 'Enter at least one food with a gram amount.', invalidLine: 'Line {line} will be skipped: enter a food name and a valid gram amount.', choose: 'Choose a saved food or a new food', newFood: 'New food',
    method: 'Choose how to add values', manual: 'Enter values', ai: 'Ask AI to estimate', manualHint: 'Enter totals for this amount ({grams} g). Values stay editable before saving.', aiHint: 'Estimate only; review and edit every value before saving.',
    estimate: 'Estimate selected new foods', answer: 'Answer and request the estimate again', question: 'Clarification question', answerPlaceholder: 'Your answer', waiting: 'Choose manual or AI for every new food. No request or save happens before you choose.',
    kcal: 'Calories', protein: 'Protein (g)', carbs: 'Carbohydrates (g)', fat: 'Fat (g)', total: 'Meal total, calculated in the app', aiSavedEstimate: 'AI estimate', methodRequired: MEAL_METHOD_REQUIRED_MESSAGE,
    approve: 'Approve and save meal', cancel: 'Cancel and clear draft', skipped: 'Invalid lines will be skipped and will not be saved.', invalidValues: 'Check every value; enter valid non-negative numbers.',
    saved: 'Meal and new foods saved.', saveError: 'The meal could not be saved. The transaction was not accepted; please try again.', keyCard: 'Food-only Gemini settings', keyHint: 'An estimate sends only the selected new food names and grams, plus any answer you enter for a clarification. Profile or health history is never sent.',
    keyLabel: 'Gemini API key', modelLabel: 'Gemini model name', saveSettings: 'Save settings on this device', clearKey: 'Clear key', keySaved: 'Key is stored on this device only; it is not synced or included in backups.', noKey: 'No key is saved on this device.', settingsSaved: 'Model saved; any existing key was unchanged.', keyCleared: 'Key cleared from this device.', settingsError: 'Settings could not be saved on this device.', keyRequired: GEMINI_KEY_REQUIRED_MESSAGE, apiError: 'Gemini response: ',
  },
};
const mt = key => mealCopy[locale()][key] ?? text[locale()][key] ?? key;
let db;
let view;
let cache = { foods: [], logs: [], meals: [], items: [], targets: [] };
const ui = { selectedDate: today(), search: '', filter: 'all', selectedFoodId: null, amount: '', mealType: 'breakfast', mealLabel: '', recipeDraft: [], showTrash: false, mealText: '', mealDraft: null, mealBusy: false, mealError: '', geminiKeyDraft: '', geminiModelDraft: '', geminiSettingsStatus: '' };

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const upgradeDb = request.result;
      for (const name of ['foods', 'food_logs', 'saved_meals', 'saved_meal_items']) {
        if (!upgradeDb.objectStoreNames.contains(name)) {
          const store = upgradeDb.createObjectStore(name, { keyPath: 'id' });
          store.createIndex('updated_at', 'updated_at');
          if (name === 'foods') {
            store.createIndex('name', 'name');
            store.createIndex('source', 'source');
            store.createIndex('is_favorite', 'is_favorite');
            store.createIndex('last_used_at', 'last_used_at');
          }
          if (name === 'food_logs') {
            store.createIndex('local_date', 'local_date');
            store.createIndex('food_id', 'food_id');
            store.createIndex('meal_type', 'meal_type');
            store.createIndex('timestamp', 'timestamp');
          }
          if (name === 'saved_meals') {
            store.createIndex('name', 'name');
            store.createIndex('is_favorite', 'is_favorite');
          }
          if (name === 'saved_meal_items') {
            store.createIndex('saved_meal_id', 'saved_meal_id');
            store.createIndex('food_id', 'food_id');
          }
        }
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}
function all(storeName) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function transaction(storeNames, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');
    const writes = [];
    const trackedTx = {
      objectStore(storeName) {
        const store = tx.objectStore(storeName);
        return new Proxy(store, {
          get(target, property) {
            const method = Reflect.get(target, property, target);
            if (property === 'put' || property === 'add') return (row, ...args) => {
              writes.push([storeName, row]);
              return method.apply(target, [row, ...args]);
            };
            return typeof method === 'function' ? method.bind(target) : method;
          },
        });
      },
    };
    try { operation(trackedTx); } catch (error) { tx.abort(); reject(error); return; }
    tx.oncomplete = () => {
      for (const [storeName, row] of writes) window.azabQueueSyncWrite?.(storeName, row);
      resolve();
    };
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed.'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted.'));
  });
}
async function seedMissingFoods() {
  const existing = await all('foods');
  const ids = new Set(existing.map(food => food.id));
  const missing = FOOD_SEEDS.filter(seed => !ids.has(seed.id));
  if (!missing.length) return;
  const time = now();
  await transaction(['foods'], tx => {
    const store = tx.objectStore('foods');
    for (const seed of missing) store.put({
      ...seed, source: 'seed', brand: null, barcode: null, is_favorite: false, last_used_at: null,
      deleted_at: null, created_at: time, updated_at: time,
    });
  });
}
function localDateOffset(date, offset) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + offset);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
function localizedFood(food) {
  return locale() === 'ar' ? (food.name_ar || food.name) : (food.name || food.name_ar);
}
function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}
function mealLabel(type, label) {
  if (type === 'custom') return label || tr('custom');
  return tr(type || 'snack');
}
function mealKey(type, label) { return `${type || 'snack'}\u001f${label || ''}`; }
function mealDataFromKey(key) { const [type, label = ''] = String(key || '').split('\u001f'); return { type, label }; }
function mealToken(type, label) { return encodeURIComponent(JSON.stringify([type || 'snack', label || ''])); }
function decodeMealToken(token) {
  try { const [type, label] = JSON.parse(decodeURIComponent(token)); return { type, label }; }
  catch { return { type: 'snack', label: '' }; }
}
function foodCard(food) {
  const name = localizedFood(food);
  const favorite = Boolean(food.is_favorite);
  const estimate = food.is_estimate ? `<span class="n-estimate">${food.source === 'AI estimate' ? mt('aiSavedEstimate') : tr('estimate')}</span>` : '';
  const foodNote = locale() === 'ar' ? (food.data_note_ar || food.data_note) : (food.data_note_en || food.data_note);
  const note = foodNote ? `<small class="n-food-note">${html(foodNote)}</small>` : '';
  const summary = `${fmt(food.kcal_per_100g, 0)} kcal · P ${fmt(food.protein_g_per_100g)} · C ${fmt(food.carbs_g_per_100g)} · F ${fmt(food.fat_g_per_100g)}`;
  return `<article class="n-food-card"><button type="button" class="n-food-main" data-n-action="select-food" data-id="${html(food.id)}"><span class="n-food-name">${html(name)}</span><span class="n-food-summary">${summary} <span>/ ${tr('per100')}</span></span>${estimate}${note}</button><div class="n-food-actions"><button type="button" class="n-star ${favorite ? 'is-favorite' : ''}" data-n-action="toggle-food-favorite" data-id="${html(food.id)}" aria-label="${favorite ? tr('unfavorite') : tr('favorite')}" title="${favorite ? tr('unfavorite') : tr('favorite')}">${favorite ? '★' : '☆'}</button><button type="button" class="small-btn" data-n-action="edit-food" data-id="${html(food.id)}">${tr('edit')}</button></div></article>`;
}
function getFilteredFoods() {
  const active = cache.foods.filter(food => !food.deleted_at);
  let rows = active;
  if (ui.filter === 'favorites') rows = rows.filter(food => food.is_favorite);
  if (ui.filter === 'recent') rows = rows.filter(food => Number(food.last_used_at) > 0).sort((a, b) => b.last_used_at - a.last_used_at);
  const term = normalizeSearch(ui.search.trim());
  if (term) rows = rows.filter(food => normalizeSearch(`${food.name} ${food.name_ar || ''} ${food.brand || ''} ${food.barcode || ''}`).includes(term));
  if (ui.filter !== 'recent') rows = rows.slice().sort((a, b) => localizedFood(a).localeCompare(localizedFood(b), locale()));
  return rows.slice(0, 80);
}
function renderFoodResults() {
  const box = $('#n-food-results', view);
  if (!box) return;
  const rows = getFilteredFoods();
  box.innerHTML = rows.length ? rows.map(foodCard).join('') : `<p class="n-empty-inline">${tr('noFoods')}</p>`;
}
function renderTargets(target, totals) {
  const check = macroEnergyCheck(target);
  const warning = check.warning
    ? `<div class="n-warning" role="status">${html(tr('targetWarning').replace('{macro}', fmt(check.macroCalories, 0)).replace('{target}', fmt(target.calories, 0)).replace('{percent}', fmt(check.differencePercent, 1)))}</div>`
    : target ? `<p class="n-balanced">${tr('targetBalanced')}</p>` : `<p class="n-muted">${tr('noTarget')}</p>`;
  const rows = [
    ['calories', totals.kcal, target?.calories, 'kcal'],
    ['protein', totals.protein_g, target?.protein_g, 'g'],
    ['carbs', totals.carbs_g, target?.carbs_g, 'g'],
    ['fat', totals.fat_g, target?.fat_g, 'g'],
  ];
  const cards = rows.map(([label, consumed, goal, unit]) => {
    const hasGoal = goal !== null && goal !== undefined && goal !== '' && Number.isFinite(Number(goal));
    const left = hasGoal && Number.isFinite(Number(consumed)) ? Number(goal) - Number(consumed) : null;
    const ratio = hasGoal && Number(goal) > 0 && Number.isFinite(Number(consumed)) ? Math.max(0, Math.min(1, Number(consumed) / Number(goal))) : 0;
    return `<article class="n-macro"><div class="n-macro-head"><span>${tr(label)}</span><strong>${fmt(consumed, label === 'calories' ? 0 : 1)} <small>${unit}</small></strong></div><div class="n-progress"><span style="width:${Math.round(ratio * 100)}%"></span></div><div class="n-macro-foot"><span>${tr('target')}: ${hasGoal ? `${fmt(goal, label === 'calories' ? 0 : 1)} ${unit}` : '—'}</span><span class="${left !== null && left < 0 ? 'n-over' : ''}">${left === null ? '—' : `${left < 0 ? tr('over') : tr('remaining')}: ${fmt(Math.abs(left), label === 'calories' ? 0 : 1)} ${unit}`}</span></div></article>`;
  }).join('');
  return `<article class="card n-target-card"><div class="card-title"><div><h3>${tr('targetCheck')}</h3><p class="n-muted">${target ? `${tr('target')}: ${fmt(target.calories, 0)} kcal` : tr('missingTargets')}</p></div><button type="button" class="text-btn" data-n-action="edit-targets">${tr('editTargets')}</button></div>${warning}<div class="n-macros">${cards}</div><div class="n-optional"><span>${tr('fiber')}: ${fmt(totals.fiber_g)} g</span><span>${tr('sugar')}: ${fmt(totals.sugar_g)} g</span><span>${tr('sodium')}: ${fmt(totals.sodium_mg, 0)} mg</span></div><small class="n-muted">${tr('optionalNote')}</small></article>`;
}
function logRow(log) {
  const name = locale() === 'ar' ? (log.food_name_ar_snapshot || log.food_name_snapshot) : (log.food_name_snapshot || log.food_name_ar_snapshot);
  return `<article class="n-log-row"><div class="n-log-main"><strong>${html(name || tr('food'))}</strong><span>${fmt(log.quantity_g, 1)} ${tr('grams')} · ${fmt(log.kcal, 0)} kcal</span><small>P ${fmt(log.protein_g)} · C ${fmt(log.carbs_g)} · F ${fmt(log.fat_g)}</small>${log.note ? `<small class="n-food-note">${html(log.note)}</small>` : ''}</div><div class="n-log-actions"><button type="button" class="text-btn" data-n-action="edit-log" data-id="${html(log.id)}">${tr('editLog')}</button><button type="button" class="text-btn n-danger-text" data-n-action="delete-log" data-id="${html(log.id)}">${tr('deleteLog')}</button></div></article>`;
}
function renderMealGroups(logs) {
  const groups = new Map();
  for (const log of logs) {
    const key = mealKey(log.meal_type, log.meal_label);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(log);
  }
  const sorted = [...groups.entries()].sort((a, b) => {
    const order = ['breakfast', 'lunch', 'dinner', 'snack', 'custom'];
    const typeA = mealDataFromKey(a[0]).type, typeB = mealDataFromKey(b[0]).type;
    return order.indexOf(typeA) - order.indexOf(typeB) || a[0].localeCompare(b[0]);
  });
  if (!sorted.length) return `<p class="n-empty-inline">${tr('emptyDay')}</p>`;
  return sorted.map(([key, items]) => {
    const data = mealDataFromKey(key);
    const total = sumNutrition(items);
    const token = mealToken(data.type, data.label);
    const title = mealLabel(data.type, data.label);
    return `<section class="n-meal-group"><div class="n-meal-head"><div><h4>${html(title)}</h4><small>${fmt(total.kcal, 0)} kcal · P ${fmt(total.protein_g)} · C ${fmt(total.carbs_g)} · F ${fmt(total.fat_g)}</small></div><div class="n-meal-tools"><button type="button" class="small-btn" data-n-action="save-group" data-meal="${token}">${tr('saveGroup')}</button><button type="button" class="small-btn" data-n-action="duplicate-group" data-meal="${token}">${tr('duplicate')}</button></div></div><div class="n-log-list">${items.slice().sort((a, b) => b.timestamp - a.timestamp).map(logRow).join('')}</div></section>`;
  }).join('');
}
function renderRecipeDraft() {
  const box = $('#n-recipe-draft', view);
  if (!box) return;
  box.innerHTML = ui.recipeDraft.length ? ui.recipeDraft.map((item, index) => {
    const food = cache.foods.find(row => row.id === item.food_id);
    const name = locale() === 'ar' ? (item.food_name_ar_snapshot || food?.name_ar || item.food_name_snapshot || food?.name) : (item.food_name_snapshot || food?.name || item.food_name_ar_snapshot);
    return `<div class="n-recipe-item"><span>${html(name || tr('food'))}</span><strong>${fmt(item.quantity_g, 1)} ${tr('grams')}</strong><button type="button" class="text-btn n-danger-text" data-n-action="remove-recipe-item" data-index="${index}">${tr('remove')}</button></div>`;
  }).join('') : `<p class="n-muted">${tr('noItems')}</p>`;
}
function renderSavedMeals() {
  const container = $('#n-saved-list', view);
  if (!container) return;
  const rows = cache.meals.filter(meal => !meal.deleted_at).sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || (b.updated_at || 0) - (a.updated_at || 0));
  if (!rows.length) { container.innerHTML = `<p class="n-empty-inline">${tr('noSaved')}</p>`; return; }
  container.innerHTML = rows.map(meal => {
    const items = cache.items.filter(item => item.saved_meal_id === meal.id && !item.deleted_at);
    const name = locale() === 'ar' ? (meal.name_ar || meal.name) : meal.name;
    const preview = items.slice(0, 4).map(item => {
      const food = cache.foods.find(row => row.id === item.food_id && !row.deleted_at);
      return locale() === 'ar' ? (item.food_name_ar_snapshot || food?.name_ar || item.food_name_snapshot || food?.name || tr('food')) : (item.food_name_snapshot || food?.name || item.food_name_ar_snapshot || tr('food'));
    }).join(' · ');
    return `<article class="n-saved-card"><div class="n-saved-head"><div><span class="n-kind">${tr(meal.kind === 'recipe' ? 'recipe' : 'meal')}</span><h4>${html(name)}</h4><small>${items.length} ${tr('ingredients')}${preview ? ` · ${html(preview)}` : ''}</small></div><button type="button" class="n-star ${meal.is_favorite ? 'is-favorite' : ''}" data-n-action="toggle-meal-favorite" data-id="${html(meal.id)}" aria-label="${meal.is_favorite ? tr('unfavorite') : tr('favorite')}">${meal.is_favorite ? '★' : '☆'}</button></div><div class="n-saved-actions"><button type="button" class="primary" data-n-action="apply-meal" data-id="${html(meal.id)}">${tr('applyMeal')}</button><button type="button" class="text-btn n-danger-text" data-n-action="delete-meal" data-id="${html(meal.id)}">${tr('deleteSaved')}</button></div></article>`;
  }).join('');
}
function renderTrash() {
  const box = $('#n-trash-list', view);
  if (!box) return;
  const foods = cache.foods.filter(row => row.deleted_at);
  const logs = cache.logs.filter(row => row.deleted_at);
  const meals = cache.meals.filter(row => row.deleted_at);
  if (!foods.length && !logs.length && !meals.length) { box.innerHTML = `<p class="n-empty-inline">${tr('emptyTrash')}</p>`; return; }
  const section = (title, rows, store, label) => rows.length ? `<div class="n-trash-section"><h4>${title}</h4>${rows.map(row => {
    const name = row.food_name_snapshot || row.name_ar || row.name || mealLabel(row.meal_type, row.meal_label) || tr('deleted');
    return `<div class="n-trash-row"><span>${html(name)} ${row.local_date ? `· ${html(row.local_date)}` : ''}</span><button type="button" class="small-btn" data-n-action="restore" data-store="${store}" data-id="${html(row.id)}">${tr('restore')}</button></div>`;
  }).join('')}</div>` : '';
  box.innerHTML = section(tr('deletedFoods'), foods, 'foods') + section(tr('deletedLogs'), logs, 'food_logs') + section(tr('deletedMeals'), meals, 'saved_meals');
}
function foodOptions() {
  return cache.foods.filter(food => !food.deleted_at).slice().sort((a, b) => localizedFood(a).localeCompare(localizedFood(b), locale()))
    .map(food => `<option value="${html(food.id)}">${html(localizedFood(food))}</option>`).join('');
}
function mealEntryFood(entry) {
  if (!entry?.choice?.startsWith('food:')) return null;
  return cache.foods.find(food => food.id === entry.choice.slice(5) && !food.deleted_at) || null;
}
function mealEntryPortionValues(entry) {
  if (entry?.choice?.startsWith('food:')) {
    const food = mealEntryFood(entry);
    return food ? scaleNutrition(nutritionPer100g(food), entry.grams) : null;
  }
  if (entry?.choice !== 'new') return null;
  const input = entry.method === 'manual' ? entry.manualValues : entry.method === 'ai' ? entry.aiValues : null;
  if (!input || entry.question) return null;
  try { return scaleNutrition(portionToPer100(input, entry.grams), entry.grams); }
  catch { return null; }
}
function mealValuesMarkup(values, line, kind) {
  const fields = [
    ['kcal', 'kcal'], ['protein_g', 'protein'], ['carbs_g', 'carbs'], ['fat_g', 'fat'],
  ];
  return `<div class="n-meal-values">${fields.map(([field, label]) => `<label><span>${mt(label)}</span><input type="number" min="0" max="100000" step="0.1" inputmode="decimal" value="${values?.[field] ?? ''}" data-meal-value="${field}" data-meal-line="${line}" data-meal-kind="${kind}" aria-label="${mt(label)}"></label>`).join('')}</div>`;
}
function mealEntryMarkup(entry, index) {
  const controls = mealEntryControlState(entry);
  const exact = entry.exactMatches || [];
  const similar = entry.similarFoods || [];
  const candidates = exact.length ? exact : similar.map(item => item.food);
  const selectedFood = mealEntryFood(entry);
  const needsChoice = exact.length !== 1 || similar.length > 0;
  const choiceMarkup = needsChoice ? `<label class="n-meal-choice"><span>${mt('choose')}</span><select data-meal-field="choice" data-meal-line="${index}"><option value="" ${controls.choice ? '' : 'selected'}>${mt('choose')}</option>${candidates.map(food => `<option value="food:${html(food.id)}" ${controls.choice === `food:${food.id}` ? 'selected' : ''}>${html(localizedFood(food))}</option>`).join('')}<option value="new" ${controls.choice === 'new' ? 'selected' : ''}>${mt('newFood')}</option></select></label>` : '';
  const name = selectedFood ? localizedFood(selectedFood) : entry.inputName;
  const values = mealEntryPortionValues(entry);
  let detail = '';
  if (entry.choice === 'new') {
    const locked = ui.mealDraft.initialAiRequested && !entry.question;
    detail = `<fieldset class="n-meal-method" ${ui.mealBusy ? 'disabled' : ''}><legend>${mt('method')}</legend><label><input type="radio" name="meal-method-${index}" value="manual" data-meal-field="method" data-meal-line="${index}" ${controls.method === 'manual' ? 'checked' : ''} ${locked ? 'disabled' : ''}><span>${mt('manual')}</span></label><label><input type="radio" name="meal-method-${index}" value="ai" data-meal-field="method" data-meal-line="${index}" ${controls.method === 'ai' ? 'checked' : ''} ${locked ? 'disabled' : ''}><span>${mt('ai')}</span></label></fieldset>`;
    if (entry.method === 'manual') {
      detail += `<p class="n-muted">${mt('manualHint').replace('{grams}', fmt(entry.grams, 1))}</p>${mealValuesMarkup(entry.manualValues, index, 'manual')}`;
    } else if (entry.method === 'ai') {
      detail += `<p class="n-estimate-note">${mt('aiHint')}</p>`;
      if (entry.question) {
        detail += `<div class="n-meal-question"><strong>${mt('question')}</strong><p>${html(entry.question)}</p><label><span>${mt('answerPlaceholder')}</span><textarea rows="2" maxlength="300" data-meal-field="answer" data-meal-line="${index}">${html(entry.answer || '')}</textarea></label></div>`;
      }
      if (entry.aiValues) detail += mealValuesMarkup(entry.aiValues, index, 'ai');
    }
  }
  const summary = values ? `<p class="n-meal-item-total">${fmt(entry.grams, 1)} ${mt('grams')} · ${fmt(values.kcal, 0)} kcal · P ${fmt(values.protein_g)} · C ${fmt(values.carbs_g)} · F ${fmt(values.fat_g)}</p>` : '';
  return `<article class="n-meal-entry"><div class="n-meal-entry-head"><strong>${html(name)}</strong><span>${fmt(entry.grams, 1)} ${mt('grams')}</span></div>${choiceMarkup}${selectedFood ? `<p class="n-meal-item-total">${fmt(values?.kcal, 0)} kcal · P ${fmt(values?.protein_g)} · C ${fmt(values?.carbs_g)} · F ${fmt(values?.fat_g)}</p>` : ''}${detail}${!selectedFood && entry.choice !== 'new' ? `<p class="n-muted">${mt('choose')}</p>` : ''}${entry.choice === 'new' && !entry.method ? `<p class="n-muted">${mt('waiting')}</p>` : ''}${entry.choice === 'new' && entry.method === 'ai' && !entry.question && !entry.aiValues ? `<p class="n-muted">${mt('waiting')}</p>` : ''}${entry.choice === 'new' ? summary : ''}</article>`;
}
function renderMealBox() {
  const draft = ui.mealDraft;
  const entries = draft?.entries || [];
  const ready = canApproveMeal(entries, cache.foods);
  const values = entries.map(mealEntryPortionValues).filter(Boolean);
  const total = sumPortionValues(values);
  const selected = selectedAiItems(entries);
  const missingMethod = mealEntriesMissingMethod(entries).length > 0;
  const status = mealEstimateStatus(ui.mealBusy);
  const questions = entries.filter(entry => entry.choice === 'new' && entry.method === 'ai' && entry.question);
  const canAnswer = questions.length > 0 && questions.every(entry => entry.answer?.trim());
  const parseErrors = (draft?.errors || []).map(error => `<li>${html(mt('invalidLine').replace('{line}', error.line).replace('{text}', error.raw))}</li>`).join('');
  const detail = draft ? `<div class="n-meal-review">${parseErrors ? `<ul class="n-meal-errors">${parseErrors}</ul><p class="n-muted">${mt('skipped')}</p>` : ''}${entries.map(mealEntryMarkup).join('')}${!entries.length ? `<p class="n-muted">${mt('empty')}</p>` : ''}${missingMethod ? `<p class="n-form-error" role="alert">${mt('methodRequired')}</p>` : ''}${ui.mealError ? `<p class="n-form-error" role="alert">${html(mealErrorMessage())}</p>` : ''}${status ? `<p class="n-muted" role="status" aria-live="polite">${html(status)}</p>` : ''}${values.length ? `<div class="n-meal-total" id="n-meal-total"><strong>${mt('total')}</strong><span>${fmt(total.kcal, 0)} kcal · P ${fmt(total.protein_g)} · C ${fmt(total.carbs_g)} · F ${fmt(total.fat_g)}</span></div>` : ''}<div class="n-meal-actions">${selected.length && !draft.initialAiRequested ? `<button type="button" class="secondary" data-n-action="estimate-meal" ${ui.mealBusy ? 'disabled' : ''}>${mt('estimate')}</button>` : ''}${questions.length ? `<button type="button" class="secondary" data-n-action="answer-meal" ${canAnswer && !ui.mealBusy ? '' : 'disabled'}>${mt('answer')}</button>` : ''}<button type="button" class="primary" data-n-action="approve-meal" ${ready && !ui.mealBusy ? '' : 'disabled'}>${mt('approve')}</button><button type="button" class="text-btn" data-n-action="cancel-meal" ${ui.mealBusy ? 'disabled' : ''}>${mt('cancel')}</button></div></div>` : '';
  return `<article class="card n-meal-box"><div class="card-title"><div><h3>${mt('title')}</h3><p class="n-muted">${mt('hint')}</p></div></div><label class="n-meal-input-label"><span>${mt('inputLabel')}</span><textarea id="n-meal-input" rows="3" maxlength="1000" placeholder="${mt('placeholder')}">${html(ui.mealText)}</textarea></label><div class="n-meal-parse-row"><button type="button" class="secondary" data-n-action="parse-meal">${mt('parse')}</button><small>${mt('accepted')}</small></div>${detail}</article>`;
}
function mealErrorMessage() {
  if (!ui.mealError || typeof ui.mealError === 'string') return ui.mealError || '';
  return `${mt(ui.mealError.key)}${ui.mealError.detail || ''}`;
}
function localStorageOrNull() {
  try { return window.localStorage; } catch { return null; }
}
function renderGeminiSettingsCard(force = false) {
  const host = $('#settings');
  if (!host) return;
  let card = $('#n-gemini-settings', host);
  if (!card) {
    card = document.createElement('article');
    card.id = 'n-gemini-settings';
    card.className = 'card n-gemini-settings';
    host.appendChild(card);
  }
  if (!force && card.dataset.locale === locale()) return;
  const storage = localStorageOrNull();
  const saved = Boolean(readGeminiApiKey(storage));
  const model = ui.geminiModelDraft || readGeminiModel(storage) || DEFAULT_GEMINI_MODEL;
  card.innerHTML = `<div class="card-title"><div><h3>${mt('keyCard')}</h3><p class="n-muted">${mt('keyHint')}</p></div></div><label><span>${mt('keyLabel')}</span><input id="n-gemini-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" value="${html(ui.geminiKeyDraft)}"></label><label><span>${mt('modelLabel')}</span><input id="n-gemini-model" type="text" autocomplete="off" value="${html(model)}"></label><p class="n-gemini-status" role="status">${html(ui.geminiSettingsStatus ? mt(ui.geminiSettingsStatus) : (saved ? mt('keySaved') : mt('noKey')))}</p><div class="n-gemini-actions"><button type="button" class="secondary" data-gemini-action="save">${mt('saveSettings')}</button><button type="button" class="text-btn" data-gemini-action="clear">${mt('clearKey')}</button></div>`;
  card.dataset.locale = locale();
}
function installGeminiSettingsCard() {
  const host = $('#settings');
  if (!host || host.dataset.mealGeminiBound) return;
  host.dataset.mealGeminiBound = 'true';
  host.addEventListener('input', event => {
    if (event.target.id === 'n-gemini-key') ui.geminiKeyDraft = event.target.value;
    if (event.target.id === 'n-gemini-model') ui.geminiModelDraft = event.target.value;
  });
  host.addEventListener('click', event => {
    const button = event.target.closest('[data-gemini-action]');
    if (!button || !host.contains(button)) return;
    const storage = localStorageOrNull();
    try {
      if (!storage) throw new Error('storage');
      if (button.dataset.geminiAction === 'clear') {
        clearGeminiApiKey(storage);
        ui.geminiKeyDraft = '';
        ui.geminiSettingsStatus = 'keyCleared';
      } else {
        saveGeminiModel(storage, $('#n-gemini-model', host)?.value || '');
        const key = $('#n-gemini-key', host)?.value.trim() || '';
        if (key) saveGeminiApiKey(storage, key);
        ui.geminiKeyDraft = '';
        ui.geminiModelDraft = '';
        ui.geminiSettingsStatus = key ? 'keySaved' : 'settingsSaved';
      }
    } catch {
      ui.geminiSettingsStatus = 'settingsError';
    }
    renderGeminiSettingsCard(true);
  });
  document.addEventListener('azab:language-changed', () => renderGeminiSettingsCard(true));
  const observer = new MutationObserver(() => {
    if (!$('#n-gemini-settings', host)) renderGeminiSettingsCard(true);
  });
  observer.observe(host, { childList: true });
  renderGeminiSettingsCard(true);
}
function parseMealBox() {
  ui.mealText = $('#n-meal-input', view)?.value || '';
  ui.mealError = '';
  ui.mealBusy = false;
  const draft = prepareMealDraft(ui.mealText, cache.foods);
  ui.mealDraft = draft;
  if (!draft.entries.length && !draft.errors.length) ui.mealError = { key: 'empty' };
  renderNutrition();
}
function entryForLine(line) {
  return ui.mealDraft?.entries?.[Number(line)] || null;
}
function updateMealControls() {
  if (!ui.mealDraft) return;
  const approve = $('[data-n-action="approve-meal"]', view);
  if (approve) approve.disabled = ui.mealBusy || !canApproveMeal(ui.mealDraft.entries, cache.foods);
  const questions = ui.mealDraft.entries.filter(entry => entry.choice === 'new' && entry.method === 'ai' && entry.question);
  const answer = $('[data-n-action="answer-meal"]', view);
  if (answer) answer.disabled = ui.mealBusy || !questions.length || !questions.every(entry => entry.answer?.trim());
}
function updateMealTotal() {
  const totalElement = $('#n-meal-total', view);
  if (!ui.mealDraft) return;
  const values = ui.mealDraft.entries.map(mealEntryPortionValues).filter(Boolean);
  if (totalElement && values.length) {
    const total = sumPortionValues(values);
    totalElement.innerHTML = `<strong>${mt('total')}</strong><span>${fmt(total.kcal, 0)} kcal · P ${fmt(total.protein_g)} · C ${fmt(total.carbs_g)} · F ${fmt(total.fat_g)}</span>`;
  }
  updateMealControls();
}
function applyGeminiResult(result, requested) {
  const available = new Set(requested.map((_, index) => index));
  for (const item of result.items) {
    const index = [...available].find(candidate => normalizeMealName(requested[candidate].inputName) === normalizeMealName(item.name) && Math.abs(requested[candidate].grams - item.grams) <= 0.01);
    if (index === undefined) continue;
    available.delete(index);
    const entry = requested[index];
    entry.aiValues = { kcal: item.kcal, protein_g: item.protein_g, carbs_g: item.carbs_g, fat_g: item.fat_g };
    entry.question = null;
    entry.answer = '';
  }
  for (const question of result.questions) {
    const index = [...available].find(candidate => normalizeMealName(requested[candidate].inputName) === normalizeMealName(question.name) && Math.abs(requested[candidate].grams - question.grams) <= 0.01);
    if (index === undefined) continue;
    available.delete(index);
    const entry = requested[index];
    entry.aiValues = null;
    entry.question = question.question;
    entry.answer = '';
  }
}
function normalizeMealName(value) {
  return String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
}
async function requestMealEstimate(clarify = false) {
  const entries = ui.mealDraft?.entries || [];
  const requested = clarify
    ? entries.filter(entry => entry.choice === 'new' && entry.method === 'ai' && entry.question && entry.answer?.trim())
    : entries.filter(entry => entry.choice === 'new' && entry.method === 'ai');
  if (!requested.length) { ui.mealError = { key: clarify ? 'answer' : 'waiting' }; await renderNutrition(); return; }
  const storage = localStorageOrNull();
  const apiKey = readGeminiApiKey(storage);
  if (!apiKey) { ui.mealError = { key: 'keyRequired' }; await renderNutrition(); return; }
  const clarifications = clarify ? requested.map(entry => ({ name: entry.inputName, grams: entry.grams, question: entry.question, answer: entry.answer })) : [];
  ui.mealBusy = true;
  ui.mealError = '';
  await renderNutrition();
  try {
    const result = await requestSelectedAiItems(requested, { apiKey, model: readGeminiModel(storage), clarifications });
    applyGeminiResult(result, requested);
    if (!clarify) ui.mealDraft.initialAiRequested = true;
  } catch (error) {
    ui.mealError = { key: 'apiError', detail: String(error?.message || 'تعذر تنفيذ الطلب. / Request failed.').split(apiKey).join('[redacted]') };
    if (!clarify) ui.mealDraft.initialAiRequested = false;
  } finally {
    ui.mealBusy = false;
    await renderNutrition();
  }
}
async function approveMealBox() {
  const entries = ui.mealDraft?.entries || [];
  if (mealEntriesMissingMethod(entries).length) { ui.mealError = { key: 'methodRequired' }; await renderNutrition(); return; }
  if (!canApproveMeal(entries, cache.foods)) { ui.mealError = { key: 'invalidValues' }; renderNutrition(); return; }
  let meal;
  try { meal = getCurrentMeal(); }
  catch { ui.mealError = { key: 'customTypeNeed' }; renderNutrition(); return; }
  const time = now();
  let plan;
  try { plan = buildMealApprovalPlan({ entries, foods: cache.foods, meal, localDate: ui.selectedDate, timestamp: time, createId: uid }); }
  catch { ui.mealError = { key: 'invalidValues' }; renderNutrition(); return; }
  if (!plan) { ui.mealError = { key: 'invalidValues' }; renderNutrition(); return; }
  try {
    await applyMealApprovalAction('approve', {
      plan,
      write: ({ foodsToWrite, logsToWrite }) => transaction(['foods', 'food_logs'], tx => {
        for (const food of foodsToWrite) tx.objectStore('foods').put(food);
        for (const log of logsToWrite) tx.objectStore('food_logs').put(log);
      }),
    });
  } catch {
    ui.mealError = { key: 'saveError' };
    renderNutrition();
    return;
  }
  ui.mealText = '';
  ui.mealDraft = null;
  ui.mealError = '';
  await renderNutrition();
  notify(mt('saved'));
}
function renderShell(target, totals, dayLogs) {
  const custom = ui.mealType === 'custom';
  const selectedFood = cache.foods.find(food => food.id === ui.selectedFoodId && !food.deleted_at);
  const preview = selectedFood && Number(ui.amount) > 0 ? scaleNutrition(nutritionPer100g(selectedFood), Number(ui.amount)) : null;
  const filters = [['all', 'allFoods'], ['favorites', 'favorites'], ['recent', 'recent']];
  const selectedMeal = ui.mealType;
  return `<div class="section-head n-section-head"><div><p class="muted">FUEL</p><h2>${tr('title')}</h2><p class="n-muted">${tr('subtitle')}</p></div><button type="button" class="secondary" data-n-action="toggle-trash">${ui.showTrash ? tr('hideTrash') : tr('trash')}</button></div>
    ${renderMealBox()}
    <article class="card n-date-card"><label><span>${tr('date')}</span><input id="n-date" type="date" value="${html(ui.selectedDate)}"></label><button type="button" class="secondary" data-n-action="copy-previous">${tr('copyPrevious')}</button><button type="button" class="text-btn" data-n-action="today">${tr('day')}: ${html(today()) === html(ui.selectedDate) ? tr('day') : today()}</button></article>
    ${renderTargets(target, totals)}
    <article class="card n-search-card"><div class="card-title"><h3>${tr('searchTitle')}</h3><button type="button" class="secondary" data-n-action="new-food">${tr('addCustom')}</button></div><label class="n-search-label"><span>${tr('search')}</span><input id="n-food-search" type="search" value="${html(ui.search)}" autocomplete="off" placeholder="${html(tr('search'))}"></label><div class="n-filter-row">${filters.map(([key, label]) => `<button type="button" class="n-filter ${ui.filter === key ? 'active' : ''}" data-n-action="filter" data-filter="${key}">${tr(label)}</button>`).join('')}</div>
    <div class="n-default-meal"><label><span>${tr('mealType')}</span><select id="n-meal-type"><option value="breakfast" ${selectedMeal === 'breakfast' ? 'selected' : ''}>${tr('breakfast')}</option><option value="lunch" ${selectedMeal === 'lunch' ? 'selected' : ''}>${tr('lunch')}</option><option value="dinner" ${selectedMeal === 'dinner' ? 'selected' : ''}>${tr('dinner')}</option><option value="snack" ${selectedMeal === 'snack' ? 'selected' : ''}>${tr('snack')}</option><option value="custom" ${selectedMeal === 'custom' ? 'selected' : ''}>${tr('custom')}</option></select></label><label class="n-custom-meal-label" ${custom ? '' : 'hidden'}><span>${tr('mealLabel')}</span><input id="n-meal-label" maxlength="60" value="${html(ui.mealLabel)}"></label></div>
    <div class="n-food-results" id="n-food-results"></div>
    ${selectedFood ? `<form id="n-log-form" class="n-quick-log"><div class="n-quick-head"><div><strong>${html(localizedFood(selectedFood))}</strong><small>${tr('per100')}: ${fmt(selectedFood.kcal_per_100g, 0)} kcal · P ${fmt(selectedFood.protein_g_per_100g)} · C ${fmt(selectedFood.carbs_g_per_100g)} · F ${fmt(selectedFood.fat_g_per_100g)}</small></div><button type="button" class="text-btn" data-n-action="clear-selected">×</button></div><div class="n-quick-fields"><label><span>${tr('amount')}</span><input id="n-quantity" type="number" min="0.1" max="10000" step="0.1" required inputmode="decimal" value="${html(ui.amount || selectedFood.serving_g || 100)}"></label><button type="button" class="small-btn" data-n-action="use-serving">${tr('serving')} (${fmt(selectedFood.serving_g || 100, 1)} ${tr('grams')})</button></div><div id="n-preview" class="n-preview">${preview ? `${fmt(preview.kcal, 0)} kcal · P ${fmt(preview.protein_g)} · C ${fmt(preview.carbs_g)} · F ${fmt(preview.fat_g)}` : ''}</div><label><span>${tr('note')}</span><input name="note" maxlength="200"></label><button type="submit" class="primary">${tr('addToLog')}</button></form>` : ''}
    <p class="n-source-note">${tr('sourceFooter')} <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener noreferrer">USDA FoodData Central</a></p></article>
    <article class="card n-log-card"><div class="card-title"><h3>${tr('mealsToday')}</h3><span class="pill">${dayLogs.length}</span></div><div class="n-meals">${renderMealGroups(dayLogs)}</div></article>
    <article class="card n-saved-card-wrap"><div class="card-title"><div><h3>${tr('savedTitle')}</h3><p class="n-muted">${tr('ingredients')}</p></div><button type="button" class="primary" data-n-action="new-recipe">${tr('newRecipe')}</button></div><div id="n-saved-list" class="n-saved-list"></div></article>
    ${ui.showTrash ? `<article class="card n-trash-card"><h3>${tr('trash')}</h3><div id="n-trash-list"></div></article>` : ''}
    <div id="n-live" class="n-live" role="status" aria-live="polite"></div>
    <dialog id="n-food-dialog" class="n-dialog"><form id="n-food-form" class="n-dialog-form"><header class="n-dialog-head"><h3 id="n-food-dialog-title">${tr('addCustom')}</h3><button type="button" class="icon-btn" data-n-action="close-food-dialog" aria-label="${tr('close')}">×</button></header><input type="hidden" name="id"><div class="n-form-grid"><label><span>${tr('foodName')}</span><input name="name" maxlength="100" required></label><label><span>${tr('foodNameAr')}</span><input name="name_ar" maxlength="100"></label><label><span>${tr('brand')}</span><input name="brand" maxlength="80"></label><label><span>${tr('barcode')}</span><input name="barcode" maxlength="40" inputmode="numeric"></label><label><span>${tr('calories100')}</span><input name="kcal" type="number" min="0" max="1200" step="0.1" required></label><label><span>${tr('protein100')}</span><input name="protein" type="number" min="0" max="100" step="0.01" required></label><label><span>${tr('carbs100')}</span><input name="carbs" type="number" min="0" max="100" step="0.01" required></label><label><span>${tr('fat100')}</span><input name="fat" type="number" min="0" max="100" step="0.01" required></label><label><span>${tr('fiber100')}</span><input name="fiber" type="number" min="0" max="100" step="0.01"></label><label><span>${tr('sugar100')}</span><input name="sugar" type="number" min="0" max="100" step="0.01"></label><label><span>${tr('sodium100')}</span><input name="sodium" type="number" min="0" max="100000" step="0.1"></label><label><span>${tr('servingG')}</span><input name="serving" type="number" min="0.1" max="10000" step="0.1" value="100"></label><label class="n-span-all"><span>${tr('dataNote')}</span><textarea name="data_note" rows="2" maxlength="300"></textarea></label><label class="n-inline-check"><input type="checkbox" name="favorite"><span>${tr('favoriteFlag')}</span></label></div><p class="n-form-error" id="n-food-error" hidden></p><div class="n-dialog-actions"><button type="button" class="secondary" data-n-action="close-food-dialog">${tr('cancel')}</button><button type="submit" class="primary">${tr('save')}</button></div></form></dialog>
    <dialog id="n-recipe-dialog" class="n-dialog"><form id="n-recipe-form" class="n-dialog-form"><header class="n-dialog-head"><h3>${tr('newRecipe')}</h3><button type="button" class="icon-btn" data-n-action="close-recipe-dialog" aria-label="${tr('close')}">×</button></header><div class="n-form-grid"><label><span>${tr('mealName')}</span><input name="name" maxlength="100" required></label><label><span>${tr('mealNameAr')}</span><input name="name_ar" maxlength="100"></label><label><span>${tr('kind')}</span><select name="kind"><option value="meal">${tr('meal')}</option><option value="recipe">${tr('recipe')}</option></select></label><label class="n-inline-check"><input type="checkbox" name="favorite"><span>${tr('favoriteFlag')}</span></label></div><h4>${tr('ingredients')}</h4><div id="n-recipe-draft" class="n-recipe-draft"></div><div class="n-recipe-add"><label><span>${tr('food')}</span><select id="n-recipe-food">${foodOptions()}</select></label><label><span>${tr('amount')}</span><input id="n-recipe-quantity" type="number" min="0.1" step="0.1" value="100"></label><button type="button" class="secondary" data-n-action="add-recipe-item">${tr('addIngredient')}</button></div><p class="n-form-error" id="n-recipe-error" hidden></p><div class="n-dialog-actions"><button type="button" class="secondary" data-n-action="close-recipe-dialog">${tr('cancel')}</button><button type="submit" class="primary">${tr('save')}</button></div></form></dialog>
    <dialog id="n-log-dialog" class="n-dialog n-log-dialog"><form id="n-log-edit-form" class="n-dialog-form"><header class="n-dialog-head"><h3>${tr('editLog')}</h3><button type="button" class="icon-btn" data-n-action="close-log-dialog" aria-label="${tr('close')}">×</button></header><input type="hidden" name="id"><p id="n-edit-log-name" class="n-log-edit-name"></p><label><span>${tr('amount')}</span><input name="quantity_g" type="number" min="0.1" max="10000" step="0.1" required></label><label><span>${tr('mealType')}</span><select name="meal_type"><option value="breakfast">${tr('breakfast')}</option><option value="lunch">${tr('lunch')}</option><option value="dinner">${tr('dinner')}</option><option value="snack">${tr('snack')}</option><option value="custom">${tr('custom')}</option></select></label><label><span>${tr('mealLabel')}</span><input name="meal_label" maxlength="60"></label><label><span>${tr('note')}</span><input name="note" maxlength="200"></label><div class="n-dialog-actions"><button type="button" class="secondary" data-n-action="close-log-dialog">${tr('cancel')}</button><button type="submit" class="primary">${tr('save')}</button></div></form></dialog>`;
}
async function refreshCache() {
  const [foods, logs, meals, items, targets] = await Promise.all([all('foods'), all('food_logs'), all('saved_meals'), all('saved_meal_items'), all('daily_targets')]);
  cache = { foods, logs, meals, items, targets };
}
async function renderNutrition() {
  if (!view || !db) return;
  await refreshCache();
  const target = effectiveTargetsForDate(cache.targets, ui.selectedDate);
  const dayLogs = cache.logs.filter(log => log.local_date === ui.selectedDate && !log.deleted_at).sort((a, b) => a.timestamp - b.timestamp);
  const totals = sumNutrition(dayLogs);
  view.innerHTML = renderShell(target, totals, dayLogs);
  $$('[data-meal-field="choice"]', view).forEach(control => {
    control.value = mealEntryControlState(entryForLine(control.dataset.mealLine)).choice;
  });
  $$('input[data-meal-field="method"]', view).forEach(control => {
    control.checked = mealEntryControlState(entryForLine(control.dataset.mealLine)).method === control.value;
  });
  bindNutritionForms();
  renderFoodResults();
  renderSavedMeals();
  renderRecipeDraft();
  if (ui.showTrash) renderTrash();
  const mealType = $('#n-meal-type', view);
  if (mealType) mealType.value = ui.mealType;
}
function notify(message) {
  const live = $('#n-live', view);
  if (live) { live.textContent = message; live.classList.add('show'); }
  const toast = $('#toast');
  if (toast) { toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); }
}
function setMealTypeFromForm() {
  ui.mealType = $('#n-meal-type', view)?.value || 'snack';
  ui.mealLabel = $('#n-meal-label', view)?.value.trim() || '';
}
function getCurrentMeal() {
  setMealTypeFromForm();
  if (ui.mealType === 'custom' && !ui.mealLabel) throw new Error(tr('customTypeNeed'));
  return { meal_type: ui.mealType, meal_label: ui.mealType === 'custom' ? ui.mealLabel : '' };
}
async function addFoodLog(food, quantity, meal, note = '') {
  const time = now();
  const row = {
    id: uid(), ...buildFoodSnapshot(food, quantity), ...meal, note: note.trim() || null,
    logged_at: time, timestamp: time, local_date: ui.selectedDate, deleted_at: null, created_at: time, updated_at: time,
  };
  await transaction(['food_logs', 'foods'], tx => {
    tx.objectStore('food_logs').put(row);
    tx.objectStore('foods').put({ ...food, last_used_at: time, updated_at: time });
  });
}
function openFoodEditor(foodId = null) {
  const dialog = $('#n-food-dialog', view);
  const form = $('#n-food-form', view);
  form.reset();
  form.elements.id.value = foodId || '';
  $('#n-food-error', view).hidden = true;
  const food = foodId ? cache.foods.find(row => row.id === foodId) : null;
  $('#n-food-dialog-title', view).textContent = food ? tr('edit') : tr('addCustom');
  if (food) {
    form.elements.name.value = food.name || '';
    form.elements.name_ar.value = food.name_ar || '';
    form.elements.brand.value = food.brand || '';
    form.elements.barcode.value = food.barcode || '';
    form.elements.kcal.value = food.kcal_per_100g ?? '';
    form.elements.protein.value = food.protein_g_per_100g ?? '';
    form.elements.carbs.value = food.carbs_g_per_100g ?? '';
    form.elements.fat.value = food.fat_g_per_100g ?? '';
    form.elements.fiber.value = food.fiber_g_per_100g ?? '';
    form.elements.sugar.value = food.sugar_g_per_100g ?? '';
    form.elements.sodium.value = food.sodium_mg_per_100g ?? '';
    form.elements.serving.value = food.serving_g ?? 100;
    form.elements.data_note.value = food.data_note || '';
    form.elements.favorite.checked = Boolean(food.is_favorite);
  } else {
    form.elements.serving.value = 100;
    form.elements.favorite.checked = false;
  }
  dialog.showModal();
  form.elements.name.focus();
}
async function saveFood(event) {
  event.preventDefault();
  const form = event.target;
  if (!form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form).entries());
  const existing = values.id ? cache.foods.find(food => food.id === values.id) : null;
  const required = ['kcal', 'protein', 'carbs', 'fat'];
  if (!values.name.trim() || required.some(key => values[key] === '' || !Number.isFinite(Number(values[key])) || Number(values[key]) < 0)) {
    const error = $('#n-food-error', view); error.textContent = tr('invalidFood'); error.hidden = false; return;
  }
  const optional = key => values[key] === '' || values[key] == null ? null : Number(values[key]);
  const time = now();
  const row = {
    ...(existing || {}), id: existing?.id || uid(), name: values.name.trim(), name_ar: values.name_ar.trim() || null,
    brand: values.brand.trim() || null, barcode: values.barcode.trim() || null,
    kcal_per_100g: Number(values.kcal), protein_g_per_100g: Number(values.protein), carbs_g_per_100g: Number(values.carbs),
    fat_g_per_100g: Number(values.fat), fiber_g_per_100g: optional('fiber'), sugar_g_per_100g: optional('sugar'),
    sodium_mg_per_100g: optional('sodium'), serving_g: Number(values.serving) > 0 ? Number(values.serving) : 100,
    data_note: values.data_note.trim() || existing?.data_note || null,
    data_note_en: locale() === 'en' ? (values.data_note.trim() || existing?.data_note_en || null) : (existing?.data_note_en || null),
    data_note_ar: locale() === 'ar' ? (values.data_note.trim() || existing?.data_note_ar || null) : (existing?.data_note_ar || null), is_favorite: form.elements.favorite.checked,
    source: existing?.source || 'custom', is_estimate: existing?.is_estimate || false, source_reference: existing?.source_reference || null,
    source_fdc_id: existing?.source_fdc_id || null, last_used_at: existing?.last_used_at || null, deleted_at: null,
    created_at: existing?.created_at || time, updated_at: time,
  };
  await transaction(['foods'], tx => tx.objectStore('foods').put(row));
  $('#n-food-dialog', view).close();
  await renderNutrition();
  notify(existing ? tr('updatedToast') : tr('saved'));
}
function openRecipeDialog(draft = [], defaultKind = 'recipe', defaultName = '') {
  ui.recipeDraft = draft.map(item => ({ ...item }));
  const dialog = $('#n-recipe-dialog', view);
  const form = $('#n-recipe-form', view);
  form.reset();
  form.elements.kind.value = defaultKind;
  form.elements.name.value = defaultName;
  form.elements.favorite.checked = false;
  $('#n-recipe-error', view).hidden = true;
  renderRecipeDraft();
  dialog.showModal();
  form.elements.name.focus();
}
function recipeItemFromLog(log) {
  return {
    food_id: log.food_id || null,
    food_name_snapshot: log.food_name_snapshot || '',
    food_name_ar_snapshot: log.food_name_ar_snapshot || log.food_name_snapshot || '',
    nutrition_per_100g_snapshot: log.nutrition_per_100g_snapshot || null,
    quantity_g: Number(log.quantity_g) || 0,
  };
}
async function saveRecipe(event) {
  event.preventDefault();
  const form = event.target;
  if (!form.reportValidity()) return;
  const name = form.elements.name.value.trim();
  if (!name || !ui.recipeDraft.length) {
    const error = $('#n-recipe-error', view); error.textContent = tr('invalidRecipe'); error.hidden = false; return;
  }
  const time = now(), mealId = uid();
  const meal = { id: mealId, name, name_ar: form.elements.name_ar.value.trim() || null, kind: form.elements.kind.value === 'meal' ? 'meal' : 'recipe', is_favorite: form.elements.favorite.checked, deleted_at: null, ...stamp() };
  const items = ui.recipeDraft.map((draft, position) => ({
    id: uid(), saved_meal_id: mealId, food_id: draft.food_id || null,
    food_name_snapshot: draft.food_name_snapshot || '', food_name_ar_snapshot: draft.food_name_ar_snapshot || draft.food_name_snapshot || '',
    nutrition_per_100g_snapshot: draft.nutrition_per_100g_snapshot || null, quantity_g: Number(draft.quantity_g), position,
    deleted_at: null, created_at: time, updated_at: time,
  }));
  await transaction(['saved_meals', 'saved_meal_items'], tx => {
    tx.objectStore('saved_meals').put(meal);
    for (const item of items) tx.objectStore('saved_meal_items').put(item);
  });
  $('#n-recipe-dialog', view).close();
  ui.recipeDraft = [];
  await renderNutrition();
  notify(tr('savedGroup'));
}
async function applySavedMeal(mealId) {
  const meal = cache.meals.find(row => row.id === mealId && !row.deleted_at);
  if (!meal) return;
  const mealItems = cache.items.filter(item => item.saved_meal_id === mealId && !item.deleted_at).sort((a, b) => a.position - b.position);
  if (!mealItems.length) { notify(tr('noItems')); return; }
  const group = getCurrentMeal();
  const time = now();
  const rows = [];
  const usedFoods = new Map();
  for (const item of mealItems) {
    const food = cache.foods.find(row => row.id === item.food_id && !row.deleted_at);
    let source = food;
    if (!source && item.nutrition_per_100g_snapshot) {
      const per = item.nutrition_per_100g_snapshot;
      source = {
        id: item.food_id || null, name: item.food_name_snapshot, name_ar: item.food_name_ar_snapshot,
        kcal_per_100g: per.kcal, protein_g_per_100g: per.protein_g, carbs_g_per_100g: per.carbs_g, fat_g_per_100g: per.fat_g,
        fiber_g_per_100g: per.fiber_g, sugar_g_per_100g: per.sugar_g, sodium_mg_per_100g: per.sodium_mg,
      };
    }
    if (!source || !(Number(item.quantity_g) > 0)) continue;
    rows.push({ id: uid(), ...buildFoodSnapshot(source, Number(item.quantity_g)), ...group, note: `Saved meal: ${meal.name}`, logged_at: time, timestamp: time, local_date: ui.selectedDate, deleted_at: null, created_at: time, updated_at: time });
    if (food) usedFoods.set(food.id, food);
  }
  if (!rows.length) { notify(tr('noItems')); return; }
  await transaction(['food_logs', 'foods'], tx => {
    for (const row of rows) tx.objectStore('food_logs').put(row);
    for (const food of usedFoods.values()) tx.objectStore('foods').put({ ...food, last_used_at: time, updated_at: time });
  });
  await renderNutrition();
  notify(tr('addedMeal'));
}
async function saveGroupAsMeal(token) {
  const { type, label } = decodeMealToken(token);
  const groupLogs = cache.logs.filter(log => log.local_date === ui.selectedDate && !log.deleted_at && log.meal_type === type && (log.meal_label || '') === label);
  if (!groupLogs.length) return;
  const defaultName = mealLabel(type, label);
  openRecipeDialog(groupLogs.map(recipeItemFromLog), 'meal', defaultName);
}
async function copyLogs(logs, targetDate) {
  const time = now();
  const rows = logs.map(log => ({ ...log, id: uid(), timestamp: time, logged_at: time, local_date: targetDate, deleted_at: null, created_at: time, updated_at: time, note: log.note || null }));
  if (!rows.length) return 0;
  await transaction(['food_logs'], tx => rows.forEach(row => tx.objectStore('food_logs').put(row)));
  return rows.length;
}
async function duplicateGroup(token) {
  const { type, label } = decodeMealToken(token);
  const groupLogs = cache.logs.filter(log => log.local_date === ui.selectedDate && !log.deleted_at && log.meal_type === type && (log.meal_label || '') === label);
  if (!groupLogs.length) return;
  if (!confirm(tr('confirmDuplicate'))) return;
  await copyLogs(groupLogs, ui.selectedDate);
  await renderNutrition();
  notify(tr('duplicated'));
}
async function copyPreviousDay() {
  const previous = localDateOffset(ui.selectedDate, -1);
  const previousLogs = cache.logs.filter(log => log.local_date === previous && !log.deleted_at);
  if (!previousLogs.length) { notify(tr('noYesterday')); return; }
  if (!confirm(tr('confirmCopy'))) return;
  await copyLogs(previousLogs, ui.selectedDate);
  await renderNutrition();
  notify(tr('copied'));
}
async function editLog(logId) {
  const log = cache.logs.find(row => row.id === logId && !row.deleted_at);
  if (!log) return;
  const dialog = $('#n-log-dialog', view), form = $('#n-log-edit-form', view);
  form.elements.id.value = log.id;
  form.elements.quantity_g.value = log.quantity_g;
  form.elements.meal_type.value = log.meal_type || 'snack';
  form.elements.meal_label.value = log.meal_label || '';
  form.elements.note.value = log.note || '';
  const name = locale() === 'ar' ? (log.food_name_ar_snapshot || log.food_name_snapshot) : (log.food_name_snapshot || log.food_name_ar_snapshot);
  $('#n-edit-log-name', view).textContent = name || tr('food');
  dialog.showModal();
}
async function saveLogEdit(event) {
  event.preventDefault();
  const form = event.target;
  if (!form.reportValidity()) return;
  const old = cache.logs.find(row => row.id === form.elements.id.value && !row.deleted_at);
  if (!old) return;
  const quantity = Number(form.elements.quantity_g.value);
  if (!(quantity > 0)) { notify(tr('invalidQuantity')); return; }
  const per100g = old.nutrition_per_100g_snapshot || null;
  if (!per100g) { notify(tr('invalidFood')); return; }
  const mealType = form.elements.meal_type.value;
  const mealLabelValue = mealType === 'custom' ? form.elements.meal_label.value.trim() : '';
  if (mealType === 'custom' && !mealLabelValue) { notify(tr('customTypeNeed')); return; }
  const row = { ...old, quantity_g: quantity, ...scaleNutrition(per100g, quantity), meal_type: mealType, meal_label: mealLabelValue, note: form.elements.note.value.trim() || null, updated_at: now() };
  await transaction(['food_logs'], tx => tx.objectStore('food_logs').put(row));
  $('#n-log-dialog', view).close();
  await renderNutrition();
  notify(tr('savedToast'));
}
async function deleteLog(logId) {
  const row = cache.logs.find(item => item.id === logId && !item.deleted_at);
  if (!row || !confirm(tr('confirmDeleteLog'))) return;
  row.deleted_at = now(); row.updated_at = now();
  await transaction(['food_logs'], tx => tx.objectStore('food_logs').put(row));
  await renderNutrition(); notify(tr('deletedToast'));
}
async function deleteFood(foodId) {
  const food = cache.foods.find(row => row.id === foodId && !row.deleted_at);
  if (!food || !confirm(tr('confirmDeleteFood'))) return;
  food.deleted_at = now(); food.updated_at = now();
  await transaction(['foods'], tx => tx.objectStore('foods').put(food));
  if (ui.selectedFoodId === foodId) ui.selectedFoodId = null;
  await renderNutrition(); notify(tr('deletedToast'));
}
async function deleteSavedMeal(mealId) {
  const meal = cache.meals.find(row => row.id === mealId && !row.deleted_at);
  if (!meal || !confirm(tr('confirmDeleteMeal'))) return;
  const time = now();
  const items = cache.items.filter(row => row.saved_meal_id === mealId && !row.deleted_at);
  await transaction(['saved_meals', 'saved_meal_items'], tx => {
    tx.objectStore('saved_meals').put({ ...meal, deleted_at: time, updated_at: time });
    for (const item of items) tx.objectStore('saved_meal_items').put({ ...item, deleted_at: time, updated_at: time });
  });
  await renderNutrition(); notify(tr('deletedToast'));
}
async function toggleFavorite(storeName, id) {
  const rows = storeName === 'foods' ? cache.foods : cache.meals;
  const row = rows.find(item => item.id === id && !item.deleted_at);
  if (!row) return;
  row.is_favorite = !row.is_favorite; row.updated_at = now();
  await transaction([storeName], tx => tx.objectStore(storeName).put(row));
  await renderNutrition();
}
async function restoreRow(storeName, id) {
  if (!['foods', 'food_logs', 'saved_meals'].includes(storeName)) return;
  const row = (storeName === 'foods' ? cache.foods : storeName === 'food_logs' ? cache.logs : cache.meals).find(item => item.id === id && item.deleted_at);
  if (!row) return;
  if (storeName === 'saved_meals') {
    const restored = restoreSavedMealWithItems(row, await all('saved_meal_items'), now());
    await transaction(['saved_meals', 'saved_meal_items'], tx => {
      tx.objectStore('saved_meals').put(restored.meal);
      for (const item of restored.items) tx.objectStore('saved_meal_items').put(item);
    });
  } else {
    row.deleted_at = null; row.updated_at = now();
    await transaction([storeName], tx => tx.objectStore(storeName).put(row));
  }
  await renderNutrition(); notify(tr('saved'));
}
function openTargets() {
  const button = $('#profileBtn');
  if (button) button.click();
}
function updateQuantityPreview() {
  const amount = $('#n-quantity', view);
  const preview = $('#n-preview', view);
  const food = cache.foods.find(row => row.id === ui.selectedFoodId && !row.deleted_at);
  if (!amount || !preview || !food) return;
  ui.amount = amount.value;
  const value = Number(amount.value);
  if (!(value > 0)) { preview.textContent = tr('invalidQuantity'); return; }
  const totals = scaleNutrition(nutritionPer100g(food), value);
  preview.textContent = `${fmt(totals.kcal, 0)} kcal · P ${fmt(totals.protein_g)} · C ${fmt(totals.carbs_g)} · F ${fmt(totals.fat_g)}`;
}
async function submitLog(event) {
  event.preventDefault();
  const food = cache.foods.find(row => row.id === ui.selectedFoodId && !row.deleted_at);
  const quantity = Number($('#n-quantity', view)?.value);
  if (!food) return;
  if (!(quantity > 0)) { notify(tr('invalidQuantity')); return; }
  try {
    const meal = getCurrentMeal();
    await addFoodLog(food, quantity, meal, $('input[name="note"]', event.target)?.value || '');
    ui.selectedFoodId = null; ui.amount = '';
    await renderNutrition(); notify(tr('savedToast'));
  } catch (error) { notify(error.message || tr('invalidFood')); }
}
function toggleCustomMealInput() {
  const custom = $('#n-meal-type', view)?.value === 'custom';
  const label = $('.n-custom-meal-label', view);
  if (label) label.hidden = !custom;
  ui.mealType = $('#n-meal-type', view)?.value || 'snack';
}
function setField(form, name, value) { const field = form.elements.namedItem(name); if (field) field.value = value ?? ''; }
function clickAction(button) {
  const action = button.dataset.nAction;
  const id = button.dataset.id;
  if (action === 'parse-meal') return parseMealBox();
  if (action === 'cancel-meal') {
    void applyMealApprovalAction('cancel', { onCancel: () => {
      ui.mealDraft = null; ui.mealText = ''; ui.mealError = ''; ui.mealBusy = false; renderNutrition();
    } });
    return;
  }
  if (action === 'estimate-meal') { void requestMealEstimate(false); return; }
  if (action === 'answer-meal') { void requestMealEstimate(true); return; }
  if (action === 'approve-meal') { void approveMealBox(); return; }
  if (action === 'select-food') {
    ui.selectedFoodId = id;
    const food = cache.foods.find(row => row.id === id);
    ui.amount = String(food?.serving_g || 100);
    renderNutrition().then(() => $('#n-quantity', view)?.focus());
  } else if (action === 'clear-selected') {
    ui.selectedFoodId = null; ui.amount = ''; renderNutrition();
  } else if (action === 'use-serving') {
    const food = cache.foods.find(row => row.id === ui.selectedFoodId);
    const input = $('#n-quantity', view); if (input) input.value = food?.serving_g || 100; updateQuantityPreview();
  } else if (action === 'filter') {
    ui.filter = button.dataset.filter || 'all';
    $$('.n-filter', view).forEach(item => item.classList.toggle('active', item.dataset.filter === ui.filter));
    renderFoodResults();
  } else if (action === 'new-food') openFoodEditor();
  else if (action === 'edit-food') openFoodEditor(id);
  else if (action === 'toggle-food-favorite') toggleFavorite('foods', id);
  else if (action === 'delete-food') deleteFood(id);
  else if (action === 'save-group') saveGroupAsMeal(button.dataset.meal);
  else if (action === 'duplicate-group') duplicateGroup(button.dataset.meal);
  else if (action === 'copy-previous') copyPreviousDay();
  else if (action === 'today') { ui.selectedDate = today(); renderNutrition(); }
  else if (action === 'edit-targets') openTargets();
  else if (action === 'new-recipe') openRecipeDialog([], 'recipe');
  else if (action === 'add-recipe-item') {
    const foodId = $('#n-recipe-food', view)?.value;
    const quantity = Number($('#n-recipe-quantity', view)?.value);
    const food = cache.foods.find(item => item.id === foodId && !item.deleted_at);
    if (!food || !(quantity > 0)) { const error = $('#n-recipe-error', view); error.textContent = tr('invalidQuantity'); error.hidden = false; return; }
    ui.recipeDraft.push({ food_id: food.id, food_name_snapshot: food.name, food_name_ar_snapshot: food.name_ar || food.name, nutrition_per_100g_snapshot: nutritionPer100g(food), quantity_g: quantity });
    $('#n-recipe-error', view).hidden = true; renderRecipeDraft();
  } else if (action === 'remove-recipe-item') {
    ui.recipeDraft.splice(Number(button.dataset.index), 1); renderRecipeDraft();
  } else if (action === 'apply-meal') applySavedMeal(id).catch(error => notify(error.message || tr('invalidFood')));
  else if (action === 'toggle-meal-favorite') toggleFavorite('saved_meals', id);
  else if (action === 'delete-meal') deleteSavedMeal(id);
  else if (action === 'edit-log') editLog(id);
  else if (action === 'delete-log') deleteLog(id);
  else if (action === 'restore') restoreRow(button.dataset.store, id);
  else if (action === 'toggle-trash') { ui.showTrash = !ui.showTrash; renderNutrition(); }
  else if (action === 'close-food-dialog') $('#n-food-dialog', view).close();
  else if (action === 'close-recipe-dialog') $('#n-recipe-dialog', view).close();
  else if (action === 'close-log-dialog') $('#n-log-dialog', view).close();
}

function bindNutritionForms() {
  const bind = (id, handler, fallback) => {
    const form = $(`#${id}`, view);
    if (form) form.addEventListener('submit', event => handler(event).catch(error => notify(error.message || fallback)));
  };
  bind('n-log-form', submitLog, tr('invalidFood'));
  bind('n-food-form', saveFood, tr('invalidFood'));
  bind('n-recipe-form', saveRecipe, tr('invalidRecipe'));
  bind('n-log-edit-form', saveLogEdit, tr('invalidFood'));
}

function bindView() {
  view.addEventListener('click', event => {
    const button = event.target.closest('[data-n-action]');
    if (button && view.contains(button)) { event.preventDefault(); clickAction(button); }
  });
  view.addEventListener('input', event => {
    if (event.target.id === 'n-food-search') { ui.search = event.target.value; renderFoodResults(); }
    if (event.target.id === 'n-quantity') updateQuantityPreview();
    if (event.target.id === 'n-meal-label') ui.mealLabel = event.target.value;
    if (event.target.id === 'n-meal-input') ui.mealText = event.target.value;
    if (event.target.dataset.mealField === 'answer') { const entry = entryForLine(event.target.dataset.mealLine); if (entry) entry.answer = event.target.value; updateMealControls(); }
    if (event.target.dataset.mealValue) {
      const entry = entryForLine(event.target.dataset.mealLine);
      if (entry) {
        const field = event.target.dataset.mealValue;
        const target = event.target.dataset.mealKind === 'ai' ? 'aiValues' : 'manualValues';
        entry[target] ||= {};
        entry[target][field] = event.target.value === '' ? '' : Number(event.target.value);
        updateMealTotal();
      }
    }
  });
  view.addEventListener('change', event => {
    if (event.target.id === 'n-date' && event.target.value) { ui.selectedDate = event.target.value; renderNutrition(); }
    if (event.target.id === 'n-meal-type') { toggleCustomMealInput(); }
    if (event.target.id === 'n-meal-label') ui.mealLabel = event.target.value.trim();
    if (event.target.dataset.mealField === 'choice') {
      const entry = entryForLine(event.target.dataset.mealLine);
      if (entry) { setMealEntryChoice(entry, event.target.value); ui.mealError = ''; renderNutrition(); }
    }
    if (event.target.dataset.mealField === 'method') {
      const entry = entryForLine(event.target.dataset.mealLine);
      if (entry) { setMealEntryMethod(entry, event.target.value); ui.mealError = ''; renderNutrition(); }
    }
  });
}

export async function initNutrition() {
  view = $('#nutrition');
  if (!view) return;
  db = await openDB();
  await seedMissingFoods();
  bindView();
  document.addEventListener('azab:language-changed', () => renderNutrition());
  document.addEventListener('azab:targets-changed', () => renderNutrition());
  installGeminiSettingsCard();
  window.azabRenderNutrition = renderNutrition;
  await renderNutrition();
}
