import { dailyConsistencyScore, dailyNutrition, dataUrlToImageBlob, goalProgress, latestMeasurement, measurementChange, sleepForWakeDate, sleepRecordFromLocalInputs, waterForDate } from './wellness-core.mjs';
import { effectiveTargetsForDate } from './nutrition-core.mjs';

const DB_NAME = 'azab-fitness-os';
const DB_VERSION = 4;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const uid = () => crypto.randomUUID();
const now = () => Date.now();
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const stamp = row => ({ created_at: row?.created_at || now(), updated_at: now() });
const locale = () => document.documentElement.lang === 'en' ? 'en' : 'ar';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const tr = key => (copy[locale()][key] ?? key);

const copy = {
  ar: {
    today: 'اليوم', customize: 'تخصيص البطاقات', chooseWidgets: 'اختار البطاقات الظاهرة', savePrefs: 'حفظ الاختيارات',
    nutrition: 'التغذية اليوم', calories: 'السعرات', protein: 'بروتين', carbs: 'كربوهيدرات', fat: 'دهون', consumed: 'مستهلك', left: 'متبقي',
    water: 'الماء', sleep: 'النوم', goal: 'تقدم الهدف', score: 'مؤشر الالتزام اليومي', insight: 'ملخص اليوم', workout: 'التمرين',
    logged: 'اتسجل', target: 'الهدف', of: 'من', remaining: 'متبقي', ml: 'مل', minutes: 'دقيقة', hours: 'س', cm: 'سم',
    addWater: 'إضافة ماء', waterAmount: 'الكمية (مل)', note: 'ملاحظة (اختياري)', date: 'التاريخ المحلي', save: 'حفظ', cancelEdit: 'إلغاء التعديل',
    waterQuick: 'إضافة سريعة', history: 'السجل', noWater: 'لسه مفيش ماء متسجل في التاريخ ده.', edit: 'تعديل', trash: 'نقل للسلة',
    sleepStart: 'وقت بداية النوم', wakeTime: 'وقت الاستيقاظ', duration: 'المدة', sleepEntry: 'تسجيل النوم', noSleep: 'لسه مفيش نوم متسجل كتاريخ استيقاظ ده.',
    measurements: 'القياسات البدنية', type: 'نوع القياس', value: 'القيمة (سم)', waist: 'الخصر', chest: 'الصدر', arms: 'الذراع', shoulders: 'الكتفين', thighs: 'الفخذ', neck: 'الرقبة', custom: 'نوع مخصص', customType: 'اكتب اسم القياس',
    latest: 'آخر قيمة', change: 'التغير عن القياس السابق', noMeasurement: 'سجّل قياسًا عشان يظهر التاريخ والتغير.', measurementHistory: 'تاريخ القياسات',
    photos: 'صور التقدم', photoType: 'نوع الصورة', front: 'أمامي', side: 'جانبي', back: 'خلفي', photoDate: 'تاريخ/وقت التصوير', choosePhoto: 'اختيار صورة أو فتح الكاميرا', upload: 'حفظ الصورة على الجهاز', noPhotos: 'لسه مفيش صور محفوظة على الجهاز.',
    customPhotoType: 'وصف النوع المخصص', photoGuide: 'للمقارنة العادلة: استخدم نفس الوقفة، الزاوية، المسافة والإضاءة كل مرة. الصور بتتحفظ على هذا الجهاز فقط، مضغوطة مع صورة مصغرة، ومش بتترفع لأي خدمة.',
    photoLimit: 'اختار صورة أقل من 16 ميجابايت. هتتضغط محليًا قبل الحفظ.', storage: 'مساحة الصور المحفوظة', storageLow: 'مساحة المتصفح المتبقية قليلة. صدّر نسخة احتياطية وتأكد من وجود مساحة على الجهاز قبل إضافة الصورة. لن نمسح أي شيء تلقائيًا.',
    trashTitle: 'سلة سجلات الماء والنوم والقياسات والصور', emptyTrash: 'السلة فاضية.', restore: 'استعادة', deleted: 'اتنقل للسلة؛ تقدر تستعيده.', restored: 'تمت الاستعادة.', confirmDelete: 'تنقل السجل للسلة؟ البيانات مش هتتمسح نهائيًا.',
    invalidWater: 'اكتب كمية ماء أكبر من صفر.', invalidSleep: 'راجع وقت النوم والاستيقاظ؛ المدة لازم تكون من دقيقة إلى 24 ساعة.', invalidMeasure: 'راجع نوع القياس والقيمة (أكبر من صفر وحتى 300 سم).', invalidPhoto: 'اختار صورة JPEG أو PNG أو WebP أو AVIF صالحة.',
    notEnough: 'بيانات غير كافية لحساب المؤشر لسه.', scoreNote: 'يحسب السعرات ضمن ±10% من الهدف، والبروتين/الماء/النوم عند 90% فأكثر؛ ويضم فقط الفئات التي لها سجلات. ليس تقييمًا صحيًا ولا نصيحة طبية.', coachNote: 'ملخص آلي للبيانات المسجلة فقط. الإرشاد التدريبي يأتي في مرحلته؛ لا توجد نصيحة طبية.',
    noTarget: 'لا يوجد هدف محفوظ لهذا التاريخ.', noGoal: 'لا يوجد هدف وزن نشط.', progress: 'التقدم', workouts: 'جلسات مكتملة', startWorkout: 'ابدأ التمرين التالي',
    addFood: 'إضافة طعام', addWeight: 'إضافة وزن', startWorkoutNow: 'ابدأ التمرين', widgetNutrition: 'التغذية', widgetWater: 'الماء', widgetSleep: 'النوم', widgetGoal: 'تقدم الهدف', widgetScore: 'مؤشر اليوم', widgetInsight: 'ملخص اليوم',
    last7: 'آخر 7 أيام', todaySleep: 'نوم محسوب كتاريخ استيقاظ اليوم', goProgress: 'سجّل التفاصيل في التقدم', photoBytes: 'الصور المضغوطة', uploadBusy: 'جاري ضغط الصورة وحفظها محليًا…', exportLarge: 'النسخة الاحتياطية تضم صورًا مضغوطة. احفظ الملف في مكان آمن؛ حجمه قد يكون كبيرًا.',
  },
  en: {
    today: 'Today', customize: 'Customize cards', chooseWidgets: 'Choose visible cards', savePrefs: 'Save choices',
    nutrition: 'Today’s nutrition', calories: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat', consumed: 'Consumed', left: 'Left',
    water: 'Water', sleep: 'Sleep', goal: 'Goal progress', score: 'Daily consistency score', insight: 'Today’s summary', workout: 'Workout',
    logged: 'Logged', target: 'Target', of: 'of', remaining: 'remaining', ml: 'ml', minutes: 'min', hours: 'h', cm: 'cm',
    addWater: 'Add water', waterAmount: 'Amount (ml)', note: 'Note (optional)', date: 'Local date', save: 'Save', cancelEdit: 'Cancel edit',
    waterQuick: 'Quick add', history: 'History', noWater: 'No water logged for this date.', edit: 'Edit', trash: 'Move to trash',
    sleepStart: 'Sleep start', wakeTime: 'Wake-up time', duration: 'Duration', sleepEntry: 'Log sleep', noSleep: 'No sleep logged for this wake-up date.',
    measurements: 'Body measurements', type: 'Measurement type', value: 'Value (cm)', waist: 'Waist', chest: 'Chest', arms: 'Arm', shoulders: 'Shoulders', thighs: 'Thigh', neck: 'Neck', custom: 'Custom type', customType: 'Measurement name',
    latest: 'Latest value', change: 'Change from previous', noMeasurement: 'Log a measurement to see its history and change.', measurementHistory: 'Measurement history',
    photos: 'Progress photos', photoType: 'Photo type', front: 'Front', side: 'Side', back: 'Back', photoDate: 'Taken at', choosePhoto: 'Choose photo or open camera', upload: 'Save photo on this device', noPhotos: 'No photos saved on this device yet.',
    customPhotoType: 'Custom type label', photoGuide: 'For fair comparison, use the same pose, angle, distance, and lighting each time. Photos stay on this device only, compressed with a thumbnail, and are not uploaded to any service.',
    photoLimit: 'Choose an image under 16 MB. It will be compressed locally before saving.', storage: 'Stored photo size', storageLow: 'Available browser storage is low. Export a backup and check device space before adding a photo. Nothing will be deleted automatically.',
    trashTitle: 'Water, sleep, measurement, and photo trash', emptyTrash: 'Trash is empty.', restore: 'Restore', deleted: 'Moved to trash; you can restore it.', restored: 'Restored.', confirmDelete: 'Move this record to trash? It will not be permanently erased.',
    invalidWater: 'Enter a water amount greater than zero.', invalidSleep: 'Check the sleep and wake-up times; duration must be 1 minute to 24 hours.', invalidMeasure: 'Check the measurement type and value (greater than zero, up to 300 cm).', invalidPhoto: 'Choose a valid JPEG, PNG, WebP, or AVIF image.',
    notEnough: 'Not enough logged data to calculate the score yet.', scoreNote: 'Calories count within ±10% of target; protein, water, and sleep at ≥90% of target. Only categories with logs count. Not a health rating or medical advice.', coachNote: 'A factual summary of logged data only. Training guidance comes in its phase; no medical advice.',
    noTarget: 'No target is saved for this date.', noGoal: 'No active weight goal.', progress: 'Progress', workouts: 'Completed sessions', startWorkout: 'Start next workout',
    addFood: 'Add food', addWeight: 'Log weight', startWorkoutNow: 'Start workout', widgetNutrition: 'Nutrition', widgetWater: 'Water', widgetSleep: 'Sleep', widgetGoal: 'Goal progress', widgetScore: 'Daily score', widgetInsight: 'Daily summary',
    last7: 'Last 7 days', todaySleep: 'Sleep assigned to today’s wake-up date', goProgress: 'Log details in Progress', photoBytes: 'Compressed photos', uploadBusy: 'Compressing and saving locally…', exportLarge: 'The backup includes compressed photos. Save it somewhere safe; the file may be large.',
  },
};

let db;
let home;
let progress;
let selectedDate = today();
let previewDialog;
let previewUrl = '';
let thumbUrls = [];

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(request.error);
  });
}
function all(store) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function get(store, id) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function put(store, row) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put({ ...row, ...stamp(row) });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}
function toast(message) {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(window.__p3Toast);
  window.__p3Toast = setTimeout(() => node.classList.remove('show'), 2500);
}
function number(value, digits = 0) {
  if (value === null || value === undefined || value === '') return '—';
  return Number.isFinite(Number(value)) ? new Intl.NumberFormat(locale() === 'en' ? 'en-US' : 'ar-EG', { maximumFractionDigits: digits }).format(Number(value)) : '—';
}
function dateTimeInput(epoch) {
  const date = new Date(epoch);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function timeLabel(epoch) {
  if (!epoch) return '—';
  return new Intl.DateTimeFormat(locale() === 'en' ? 'en-US' : 'ar-EG', { hour: '2-digit', minute: '2-digit' }).format(new Date(epoch));
}
function dayLabel(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat(locale() === 'en' ? 'en-US' : 'ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
}
function durationLabel(minutes) {
  if (minutes === null || minutes === undefined || minutes === '') return '—';
  const value = Number(minutes);
  if (!Number.isFinite(value)) return '—';
  const hours = Math.floor(value / 60), mins = Math.round(value % 60);
  return locale() === 'en' ? `${hours}${tr('hours')} ${mins}${tr('minutes')}` : `${number(hours)} س ${number(mins)} د`;
}
function targetFor(targets, date) { return effectiveTargetsForDate(targets, date) || null; }
function setInput(form, name, value) { const field = form.elements.namedItem(name); if (field) field.value = value ?? ''; }
function typeName(type, customName = '') { return type === 'custom' ? (customName || tr('custom')) : tr(type); }
function targetBar(value, target, unit) {
  if (!Number.isFinite(Number(target)) || Number(target) <= 0) return `<span class="p3-muted">${tr('noTarget')}</span>`;
  const amount = Number(value) || 0;
  const pct = Math.min(100, Math.max(0, amount / Number(target) * 100));
  const left = Math.max(0, Number(target) - amount);
  return `<div class="p3-progressbar" role="progressbar" aria-valuenow="${Math.min(100, Math.round(pct))}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct.toFixed(1)}%"></span></div><div class="p3-progress-meta"><strong>${number(amount)} ${unit}</strong><span>${tr('target')}: ${number(target)} ${unit} · ${number(left)} ${tr('remaining')}</span></div>`;
}
function sortRecent(rows, field = 'timestamp') {
  return rows.filter(row => !row.deleted_at).slice().sort((a, b) => (b[field] || b.timestamp || b.logged_at || 0) - (a[field] || a.timestamp || a.logged_at || 0));
}
async function loadWidgetPrefs() {
  const rows = await all('settings');
  return rows.find(row => row.key === 'dashboard_widgets' && !row.deleted_at)?.value?.hidden || [];
}

async function renderHome() {
  if (!home || !db) return;
  const [targets, foodLogs, waterLogs, sleepLogs, weights, goals, sessions, measurements, settings, profile] = await Promise.all([
    all('daily_targets'), all('food_logs'), all('water_logs'), all('sleep_logs'), all('weight_logs'), all('goals'), all('workout_sessions'), all('measurements'), all('settings'), all('profile'),
  ]);
  const date = today();
  const target = targetFor(targets, date) || { water_ml: 3000, sleep_minutes: 480 };
  const nutrition = dailyNutrition(foodLogs, targets, date);
  const water = waterForDate(waterLogs, date);
  const sleep = sleepForWakeDate(sleepLogs, date);
  const score = dailyConsistencyScore({ foodLogs, waterLogs, sleepLogs, targets: target, localDate: date });
  const currentWeight = sortRecent(weights, 'timestamp')[0] || null;
  const activeGoal = goals.filter(row => row.status === 'active' && !row.deleted_at).sort((a, b) => b.updated_at - a.updated_at)[0] || null;
  let startingWeight = null;
  if (activeGoal) {
    const eligible = weights.filter(row => !row.deleted_at && Number(row.timestamp || row.logged_at) <= Number(activeGoal.started_at)).sort((a, b) => Number(b.timestamp || b.logged_at) - Number(a.timestamp || a.logged_at));
    const firstFallback = weights.filter(row => !row.deleted_at).sort((a, b) => Number(a.timestamp || a.logged_at) - Number(b.timestamp || b.logged_at))[0];
    startingWeight = eligible[0]?.weight_kg ?? firstFallback?.weight_kg ?? null;
  }
  const goalPct = goalProgress({ goal: activeGoal, startingWeight, currentWeight: currentWeight?.weight_kg });
  const todaysSession = sessions.filter(row => !row.deleted_at && row.local_date === date && (row.status === 'in_progress' || row.status === 'completed')).sort((a, b) => Number(b.started_at) - Number(a.started_at))[0];
  const hidden = await loadWidgetPrefs();
  const visible = key => !hidden.includes(key);
  const scoreValue = score.score === null ? tr('notEnough') : `${number(score.score)}% · ${number(score.met)}/${number(score.available)}`;
  let insight = tr('notEnough');
  const unmet = score.items.find(item => !item.met);
  if (unmet?.key === 'water') insight = `${tr('water')}: ${number(Math.max(0, Number(target.water_ml || 0) - water.amount_ml))} ${tr('ml')} ${tr('remaining')}.`;
  else if (unmet?.key === 'sleep') insight = `${tr('sleep')}: ${tr('target')} ${durationLabel(target.sleep_minutes)}.`;
  else if (unmet?.key === 'calories') insight = `${tr('calories')}: ${number(nutrition.calories_remaining)} kcal ${tr('left')}.`;
  else if (unmet?.key === 'protein') insight = `${tr('protein')}: ${number(nutrition.protein_remaining)} g ${tr('left')}.`;
  else if (score.available) insight = locale() === 'en' ? 'All currently tracked targets are met.' : 'تم تحقيق كل الأهداف التي لها سجلات اليوم.';
  const nutritionCard = `<article class="p3-card" data-p3-widget="nutrition"><div class="p3-card-head"><h3>◉ ${tr('nutrition')}</h3><button class="p3-link" data-p3-go="nutrition">${tr('goProgress')}</button></div>${nutrition.target ? `<div class="p3-nutrition-grid"><div><span>${tr('calories')}</span><strong>${number(nutrition.totals.kcal)}</strong><small>${tr('of')} ${number(nutrition.target.calories)} kcal · ${tr('left')} ${number(nutrition.calories_remaining)} kcal</small></div><div><span>${tr('protein')}</span><strong>${number(nutrition.totals.protein_g, 1)} g</strong><small>${tr('of')} ${number(nutrition.target.protein_g)} g · ${tr('left')} ${number(nutrition.protein_remaining, 1)} g</small></div><div><span>${tr('carbs')}</span><strong>${number(nutrition.totals.carbs_g, 1)} g</strong></div><div><span>${tr('fat')}</span><strong>${number(nutrition.totals.fat_g, 1)} g</strong></div></div>${nutrition.logs.length ? '' : `<p class="p3-muted">${tr('notEnough')}</p>`}` : `<p class="p3-muted">${tr('noTarget')}</p>`}</article>`;
  const waterCard = `<article class="p3-card" data-p3-widget="water"><div class="p3-card-head"><h3>💧 ${tr('water')}</h3><span class="p3-small">${tr('logged')}: ${number(water.count)}</span></div>${targetBar(water.amount_ml, target.water_ml, tr('ml'))}<div class="p3-quick-row"><button class="p3-small-btn" data-p3-action="quick-water" data-amount="250">+250 ${tr('ml')}</button><button class="p3-small-btn" data-p3-action="quick-water" data-amount="500">+500 ${tr('ml')}</button><button class="p3-small-btn" data-p3-go="progress">${tr('addWater')}</button></div></article>`;
  const sleepCard = `<article class="p3-card" data-p3-widget="sleep"><div class="p3-card-head"><h3>☾ ${tr('sleep')}</h3><span class="p3-small">${tr('todaySleep')}</span></div>${sleep.count ? targetBar(sleep.duration_minutes, target.sleep_minutes, tr('minutes')) : `<p class="p3-muted">${tr('noSleep')}</p>`}<div class="p3-quick-row"><span class="p3-large-number">${sleep.count ? durationLabel(sleep.duration_minutes) : '—'}</span><button class="p3-small-btn" data-p3-go="progress">${tr('goProgress')}</button></div></article>`;
  const goalCard = `<article class="p3-card" data-p3-widget="goal"><div class="p3-card-head"><h3>◎ ${tr('goal')}</h3><span class="p3-small">${activeGoal ? escape(activeGoal.goal_type) : tr('noGoal')}</span></div>${activeGoal ? `<div class="p3-goal-row"><strong>${currentWeight ? `${number(currentWeight.weight_kg, 1)} kg` : '—'}</strong><span>→ ${number(activeGoal.target_weight_kg, 1)} kg</span></div>${goalPct === null ? `<p class="p3-muted">${tr('notEnough')}</p>` : `<div class="p3-progressbar"><span style="width:${goalPct.toFixed(1)}%"></span></div><p class="p3-muted">${number(goalPct)}% ${tr('progress')}</p>`}` : `<p class="p3-muted">${tr('noGoal')}</p>`}</article>`;
  const scoreCard = `<article class="p3-card p3-score" data-p3-widget="score"><div class="p3-card-head"><h3>◷ ${tr('score')}</h3><strong>${score.score === null ? '—' : `${number(score.score)}%`}</strong></div><p>${scoreValue}</p><small>${tr('scoreNote')}</small></article>`;
  const insightCard = `<article class="p3-card p3-insight" data-p3-widget="insight"><div class="p3-card-head"><h3>✳ ${tr('insight')}</h3></div><p>${escape(insight)}</p><small>${tr('coachNote')}</small></article>`;
  const widgets = [nutritionCard, waterCard, sleepCard, goalCard, scoreCard, insightCard].filter(card => {
    const match = /data-p3-widget="([^"]+)"/.exec(card);
    return match && visible(match[1]);
  }).join('');
  const prefOptions = ['nutrition', 'water', 'sleep', 'goal', 'score', 'insight'].map(key => `<label><input type="checkbox" data-p3-widget-toggle="${key}" ${visible(key) ? 'checked' : ''}>${tr(`widget${key[0].toUpperCase()}${key.slice(1)}`)}</label>`).join('');
  home.innerHTML = `<div class="p3-home-head"><div><p class="p3-eyebrow">${tr('today')} · ${dayLabel(date)}</p><h2>${locale() === 'en' ? 'Daily dashboard' : 'لوحة يومك'}</h2></div><details class="p3-customize"><summary>${tr('customize')}</summary><div class="p3-customize-panel"><p>${tr('chooseWidgets')}</p>${prefOptions}<button class="p3-small-btn" data-p3-action="save-widgets">${tr('savePrefs')}</button></div></details></div><div class="p3-quick-actions"><button class="p3-small-btn" data-p3-go="nutrition">＋ ${tr('addFood')}</button><button class="p3-small-btn" data-p3-action="quick-water" data-amount="250">＋ ${tr('water')} 250 ${tr('ml')}</button><button class="p3-small-btn" data-p3-go="progress" data-p3-scroll="weightForm">＋ ${tr('addWeight')}</button><button class="p3-primary" data-p3-action="start-workout">↗ ${tr('startWorkoutNow')}</button></div>
    <article class="p3-card p3-workout-card"><div><h3>↗ ${tr('workout')}</h3><p>${todaysSession ? `${escape(todaysSession.name_snapshot || todaysSession.plan_key || tr('workout'))} · ${escape(todaysSession.status)}` : $('#nextWorkout')?.textContent || tr('startWorkout')}</p></div><button class="p3-small-btn" data-p3-go="workout">${todaysSession?.status === 'in_progress' ? (locale() === 'en' ? 'Resume' : 'استكمال') : tr('startWorkout')}</button></article>
    <div class="p3-dashboard-grid">${widgets}</div>`;
}

function standardMeasurementCards(rows) {
  const types = ['waist', 'chest', 'arms', 'shoulders', 'thighs', 'neck'];
  return types.map(type => {
    const latest = latestMeasurement(rows, type);
    const delta = measurementChange(rows, type);
    const deltaText = delta === null ? '—' : `${delta > 0 ? '+' : ''}${number(delta, 1)} ${tr('cm')}`;
    return `<article class="p3-measure-card"><span>${tr(type)}</span><strong>${latest ? `${number(latest.value_cm, 1)} ${tr('cm')}` : '—'}</strong><small>${latest ? `${dayLabel(latest.local_date)} · ${tr('change')}: ${deltaText}` : tr('noMeasurement')}</small></article>`;
  }).join('');
}

function waterLogRows(rows) {
  const list = rows.filter(row => !row.deleted_at && row.local_date === selectedDate).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  if (!list.length) return `<p class="p3-muted">${tr('noWater')}</p>`;
  return list.map(row => `<div class="p3-log-row"><div><strong>${number(row.amount_ml)} ${tr('ml')}</strong><small>${timeLabel(row.timestamp)}${row.note ? ` · ${escape(row.note)}` : ''}</small></div><div class="p3-row-actions"><button class="p3-link" data-p3-action="edit-water" data-id="${escape(row.id)}">${tr('edit')}</button><button class="p3-link" data-p3-action="delete-row" data-store="water_logs" data-id="${escape(row.id)}">${tr('trash')}</button></div></div>`).join('');
}
function sleepLogRows(rows) {
  const list = rows.filter(row => !row.deleted_at && row.local_date === selectedDate).sort((a, b) => (b.sleep_end || 0) - (a.sleep_end || 0));
  if (!list.length) return `<p class="p3-muted">${tr('noSleep')}</p>`;
  return list.map(row => `<div class="p3-log-row"><div><strong>${durationLabel(row.duration_minutes)}</strong><small>${dayLabel(row.local_date)} · ${timeLabel(row.sleep_start)}–${timeLabel(row.sleep_end)}${row.note ? ` · ${escape(row.note)}` : ''}</small></div><div class="p3-row-actions"><button class="p3-link" data-p3-action="edit-sleep" data-id="${escape(row.id)}">${tr('edit')}</button><button class="p3-link" data-p3-action="delete-row" data-store="sleep_logs" data-id="${escape(row.id)}">${tr('trash')}</button></div></div>`).join('');
}
function measurementRows(rows) {
  const list = rows.filter(row => !row.deleted_at).sort((a, b) => (b.local_date || '').localeCompare(a.local_date || '') || (b.logged_at || 0) - (a.logged_at || 0)).slice(0, 30);
  if (!list.length) return `<p class="p3-muted">${tr('noMeasurement')}</p>`;
  return list.map(row => { const delta = measurementChange(rows, row.type, row.custom_type); const changeText = delta === null ? '—' : `${delta > 0 ? '+' : ''}${number(delta, 1)} ${tr('cm')}`; return `<div class="p3-log-row"><div><strong>${escape(typeName(row.type, row.custom_type))}: ${number(row.value_cm, 1)} ${tr('cm')}</strong><small>${dayLabel(row.local_date)} · ${tr('change')}: ${changeText}${row.note ? ` · ${escape(row.note)}` : ''}</small></div><div class="p3-row-actions"><button class="p3-link" data-p3-action="edit-measure" data-id="${escape(row.id)}">${tr('edit')}</button><button class="p3-link" data-p3-action="delete-row" data-store="measurements" data-id="${escape(row.id)}">${tr('trash')}</button></div></div>`; }).join('');
}
function clearThumbUrls() { thumbUrls.forEach(url => URL.revokeObjectURL(url)); thumbUrls = []; }
function photoCards(rows) {
  clearThumbUrls();
  const list = rows.filter(row => !row.deleted_at).sort((a, b) => (b.taken_at || 0) - (a.taken_at || 0));
  if (!list.length) return `<p class="p3-muted">${tr('noPhotos')}</p>`;
  return `<div class="p3-photo-grid">${list.slice(0, 36).map(row => {
    const url = row.thumbnail_blob ? URL.createObjectURL(row.thumbnail_blob) : (row.image_blob ? URL.createObjectURL(row.image_blob) : '');
    if (url) thumbUrls.push(url);
    const size = Number(row.stored_size_bytes || row.image_blob?.size || 0);
    return `<article class="p3-photo-card"><button class="p3-photo-open" data-p3-action="preview-photo" data-id="${escape(row.id)}" aria-label="${escape(tr('photos'))}">${url ? `<img src="${url}" alt="${escape(typeName(row.type, row.custom_type))}" loading="lazy">` : `<span>${tr('photos')}</span>`}</button><div><strong>${escape(typeName(row.type, row.custom_type))}</strong><small>${dayLabel(row.local_date)} · ${number(size / 1024, 0)} KB</small>${row.note ? `<small>${escape(row.note)}</small>` : ''}<button class="p3-link" data-p3-action="delete-row" data-store="progress_photos" data-id="${escape(row.id)}">${tr('trash')}</button></div></article>`;
  }).join('')}</div>${list.length > 36 ? `<p class="p3-muted">${number(list.length - 36)} ${locale() === 'en' ? 'older photos not shown here' : 'صورة أقدم غير معروضة هنا'}</p>` : ''}`;
}
function trashRows(groups) {
  const { water, sleep, measurements, photos } = groups;
  const rows = [
    ...water.filter(row => row.deleted_at).map(row => ({ store: 'water_logs', row, label: `${number(row.amount_ml)} ${tr('ml')} · ${dayLabel(row.local_date)}` })),
    ...sleep.filter(row => row.deleted_at).map(row => ({ store: 'sleep_logs', row, label: `${durationLabel(row.duration_minutes)} · ${dayLabel(row.local_date)}` })),
    ...measurements.filter(row => row.deleted_at).map(row => ({ store: 'measurements', row, label: `${typeName(row.type, row.custom_type)} ${number(row.value_cm, 1)} ${tr('cm')} · ${dayLabel(row.local_date)}` })),
    ...photos.filter(row => row.deleted_at).map(row => ({ store: 'progress_photos', row, label: `${typeName(row.type, row.custom_type)} · ${dayLabel(row.local_date)}` })),
  ].sort((a, b) => Number(b.row.updated_at || 0) - Number(a.row.updated_at || 0));
  if (!rows.length) return `<p class="p3-muted">${tr('emptyTrash')}</p>`;
  return rows.map(({ store, row, label }) => `<div class="p3-log-row"><span>${escape(label)}</span><button class="p3-link" data-p3-action="restore-row" data-store="${store}" data-id="${escape(row.id)}">${tr('restore')}</button></div>`).join('');
}

async function renderProgress() {
  if (!progress || !db) return;
  clearThumbUrls();
  const [targets, water, sleep, measurements, photos] = await Promise.all([
    all('daily_targets'), all('water_logs'), all('sleep_logs'), all('measurements'), all('progress_photos'),
  ]);
  const target = targetFor(targets, selectedDate) || {};
  const waterTotal = waterForDate(water, selectedDate);
  const sleepTotal = sleepForWakeDate(sleep, selectedDate);
  const visiblePhotos = photos.filter(row => !row.deleted_at);
  const storageBytes = visiblePhotos.reduce((sum, row) => sum + Number(row.stored_size_bytes || row.image_blob?.size || 0), 0);
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  const lowStorage = estimate?.quota && (estimate.quota - estimate.usage) < 12 * 1024 * 1024;
  const dayStart = new Date(`${selectedDate}T23:00:00`);
  dayStart.setDate(dayStart.getDate() - 1);
  const defaultStart = dateTimeInput(dayStart.getTime());
  const defaultEnd = `${selectedDate}T07:00`;
  progress.innerHTML = `<div class="p3-progress-toolbar"><label><span>${tr('date')}</span><input id="p3-day" type="date" value="${escape(selectedDate)}"></label><span class="p3-small">${tr('today')}: ${dayLabel(selectedDate)}</span></div>
    <article class="p3-card"><div class="p3-card-head"><h3>💧 ${tr('water')}</h3><span class="p3-pill">${number(waterTotal.amount_ml)} / ${number(target.water_ml)} ${tr('ml')}</span></div>${targetBar(waterTotal.amount_ml, target.water_ml, tr('ml'))}<div class="p3-quick-row"><button class="p3-small-btn" data-p3-action="quick-water" data-amount="250">+250 ${tr('ml')}</button><button class="p3-small-btn" data-p3-action="quick-water" data-amount="350">+350 ${tr('ml')}</button><button class="p3-small-btn" data-p3-action="quick-water" data-amount="500">+500 ${tr('ml')}</button><button class="p3-small-btn" data-p3-action="quick-water" data-amount="750">+750 ${tr('ml')}</button></div>
      <form id="p3-water-form" class="p3-form"><input type="hidden" name="entry_id"><label><span>${tr('waterAmount')}</span><input name="amount_ml" type="number" min="1" max="5000" step="1" required inputmode="numeric"></label><label><span>${tr('date')}</span><input name="local_date" type="date" value="${escape(selectedDate)}" required></label><label class="p3-full"><span>${tr('note')}</span><input name="note" maxlength="240"></label><div class="p3-form-actions"><button class="p3-primary" type="submit">${tr('save')}</button><button class="p3-small-btn p3-cancel-edit" type="button" data-p3-action="cancel-water" hidden>${tr('cancelEdit')}</button></div></form><h4>${tr('history')}</h4><div class="p3-log-list">${waterLogRows(water)}</div></article>
    <article class="p3-card"><div class="p3-card-head"><h3>☾ ${tr('sleep')}</h3><span class="p3-pill">${sleepTotal.count ? durationLabel(sleepTotal.duration_minutes) : '—'} / ${durationLabel(target.sleep_minutes)}</span></div>${targetBar(sleepTotal.duration_minutes, target.sleep_minutes, tr('minutes'))}<form id="p3-sleep-form" class="p3-form"><input type="hidden" name="entry_id"><label><span>${tr('sleepStart')}</span><input name="sleep_start" type="datetime-local" value="${defaultStart}" required></label><label><span>${tr('wakeTime')}</span><input name="sleep_end" type="datetime-local" value="${defaultEnd}" required></label><label class="p3-full"><span>${tr('note')}</span><input name="note" maxlength="240"></label><p class="p3-duration-preview" id="p3-sleep-preview">${tr('duration')}: ${sleepTotal.count ? durationLabel(sleepTotal.duration_minutes) : '—'} · ${tr('target')}: ${durationLabel(target.sleep_minutes)}</p><div class="p3-form-actions"><button class="p3-primary" type="submit">${tr('sleepEntry')}</button><button class="p3-small-btn p3-cancel-edit" type="button" data-p3-action="cancel-sleep" hidden>${tr('cancelEdit')}</button></div></form><h4>${tr('history')}</h4><div class="p3-log-list">${sleepLogRows(sleep)}</div></article>
    <article class="p3-card"><div class="p3-card-head"><h3>⌁ ${tr('measurements')}</h3><span class="p3-pill">${number(measurements.filter(row => !row.deleted_at).length)}</span></div><div class="p3-measure-grid">${standardMeasurementCards(measurements)}</div><form id="p3-measure-form" class="p3-form"><input type="hidden" name="entry_id"><label><span>${tr('type')}</span><select name="type"><option value="waist">${tr('waist')}</option><option value="chest">${tr('chest')}</option><option value="arms">${tr('arms')}</option><option value="shoulders">${tr('shoulders')}</option><option value="thighs">${tr('thighs')}</option><option value="neck">${tr('neck')}</option><option value="custom">${tr('custom')}</option></select></label><label class="p3-custom-measure" hidden><span>${tr('customType')}</span><input name="custom_type" maxlength="50"></label><label><span>${tr('value')}</span><input name="value_cm" type="number" min="0.1" max="300" step="0.1" required inputmode="decimal"></label><label><span>${tr('date')}</span><input name="local_date" type="date" value="${escape(selectedDate)}" required></label><label class="p3-full"><span>${tr('note')}</span><input name="note" maxlength="240"></label><div class="p3-form-actions"><button class="p3-primary" type="submit">${tr('save')}</button><button class="p3-small-btn p3-cancel-edit" type="button" data-p3-action="cancel-measure" hidden>${tr('cancelEdit')}</button></div></form><h4>${tr('measurementHistory')}</h4><div class="p3-log-list">${measurementRows(measurements)}</div></article>
    <article class="p3-card"><div class="p3-card-head"><h3>▧ ${tr('photos')}</h3><span class="p3-pill">${number(visiblePhotos.length)}</span></div><p class="p3-muted">${tr('photoGuide')}</p>${lowStorage ? `<p class="p3-warning">${tr('storageLow')}</p>` : ''}<p class="p3-small">${tr('storage')}: ${number(storageBytes / (1024 * 1024), 1)} MB${estimate?.quota ? ` · ${number(Math.max(0, estimate.quota - estimate.usage) / (1024 * 1024), 0)} MB ${locale() === 'en' ? 'browser storage available' : 'مساحة متاحة بالمتصفح'}` : ''}</p><form id="p3-photo-form" class="p3-form"><label><span>${tr('photoType')}</span><select name="type"><option value="front">${tr('front')}</option><option value="side">${tr('side')}</option><option value="back">${tr('back')}</option><option value="custom">${tr('custom')}</option></select></label><label class="p3-custom-photo" hidden><span>${tr('customPhotoType')}</span><input name="custom_type" maxlength="50"></label><label><span>${tr('photoDate')}</span><input name="taken_at" type="datetime-local" value="${dateTimeInput(now())}" required></label><label class="p3-file-label"><span>${tr('choosePhoto')}</span><input name="photo_file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" capture="environment" required></label><label class="p3-full"><span>${tr('note')}</span><input name="note" maxlength="240"></label><small class="p3-full">${tr('photoLimit')}</small><div class="p3-form-actions"><button class="p3-primary" type="submit">${tr('upload')}</button></div></form><div id="p3-photo-gallery">${photoCards(photos)}</div></article>
    <details class="p3-card p3-trash"><summary>${tr('trashTitle')}</summary><div class="p3-log-list">${trashRows({ water, sleep, measurements, photos })}</div></details>`;
  bindProgressForms();
}

function setEditForm(formId, row, values) {
  const form = $(`#${formId}`, progress);
  if (!form) return;
  Object.entries(values).forEach(([name, value]) => setInput(form, name, value));
  const button = $('.p3-cancel-edit', form);
  if (button) button.hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function bindProgressForms() {
  const forms = {
    'p3-water-form': saveWater,
    'p3-sleep-form': saveSleep,
    'p3-measure-form': saveMeasurement,
    'p3-photo-form': savePhoto,
  };
  for (const [id, handler] of Object.entries(forms)) {
    const form = $(`#${id}`, progress);
    form?.addEventListener('submit', event => { event.preventDefault(); handler(form).catch(error => toast(error.message || tr('invalidPhoto'))); });
  }
  $('#p3-day', progress)?.addEventListener('change', event => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) { selectedDate = event.target.value; renderProgress(); }
  });
  const sleepStart = $('[name="sleep_start"]', progress), sleepEnd = $('[name="sleep_end"]', progress);
  [sleepStart, sleepEnd].forEach(input => input?.addEventListener('input', updateSleepPreview));
  $('[name="type"]', $('#p3-measure-form', progress))?.addEventListener('change', event => {
    const field = $('.p3-custom-measure', progress); if (field) field.hidden = event.target.value !== 'custom';
  });
  $('[name="type"]', $('#p3-photo-form', progress))?.addEventListener('change', event => {
    const field = $('.p3-custom-photo', progress); if (field) field.hidden = event.target.value !== 'custom';
  });
  updateSleepPreview();
}
function updateSleepPreview() {
  const start = $('[name="sleep_start"]', progress)?.value;
  const end = $('[name="sleep_end"]', progress)?.value;
  const preview = $('#p3-sleep-preview', progress);
  if (!preview) return;
  try {
    const row = sleepRecordFromLocalInputs(start, end);
    preview.textContent = `${tr('duration')}: ${durationLabel(row.duration_minutes)} · ${tr('date')}: ${dayLabel(row.local_date)}`;
  } catch { preview.textContent = `${tr('duration')}: —`; }
}
async function saveWater(form) {
  if (!form.reportValidity()) return;
  const amount = Number(form.elements.amount_ml.value);
  if (!(amount > 0 && amount <= 5000)) throw new RangeError(tr('invalidWater'));
  const id = form.elements.entry_id.value;
  const existing = id ? await get('water_logs', id) : null;
  const timestamp = now();
  await put('water_logs', { ...(existing || {}), id: existing?.id || uid(), amount_ml: amount, logged_at: timestamp, timestamp, local_date: form.elements.local_date.value, note: form.elements.note.value.trim(), deleted_at: null, ...stamp(existing) });
  form.reset(); form.elements.entry_id.value = ''; form.elements.local_date.value = selectedDate; $('.p3-cancel-edit', form).hidden = true;
  toast(tr('logged')); await refresh();
}
async function saveSleep(form) {
  if (!form.reportValidity()) return;
  let record;
  try { record = sleepRecordFromLocalInputs(form.elements.sleep_start.value, form.elements.sleep_end.value); }
  catch { throw new RangeError(tr('invalidSleep')); }
  const id = form.elements.entry_id.value;
  const existing = id ? await get('sleep_logs', id) : null;
  const timestamp = now();
  await put('sleep_logs', { ...(existing || {}), id: existing?.id || uid(), ...record, logged_at: timestamp, timestamp, source: 'manual', note: form.elements.note.value.trim(), deleted_at: null, ...stamp(existing) });
  selectedDate = record.local_date;
  toast(tr('logged')); await refresh();
}
async function saveMeasurement(form) {
  if (!form.reportValidity()) return;
  const value = Number(form.elements.value_cm.value), type = form.elements.type.value;
  const customType = form.elements.custom_type.value.trim();
  if (!(value > 0 && value <= 300) || (type === 'custom' && !customType)) throw new RangeError(tr('invalidMeasure'));
  const id = form.elements.entry_id.value;
  const existing = id ? await get('measurements', id) : null;
  const timestamp = now();
  await put('measurements', { ...(existing || {}), id: existing?.id || uid(), type, custom_type: type === 'custom' ? customType : null, value_cm: value, logged_at: timestamp, timestamp, local_date: form.elements.local_date.value, note: form.elements.note.value.trim(), deleted_at: null, ...stamp(existing) });
  form.reset(); form.elements.entry_id.value = ''; form.elements.local_date.value = selectedDate; $('.p3-cancel-edit', form).hidden = true; $('.p3-custom-measure', progress).hidden = true;
  toast(tr('logged')); await refresh();
}

function canvasBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(tr('invalidPhoto'))), mime, quality));
}
async function encodeBitmap(bitmap, maxSide, quality = 0.82) {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error(tr('invalidPhoto'));
  context.drawImage(bitmap, 0, 0, width, height);
  let blob = await canvasBlob(canvas, 'image/webp', quality);
  if (blob.type !== 'image/webp') blob = await canvasBlob(canvas, 'image/jpeg', quality);
  if (!['image/webp', 'image/jpeg', 'image/png'].includes(blob.type)) throw new Error(tr('invalidPhoto'));
  canvas.width = 0; canvas.height = 0;
  return { blob, width, height };
}
async function compressPhoto(file) {
  if (!file || file.size > 16 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) throw new RangeError(tr('photoLimit'));
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new TypeError(tr('invalidPhoto')); }
  if (bitmap.width > 16000 || bitmap.height > 16000 || bitmap.width * bitmap.height > 100_000_000) { bitmap.close?.(); throw new RangeError(tr('photoLimit')); }
  const main = await encodeBitmap(bitmap, 1600, 0.82);
  bitmap.close?.();
  const thumbBitmap = await createImageBitmap(main.blob);
  const thumb = await encodeBitmap(thumbBitmap, 360, 0.75);
  thumbBitmap.close?.();
  return { ...main, thumbnail_blob: thumb.blob, thumbnail_width: thumb.width, thumbnail_height: thumb.height, original_size_bytes: file.size, stored_size_bytes: main.blob.size + thumb.blob.size };
}
async function savePhoto(form) {
  if (!form.reportValidity()) return;
  const file = form.elements.photo_file.files?.[0];
  if (!file) throw new TypeError(tr('invalidPhoto'));
  const type = form.elements.type.value, customType = form.elements.custom_type.value.trim();
  if (type === 'custom' && !customType) throw new TypeError(tr('invalidPhoto'));
  toast(tr('uploadBusy'));
  const image = await compressPhoto(file);
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  if (estimate?.quota && (estimate.quota - estimate.usage) < (image.stored_size_bytes * 3)) throw new Error(tr('storageLow'));
  const takenAt = new Date(form.elements.taken_at.value).getTime();
  if (!Number.isFinite(takenAt)) throw new TypeError(tr('invalidPhoto'));
  const timestamp = now();
  await put('progress_photos', {
    id: uid(), type, custom_type: type === 'custom' ? customType : null, image_blob: image.blob,
    thumbnail_blob: image.thumbnail_blob, mime_type: image.blob.type, width: image.width, height: image.height,
    thumbnail_width: image.thumbnail_width, thumbnail_height: image.thumbnail_height,
    original_size_bytes: image.original_size_bytes, stored_size_bytes: image.stored_size_bytes,
    taken_at: takenAt, logged_at: timestamp, timestamp, local_date: form.elements.taken_at.value.slice(0, 10),
    note: form.elements.note.value.trim(), deleted_at: null, ...stamp(),
  });
  form.reset(); form.elements.taken_at.value = dateTimeInput(now()); $('.p3-custom-photo', progress).hidden = true;
  toast(tr('logged')); await refresh();
}
function editWater(id) {
  get('water_logs', id).then(row => row && setEditForm('p3-water-form', row, { entry_id: row.id, amount_ml: row.amount_ml, local_date: row.local_date, note: row.note }));
}
function editSleep(id) {
  get('sleep_logs', id).then(row => { if (row) { setEditForm('p3-sleep-form', row, { entry_id: row.id, sleep_start: dateTimeInput(row.sleep_start), sleep_end: dateTimeInput(row.sleep_end), note: row.note }); updateSleepPreview(); } });
}
function editMeasurement(id) {
  get('measurements', id).then(row => {
    if (!row) return;
    setEditForm('p3-measure-form', row, { entry_id: row.id, type: row.type, custom_type: row.custom_type, value_cm: row.value_cm, local_date: row.local_date, note: row.note });
    $('.p3-custom-measure', progress).hidden = row.type !== 'custom';
  });
}
async function addWater(amount, date = selectedDate) {
  await put('water_logs', { id: uid(), amount_ml: Number(amount), logged_at: now(), timestamp: now(), local_date: date, note: '', deleted_at: null, ...stamp() });
  toast(tr('logged')); await refresh();
}
async function softDelete(store, id) {
  if (!confirm(tr('confirmDelete'))) return;
  const row = await get(store, id);
  if (!row || row.deleted_at) return;
  await put(store, { ...row, deleted_at: now() });
  toast(tr('deleted')); await refresh();
}
async function restoreRow(store, id) {
  const row = await get(store, id);
  if (!row) return;
  await put(store, { ...row, deleted_at: null });
  toast(tr('restored')); await refresh();
}
async function saveWidgets() {
  const inputs = $$('[data-p3-widget-toggle]', home);
  const hidden = inputs.filter(input => !input.checked).map(input => input.dataset.p3WidgetToggle);
  const settings = await all('settings');
  const existing = settings.find(row => row.key === 'dashboard_widgets' && !row.deleted_at);
  await put('settings', { ...(existing || {}), id: existing?.id || uid(), key: 'dashboard_widgets', value: { hidden } });
  toast(tr('savePrefs')); await renderHome();
}
function openPhoto(row) {
  if (!row?.image_blob) return;
  closePhotoPreview();
  previewUrl = URL.createObjectURL(row.image_blob);
  previewDialog.querySelector('img').src = previewUrl;
  previewDialog.querySelector('img').alt = typeName(row.type, row.custom_type);
  previewDialog.querySelector('.p3-photo-caption').textContent = `${typeName(row.type, row.custom_type)} · ${dayLabel(row.local_date)}${row.note ? ` · ${row.note}` : ''}`;
  previewDialog.showModal();
}
function closePhotoPreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = '';
  if (previewDialog?.open) previewDialog.close();
}
function installPhotoDialog() {
  previewDialog = document.createElement('dialog');
  previewDialog.className = 'p3-preview-dialog';
  previewDialog.innerHTML = `<div class="p3-preview-panel"><button class="p3-small-btn p3-preview-close" type="button" aria-label="Close">×</button><img alt=""><p class="p3-photo-caption"></p></div>`;
  document.body.append(previewDialog);
  previewDialog.querySelector('.p3-preview-close').addEventListener('click', closePhotoPreview);
  previewDialog.addEventListener('close', () => { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = ''; });
}

async function onHomeClick(event) {
  const action = event.target.closest('[data-p3-action]');
  const go = event.target.closest('[data-p3-go]');
  if (go) { document.querySelector(`[data-tab="${go.dataset.p3Go}"]`)?.click(); if (go.dataset.p3Scroll) setTimeout(() => document.getElementById(go.dataset.p3Scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120); return; }
  if (!action) return;
  if (action.dataset.p3Action === 'quick-water') await addWater(Number(action.dataset.amount), today());
  if (action.dataset.p3Action === 'start-workout') $('#homeStart')?.click();
  if (action.dataset.p3Action === 'save-widgets') await saveWidgets();
}
async function onProgressClick(event) {
  const button = event.target.closest('[data-p3-action]');
  if (!button) return;
  const { p3Action: action, id, store } = button.dataset;
  if (action === 'quick-water') await addWater(Number(button.dataset.amount), selectedDate);
  else if (action === 'edit-water') editWater(id);
  else if (action === 'edit-sleep') editSleep(id);
  else if (action === 'edit-measure') editMeasurement(id);
  else if (action === 'delete-row') await softDelete(store, id);
  else if (action === 'restore-row') await restoreRow(store, id);
  else if (action === 'preview-photo') openPhoto(await get('progress_photos', id));
  else if (action === 'cancel-water') { $('#p3-water-form', progress).reset(); $('#p3-water-form', progress).elements.entry_id.value = ''; button.hidden = true; }
  else if (action === 'cancel-sleep') { $('#p3-sleep-form', progress).reset(); $('#p3-sleep-form', progress).elements.entry_id.value = ''; button.hidden = true; }
  else if (action === 'cancel-measure') { $('#p3-measure-form', progress).reset(); $('#p3-measure-form', progress).elements.entry_id.value = ''; $('.p3-custom-measure', progress).hidden = true; button.hidden = true; }
}
async function refresh() { await Promise.all([renderHome(), renderProgress(), window.azabRenderCoachHome?.()]); }

export async function initPhase3() {
  db = await openDB();
  home = $('#wellnessHome');
  progress = $('#wellnessProgress');
  if (!home || !progress) return;
  installPhotoDialog();
  home.addEventListener('click', event => onHomeClick(event).catch(error => toast(error.message || tr('invalidWater'))));
  progress.addEventListener('click', event => onProgressClick(event).catch(error => toast(error.message || tr('invalidPhoto'))));
  document.addEventListener('azab:language-changed', refresh);
  document.addEventListener('azab:targets-changed', refresh);
  window.azabRenderWellnessHome = renderHome;
  window.azabRenderWellnessProgress = renderProgress;
  selectedDate = today();
  await refresh();
}
