const DB_NAME = 'azab-fitness-os';
const DB_VERSION = 4;
const NEW_STORES = ['programs', 'program_days', 'exercises', 'program_exercises'];
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const uid = () => crypto.randomUUID();
const now = () => Date.now();
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const stamp = (row = {}) => ({ created_at: row.created_at || now(), updated_at: now() });
let db;
let dialog;
let draftDays = [];

const copy = {
  ar: {
    cardTitle: 'بياناتك وخطتك', cardHint: 'الملف الشخصي · الأهداف · برنامج التدريب', edit: 'مراجعة / تعديل',
    titleNew: 'ظبط بياناتك وخطة البداية', titleEdit: 'ملفك الشخصي وخطة البداية',
    intro: 'القيم المعروفة متعبّية كبداية وتقدر تغيّرها. تاريخ الميلاد والجنس والخبرة والمعدات مش هنتوقعهم بدلًا منك.',
    personal: 'بياناتك', name: 'الاسم (اختياري)', birth: 'تاريخ الميلاد (اختياري)', sex: 'الجنس (اختياري)', choose: 'اختر', male: 'ذكر', female: 'أنثى', prefer: 'أفضل عدم الإجابة', height: 'الطول (سم)', initialWeight: 'وزنك الحالي/الابتدائي (كجم)', weightInitialNote: 'يتسجل مرة واحدة لو مفيش سجل وزن قبل كده. بعد الإعداد، سجّل الوزن من تبويب التقدم.',
    currentWeight: 'آخر وزن مسجّل', openWeight: 'افتح سجل الوزن', training: 'تدريبك', experience: 'مستوى الخبرة', beginner: 'مبتدئ', intermediate: 'متوسط', advanced: 'متقدم', days: 'عدد أيام التدريب في الأسبوع', equipment: 'المعدات المتاحة',
    equipBody: 'وزن الجسم', equipDumbbells: 'دامبلز', equipBarbell: 'بار وأوزان', equipMachine: 'أجهزة', equipCable: 'كابل', equipBands: 'استيك مقاومة', equipOther: 'معدات أخرى / هحددها لاحقًا',
    goal: 'هدفك', goalType: 'نوع الهدف', gain: 'زيادة وزن وعضل', maintain: 'ثبات وزن', cut: 'خفض وزن', targetWeight: 'الوزن المستهدف (كجم)', targetRate: 'معدل التغيير المستهدف (كجم/أسبوع)', targetDate: 'تاريخ مستهدف (اختياري)',
    daily: 'أهدافك اليومية', calories: 'السعرات (kcal)', protein: 'البروتين (جم)', carbs: 'الكربوهيدرات (جم)', fat: 'الدهون (جم)', water: 'الماء (مل)', sleep: 'النوم (دقيقة)', effective: 'تسري الأهداف من',
    planTitle: 'خطة البداية (قابلة للتعديل)', planNote: 'خطة PPL مرنة كمثال أولي. عدّل أسماء التمارين والجرعات أو أضف واحذف؛ الأوزان فاضية لحد ما تدخلها.',
    dayName: 'اسم اليوم / المجموعة', addDay: 'إضافة يوم', removeDay: 'حذف اليوم', addExercise: 'إضافة تمرين', remove: 'حذف', exerciseEn: 'Exercise name', exerciseAr: 'اسم التمرين بالعربي', sets: 'مجموعات', repMin: 'أقل تكرار', repMax: 'أعلى تكرار', weight: 'وزن بداية (كجم)', rir: 'RIR', rest: 'راحة (ثانية)',
    save: 'حفظ البيانات والخطة', cancel: 'إلغاء', saved: 'اتحفظت بياناتك وخطتك على الجهاز.', planFallback: 'بياناتك محفوظة محليًا على هذا المتصفح. صدّر نسخة احتياطية بانتظام.',
    mon: 'يوم الدفع', pull: 'يوم السحب', legs: 'يوم الأرجل', push: 'Push', pullEn: 'Pull', legsEn: 'Legs',
    equipmentNeed: 'اختار معدة واحدة على الأقل، أو «معدات أخرى / هحددها لاحقًا».',
    setupRequired: 'كمّل مستوى الخبرة وعدد أيام التدريب واحفظ إعدادك الأول.',
  },
  en: {
    cardTitle: 'Profile & plan', cardHint: 'Profile · goals · training program', edit: 'Review / edit',
    titleNew: 'Set up your profile and starting plan', titleEdit: 'Your profile and starting plan',
    intro: 'Known values are prefilled and editable. We will not guess your birth date, sex, experience, or equipment.',
    personal: 'Your profile', name: 'Name (optional)', birth: 'Birth date (optional)', sex: 'Sex (optional)', choose: 'Choose', male: 'Male', female: 'Female', prefer: 'Prefer not to say', height: 'Height (cm)', initialWeight: 'Current / starting weight (kg)', weightInitialNote: 'Saved once only if no weight log exists. After setup, log weight from Progress.',
    currentWeight: 'Latest logged weight', openWeight: 'Open weight log', training: 'Training', experience: 'Experience level', beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', days: 'Training days per week', equipment: 'Available equipment',
    equipBody: 'Bodyweight', equipDumbbells: 'Dumbbells', equipBarbell: 'Barbell & plates', equipMachine: 'Machines', equipCable: 'Cable', equipBands: 'Resistance bands', equipOther: 'Other / I will decide later',
    goal: 'Your goal', goalType: 'Goal type', gain: 'Gain weight and muscle', maintain: 'Maintain weight', cut: 'Lose weight', targetWeight: 'Target weight (kg)', targetRate: 'Target change rate (kg/week)', targetDate: 'Target date (optional)',
    daily: 'Daily targets', calories: 'Calories (kcal)', protein: 'Protein (g)', carbs: 'Carbohydrates (g)', fat: 'Fat (g)', water: 'Water (ml)', sleep: 'Sleep (minutes)', effective: 'Targets effective from',
    planTitle: 'Starting plan (editable)', planNote: 'A flexible PPL starter example. Edit exercise names and prescriptions or add/remove items; weights are blank until you enter them.',
    dayName: 'Day / session name', addDay: 'Add day', removeDay: 'Remove day', addExercise: 'Add exercise', remove: 'Remove', exerciseEn: 'Exercise name', exerciseAr: 'Arabic name', sets: 'Sets', repMin: 'Min reps', repMax: 'Max reps', weight: 'Starting weight (kg)', rir: 'RIR', rest: 'Rest (seconds)',
    save: 'Save profile and plan', cancel: 'Cancel', saved: 'Your profile and plan were saved on this device.', planFallback: 'Your data is stored locally in this browser. Export a backup regularly.',
    mon: 'Push day', pull: 'Pull day', legs: 'Leg day', push: 'Push', pullEn: 'Pull', legsEn: 'Legs',
    equipmentNeed: 'Select at least one item, or “Other / I will decide later”.',
    setupRequired: 'Choose experience and training days, then save your initial setup.',
  },
};
const tr = key => (copy[document.documentElement.lang === 'en' ? 'en' : 'ar'][key] ?? key);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const upgradeDb = request.result;
      for (const name of NEW_STORES) {
        if (!upgradeDb.objectStoreNames.contains(name)) {
          const store = upgradeDb.createObjectStore(name, { keyPath: 'id' });
          store.createIndex('updated_at', 'updated_at');
          if (name === 'program_days') store.createIndex('program_id', 'program_id');
          if (name === 'program_exercises') {
            store.createIndex('program_day_id', 'program_day_id');
            store.createIndex('exercise_id', 'exercise_id');
          }
          if (name === 'exercises') store.createIndex('name', 'name');
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
function latest(rows, dateField = 'updated_at') {
  return rows.filter(row => !row.deleted_at).sort((a, b) => (b[dateField] || 0) - (a[dateField] || 0))[0] || null;
}
function starterPlan(experience = '') {
  const sets = experience === 'beginner' ? 2 : 3;
  const make = (name, name_ar, muscle_group, equipment) => ({
    id: uid(), relation_id: uid(), name, name_ar, muscle_group, equipment,
    target_sets: sets, rep_min: 8, rep_max: 12, target_rir: 2, rest_seconds: 90, starting_weight_kg: '', note: '',
  });
  return [
    { id: uid(), day_key: 'push', name: 'Push', name_ar: 'دفع', exercises: [
      make('Dumbbell bench press', 'ضغط صدر بالدامبل', 'chest', 'dumbbells'),
      make('Overhead press', 'ضغط كتف', 'shoulders', 'dumbbells'),
      make('Lateral raise', 'رفرفة جانبي', 'shoulders', 'dumbbells'),
    ] },
    { id: uid(), day_key: 'pull', name: 'Pull', name_ar: 'سحب', exercises: [
      make('Lat pulldown', 'سحب علوي', 'back', 'cable'),
      make('Seated row', 'تجديف جالس', 'back', 'cable'),
      make('Biceps curl', 'ثني بايسبس', 'arms', 'dumbbells'),
    ] },
    { id: uid(), day_key: 'legs', name: 'Legs', name_ar: 'أرجل', exercises: [
      make('Goblet squat', 'سكوات دامبل', 'legs', 'dumbbells'),
      make('Romanian deadlift', 'رفعة رومانية', 'legs', 'dumbbells'),
      make('Leg extension', 'تمديد الرجل', 'legs', 'machine'),
    ] },
  ];
}
function equipmentChoices(selected = []) {
  const values = [
    ['bodyweight', 'equipBody'], ['dumbbells', 'equipDumbbells'], ['barbell', 'equipBarbell'],
    ['machines', 'equipMachine'], ['cable', 'equipCable'], ['bands', 'equipBands'], ['other', 'equipOther'],
  ];
  return values.map(([value, label]) => `<label class="p1-check"><input type="checkbox" name="equipment" value="${value}" ${selected.includes(value) ? 'checked' : ''}><span>${tr(label)}</span></label>`).join('');
}
function renderDay(day, index) {
  const dayName = document.documentElement.lang === 'en' ? day.name : (day.name_ar || day.name);
  return `<section class="p1-day" data-day-id="${escapeHtml(day.id)}" data-day-key="${escapeHtml(day.day_key || 'custom')}" data-day-name-en="${escapeHtml(day.name)}" data-day-name-ar="${escapeHtml(day.name_ar || day.name)}">
    <div class="p1-day-head"><span class="p1-order">${index + 1}</span><label class="p1-grow"><span>${tr('dayName')}</span><input class="p1-day-en" value="${escapeHtml(day.name)}" required aria-label="${tr('dayName')} (English)"><input class="p1-day-ar" value="${escapeHtml(day.name_ar || day.name)}" aria-label="${tr('dayName')} (Arabic)"></label><button type="button" class="small-btn p1-remove-day">${tr('removeDay')}</button></div>
    <div class="p1-exercises">${day.exercises.map((exercise, exerciseIndex) => renderExercise(exercise, exerciseIndex)).join('')}</div>
    <button type="button" class="small-btn p1-add-exercise">${tr('addExercise')}</button>
  </section>`;
}
function renderExercise(exercise, index) {
  return `<article class="p1-exercise" data-ex-id="${escapeHtml(exercise.id)}" data-rel-id="${escapeHtml(exercise.relation_id || '')}">
    <div class="p1-exercise-head"><strong>${tr('exerciseEn')} ${index + 1}</strong><button type="button" class="text-btn p1-remove-exercise">${tr('remove')}</button></div>
    <div class="p1-exercise-name"><label><span>${tr('exerciseEn')}</span><input class="p1-name-en" value="${escapeHtml(exercise.name)}" required></label><label><span>${tr('exerciseAr')}</span><input class="p1-name-ar" value="${escapeHtml(exercise.name_ar || exercise.name)}"></label></div>
    <div class="p1-prescription"><label><span>${tr('sets')}</span><input class="p1-sets" type="number" min="1" max="20" value="${Number(exercise.target_sets) || 3}" required></label><label><span>${tr('repMin')}</span><input class="p1-rep-min" type="number" min="1" max="100" value="${Number(exercise.rep_min) || 8}" required></label><label><span>${tr('repMax')}</span><input class="p1-rep-max" type="number" min="1" max="100" value="${Number(exercise.rep_max) || 12}" required></label><label><span>${tr('weight')}</span><input class="p1-weight" type="number" min="0" step="0.5" value="${exercise.starting_weight_kg ?? ''}" placeholder="—"></label><label><span>${tr('rir')}</span><input class="p1-rir" type="number" min="0" max="10" value="${Number(exercise.target_rir ?? 2)}"></label><label><span>${tr('rest')}</span><input class="p1-rest" type="number" min="0" max="1800" value="${Number(exercise.rest_seconds ?? 90)}"></label></div>
  </article>`;
}
function readDraftDays() {
  return $$('.p1-day', dialog).map(dayEl => ({
    id: dayEl.dataset.dayId || uid(), day_key: dayEl.dataset.dayKey || 'custom',
    name: $('.p1-day-en', dayEl).value.trim(), name_ar: $('.p1-day-ar', dayEl).value.trim(),
    exercises: $$('.p1-exercise', dayEl).map(exEl => ({
      id: exEl.dataset.exId || uid(), relation_id: exEl.dataset.relId || '',
      name: $('.p1-name-en', exEl).value.trim(), name_ar: $('.p1-name-ar', exEl).value.trim(),
      target_sets: Number($('.p1-sets', exEl).value), rep_min: Number($('.p1-rep-min', exEl).value),
      rep_max: Number($('.p1-rep-max', exEl).value), starting_weight_kg: $('.p1-weight', exEl).value === '' ? null : Number($('.p1-weight', exEl).value),
      target_rir: $('.p1-rir', exEl).value === '' ? null : Number($('.p1-rir', exEl).value),
      rest_seconds: Number($('.p1-rest', exEl).value) || 0,
    })),
  }));
}
function renderDays() {
  $('#p1-plan', dialog).innerHTML = draftDays.map(renderDay).join('');
}
async function loadState() {
  const [profiles, goals, targets, weights, programs, days, exercises, relations] = await Promise.all([
    all('profile'), all('goals'), all('daily_targets'), all('weight_logs'), all('programs'),
    all('program_days'), all('exercises'), all('program_exercises'),
  ]);
  const profile = profiles.find(row => !row.deleted_at) || null;
  const program = programs.filter(row => row.is_active && !row.deleted_at).sort((a, b) => b.updated_at - a.updated_at)[0] || null;
  let planDays = [];
  if (program) {
    const programDays = days.filter(row => row.program_id === program.id && !row.deleted_at).sort((a, b) => a.position - b.position);
    planDays = programDays.map(day => ({
      id: day.id, day_key: day.day_key || 'custom', name: day.name, name_ar: day.name_ar || day.name,
      exercises: relations.filter(row => row.program_day_id === day.id && !row.deleted_at).sort((a, b) => a.position - b.position).map(rel => {
        const exercise = exercises.find(row => row.id === rel.exercise_id) || {};
        return { ...exercise, id: exercise.id || uid(), relation_id: rel.id, ...rel };
      }),
    }));
  }
  return {
    profile, goals: goals.filter(row => !row.deleted_at), targets: targets.filter(row => !row.deleted_at),
    weights: weights.filter(row => !row.deleted_at), program, planDays: planDays.length ? planDays : starterPlan(profile?.experience_level),
  };
}
function installDialog() {
  dialog = document.createElement('dialog');
  dialog.id = 'phase1Dialog';
  dialog.className = 'p1-dialog';
  dialog.innerHTML = `<form id="p1-form" class="p1-form" novalidate>
    <header class="p1-dialog-head"><div><p class="eyebrow">PHASE 1 · PERSONAL SETUP</p><h2 id="p1-title"></h2></div><button type="button" class="icon-btn" id="p1-close" aria-label="Close">×</button></header>
    <p class="p1-intro" id="p1-intro"></p>
    <fieldset><legend>${tr('personal')}</legend><div class="p1-grid">
      <label><span>${tr('name')}</span><input name="name" autocomplete="name" maxlength="80"></label>
      <label><span>${tr('birth')}</span><input name="birth_date" type="date"></label>
      <label><span>${tr('sex')}</span><select name="sex"><option value="">${tr('choose')}</option><option value="male">${tr('male')}</option><option value="female">${tr('female')}</option><option value="prefer_not_to_say">${tr('prefer')}</option></select></label>
      <label><span>${tr('height')}</span><input name="height_cm" type="number" min="50" max="260" step="0.1" required></label>
      <div class="p1-weight-slot"></div>
    </div></fieldset>
    <fieldset><legend>${tr('training')}</legend><div class="p1-grid">
      <label><span>${tr('experience')}</span><select name="experience_level" required><option value="">${tr('choose')}</option><option value="beginner">${tr('beginner')}</option><option value="intermediate">${tr('intermediate')}</option><option value="advanced">${tr('advanced')}</option></select></label>
      <label><span>${tr('days')}</span><input name="training_days" type="number" min="1" max="7" required></label>
    </div><p class="p1-label">${tr('equipment')}</p><div class="p1-equipment">${equipmentChoices()}</div></fieldset>
    <fieldset><legend>${tr('goal')}</legend><div class="p1-grid">
      <label><span>${tr('goalType')}</span><select name="goal_type"><option value="gain">${tr('gain')}</option><option value="maintain">${tr('maintain')}</option><option value="cut">${tr('cut')}</option></select></label>
      <label><span>${tr('targetWeight')}</span><input name="target_weight_kg" type="number" min="20" max="400" step="0.1" required></label>
      <label><span>${tr('targetRate')}</span><input name="target_rate_kg_per_week" type="number" min="0" max="5" step="0.05" required></label>
      <label><span>${tr('targetDate')}</span><input name="target_date" type="date"></label>
    </div></fieldset>
    <fieldset><legend>${tr('daily')}</legend><div class="p1-grid p1-targets">
      <label><span>${tr('calories')}</span><input name="calories" type="number" min="0" max="15000" required></label>
      <label><span>${tr('protein')}</span><input name="protein_g" type="number" min="0" max="1000" required></label>
      <label><span>${tr('carbs')}</span><input name="carbs_g" type="number" min="0" max="1500" required></label>
      <label><span>${tr('fat')}</span><input name="fat_g" type="number" min="0" max="1000" required></label>
      <label><span>${tr('water')}</span><input name="water_ml" type="number" min="0" max="15000" required></label>
      <label><span>${tr('sleep')}</span><input name="sleep_minutes" type="number" min="0" max="1440" required></label>
      <label><span>${tr('effective')}</span><input name="effective_from" type="date" required></label>
    </div></fieldset>
    <fieldset><legend>${tr('planTitle')}</legend><p class="muted">${tr('planNote')}</p><div id="p1-plan"></div><button type="button" class="secondary" id="p1-add-day">${tr('addDay')}</button></fieldset>
    <p class="p1-error" id="p1-error" role="alert" hidden></p>
    <div class="p1-actions"><button type="button" class="secondary" id="p1-cancel">${tr('cancel')}</button><button type="submit" class="primary">${tr('save')}</button></div>
  </form>`;
  document.body.append(dialog);
  $('#profileBtn')?.addEventListener('click', openEditor);
  $('#p1-close', dialog).onclick = () => dialog.close();
  $('#p1-cancel', dialog).onclick = () => dialog.close();
  $('#p1-add-day', dialog).onclick = () => {
    draftDays = readDraftDays();
    draftDays.push({ id: uid(), day_key: 'custom', name: `Day ${draftDays.length + 1}`, name_ar: `يوم ${draftDays.length + 1}`, exercises: [] });
    renderDays();
  };
  $('#p1-plan', dialog).addEventListener('click', event => {
    const day = event.target.closest('.p1-day');
    if (!day) return;
    if (event.target.closest('.p1-add-exercise')) {
      draftDays = readDraftDays();
      const target = draftDays.find(item => item.id === day.dataset.dayId);
      if (target) target.exercises.push({ id: uid(), relation_id: '', name: '', name_ar: '', target_sets: 3, rep_min: 8, rep_max: 12, target_rir: 2, rest_seconds: 90, starting_weight_kg: '' });
      renderDays();
    } else if (event.target.closest('.p1-remove-day')) {
      draftDays = readDraftDays().filter(item => item.id !== day.dataset.dayId);
      renderDays();
    } else if (event.target.closest('.p1-remove-exercise')) {
      const exercise = event.target.closest('.p1-exercise');
      draftDays = readDraftDays();
      const target = draftDays.find(item => item.id === day.dataset.dayId);
      if (target) target.exercises = target.exercises.filter(item => item.id !== exercise.dataset.exId);
      renderDays();
    }
  });
  $('#p1-form', dialog).addEventListener('submit', saveForm);
}
function fieldValue(form, name, value) {
  const field = form.elements.namedItem(name);
  if (field) field.value = value ?? '';
}
async function openEditor() {
  const state = await loadState();
  const form = $('#p1-form', dialog);
  const activeGoal = state.goals.filter(row => row.status === 'active').sort((a, b) => b.updated_at - a.updated_at)[0] || null;
  const target = latest(state.targets, 'effective_from') || {};
  const isNew = !state.profile;
  $('#p1-title', dialog).textContent = isNew ? tr('titleNew') : tr('titleEdit');
  $('#p1-intro', dialog).textContent = tr('intro');
  fieldValue(form, 'name', state.profile?.name);
  fieldValue(form, 'birth_date', state.profile?.birth_date);
  fieldValue(form, 'sex', state.profile?.sex);
  fieldValue(form, 'height_cm', state.profile?.height_cm ?? 175);
  fieldValue(form, 'experience_level', state.profile?.experience_level);
  fieldValue(form, 'training_days', state.profile?.training_days ?? '');
  fieldValue(form, 'goal_type', activeGoal?.goal_type || 'gain');
  fieldValue(form, 'target_weight_kg', activeGoal?.target_weight_kg ?? 70);
  fieldValue(form, 'target_rate_kg_per_week', activeGoal?.target_rate_kg_per_week ?? 0.3);
  fieldValue(form, 'target_date', activeGoal?.target_date);
  fieldValue(form, 'calories', target.calories ?? 3700);
  fieldValue(form, 'protein_g', target.protein_g ?? 170);
  fieldValue(form, 'carbs_g', target.carbs_g ?? 520);
  fieldValue(form, 'fat_g', target.fat_g ?? 105);
  fieldValue(form, 'water_ml', target.water_ml ?? 3000);
  fieldValue(form, 'sleep_minutes', target.sleep_minutes ?? 480);
  fieldValue(form, 'effective_from', today());
  $$('.p1-equipment input[name="equipment"]', dialog).forEach(input => { input.checked = (state.profile?.equipment || []).includes(input.value); });
  const latestWeight = state.weights.sort((a, b) => (b.timestamp || b.logged_at || 0) - (a.timestamp || a.logged_at || 0))[0];
  const weightSlot = $('.p1-weight-slot', dialog);
  weightSlot.innerHTML = latestWeight
    ? `<div class="p1-current-weight"><span>${tr('currentWeight')}</span><strong>${Number(latestWeight.weight_kg).toFixed(1)} kg</strong><button type="button" class="text-btn" id="p1-open-weight">${tr('openWeight')}</button></div>`
    : `<label><span>${tr('initialWeight')}</span><input name="initial_weight_kg" type="number" min="20" max="400" step="0.1" value="56" required><small>${tr('weightInitialNote')}</small></label>`;
  $('#p1-open-weight', dialog)?.addEventListener('click', () => { dialog.close(); document.querySelector('[data-tab="progress"]')?.click(); });
  draftDays = state.planDays;
  renderDays();
  $('#p1-error', dialog).hidden = true;
  if (!dialog.open) dialog.showModal();
}
function validatePlan(days) {
  if (!days.length) return 'plan';
  for (const day of days) {
    if (!day.name) return 'day';
    for (const exercise of day.exercises) {
      if (!exercise.name || exercise.target_sets < 1 || exercise.rep_min < 1 || exercise.rep_max < exercise.rep_min) return 'exercise';
    }
  }
  return '';
}
async function saveForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const err = $('#p1-error', dialog);
  const days = readDraftDays();
  if (!form.reportValidity()) return;
  if (!$$("input[name='equipment']:checked", dialog).length) {
    err.textContent = tr('equipmentNeed'); err.hidden = false; return;
  }
  if (validatePlan(days)) {
    err.textContent = document.documentElement.lang === 'en' ? 'Check that every day and exercise has a name and valid rep range.' : 'راجع أسماء الأيام والتمارين ونطاق التكرارات.';
    err.hidden = false; return;
  }
  const [profiles, goals, targets, weights, programs, oldDays, exercises, oldRelations] = await Promise.all([
    all('profile'), all('goals'), all('daily_targets'), all('weight_logs'), all('programs'),
    all('program_days'), all('exercises'), all('program_exercises'),
  ]);
  const profileOld = profiles.find(row => !row.deleted_at) || null;
  const goalType = form.elements.goal_type.value;
  const targetDate = form.elements.target_date.value || null;
  const targetWeight = Number(form.elements.target_weight_kg.value);
  const targetRate = Number(form.elements.target_rate_kg_per_week.value);
  const activeGoal = goals.filter(row => row.status === 'active' && !row.deleted_at).sort((a, b) => b.updated_at - a.updated_at)[0] || null;
  const goalSame = activeGoal && activeGoal.goal_type === goalType && Number(activeGoal.target_weight_kg) === targetWeight && Number(activeGoal.target_rate_kg_per_week) === targetRate && (activeGoal.target_date || null) === targetDate;
  const currentProgram = programs.filter(row => row.is_active && !row.deleted_at).sort((a, b) => b.updated_at - a.updated_at)[0] || null;
  const programId = currentProgram?.id || uid();
  const currentDays = oldDays.filter(row => row.program_id === programId && !row.deleted_at);
  const currentDayIds = new Set(currentDays.map(row => row.id));
  const currentRelations = oldRelations.filter(row => currentDayIds.has(row.program_day_id) && !row.deleted_at);
  const keepDayIds = new Set(days.map(day => day.id));
  const keepRelationIds = new Set(days.flatMap(day => day.exercises.map(exercise => exercise.relation_id).filter(Boolean)));
  const writes = {
    profile: {
      ...(profileOld || {}), id: profileOld?.id || uid(), name: form.elements.name.value.trim() || null,
      birth_date: form.elements.birth_date.value || null, sex: form.elements.sex.value || null,
      height_cm: Number(form.elements.height_cm.value), experience_level: form.elements.experience_level.value,
      equipment: $$("input[name='equipment']:checked", dialog).map(input => input.value),
      training_days: Number(form.elements.training_days.value),
      ...stamp(profileOld || {}),
    },
    program: { ...(currentProgram || {}), id: programId, name: 'PPL Starter', split_type: 'ppl', is_active: true, note: 'Flexible Push → Pull → Legs rotation', ...stamp(currentProgram || {}) },
    days: [], relations: [], exercises: [],
  };
  const nowMs = now();
  for (const oldProgram of programs) {
    if (oldProgram.id !== programId && oldProgram.is_active && !oldProgram.deleted_at) writes.exercises.push({ _kind: 'program', row: { ...oldProgram, is_active: false, updated_at: nowMs } });
  }
  for (const oldDay of currentDays) {
    if (!keepDayIds.has(oldDay.id)) writes.days.push({ ...oldDay, deleted_at: nowMs, updated_at: nowMs });
  }
  for (const oldRelation of currentRelations) {
    if (!keepRelationIds.has(oldRelation.id)) writes.relations.push({ ...oldRelation, deleted_at: nowMs, updated_at: nowMs });
  }
  const exerciseIndex = new Map(exercises.map(row => [row.id, row]));
  days.forEach((day, dayPosition) => {
    const oldDay = currentDays.find(row => row.id === day.id);
    writes.days.push({ ...(oldDay || {}), id: day.id, program_id: programId, day_key: day.day_key, name: day.name, name_ar: day.name_ar, position: dayPosition, deleted_at: null, ...stamp(oldDay || {}) });
    day.exercises.forEach((exercise, exercisePosition) => {
      const oldExercise = exerciseIndex.get(exercise.id);
      const exerciseRow = {
        ...(oldExercise || {}), id: exercise.id, name: exercise.name, name_ar: exercise.name_ar,
        muscle_group: oldExercise?.muscle_group || 'custom', equipment: oldExercise?.equipment || null,
        instructions: oldExercise?.instructions || '', media_ref: oldExercise?.media_ref || null,
        is_custom: oldExercise?.is_custom ?? false,
        starting_weight_kg: exercise.starting_weight_kg, deleted_at: null, ...stamp(oldExercise || {}),
      };
      writes.exercises.push({ _kind: 'exercise', row: exerciseRow });
      const oldRelation = currentRelations.find(row => row.id === exercise.relation_id);
      writes.relations.push({
        ...(oldRelation || {}), id: oldRelation?.id || uid(), program_day_id: day.id, exercise_id: exercise.id,
        position: exercisePosition, target_sets: exercise.target_sets, rep_min: exercise.rep_min, rep_max: exercise.rep_max,
        target_rir: exercise.target_rir, rest_seconds: exercise.rest_seconds, note: exercise.note || '',
        deleted_at: null, ...stamp(oldRelation || {}),
      });
    });
  });
  const targetDateValue = form.elements.effective_from.value;
  const targetOld = targets.find(row => row.effective_from === targetDateValue && !row.deleted_at) || null;
  const targetRow = {
    ...(targetOld || {}), id: targetOld?.id || uid(), effective_from: targetDateValue,
    calories: Number(form.elements.calories.value), protein_g: Number(form.elements.protein_g.value),
    carbs_g: Number(form.elements.carbs_g.value), fat_g: Number(form.elements.fat_g.value),
    water_ml: Number(form.elements.water_ml.value), sleep_minutes: Number(form.elements.sleep_minutes.value),
    ...stamp(targetOld || {}),
  };
  const initialWeight = !weights.some(row => !row.deleted_at) && form.elements.initial_weight_kg ? Number(form.elements.initial_weight_kg.value) : null;
  const initialWeightRow = initialWeight ? { id: uid(), weight_kg: initialWeight, logged_at: nowMs, timestamp: nowMs, local_date: today(), note: 'Initial profile weight', ...stamp() } : null;
  const storeNames = ['profile', 'goals', 'daily_targets', 'weight_logs', 'programs', 'program_days', 'exercises', 'program_exercises'];
  await new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');
    tx.objectStore('profile').put(writes.profile);
    if (activeGoal && !goalSame) tx.objectStore('goals').put({ ...activeGoal, status: 'closed', ended_at: nowMs, updated_at: nowMs });
    if (!goalSame) tx.objectStore('goals').put({ id: uid(), goal_type: goalType, target_weight_kg: targetWeight, target_rate_kg_per_week: targetRate, target_date: targetDate, status: 'active', started_at: nowMs, ended_at: null, created_at: nowMs, updated_at: nowMs });
    tx.objectStore('daily_targets').put(targetRow);
    if (initialWeightRow) tx.objectStore('weight_logs').put(initialWeightRow);
    tx.objectStore('programs').put(writes.program);
    for (const item of writes.exercises) {
      if (item._kind === 'program') tx.objectStore('programs').put(item.row);
      else tx.objectStore('exercises').put(item.row);
    }
    for (const row of writes.days) tx.objectStore('program_days').put(row);
    for (const row of writes.relations) tx.objectStore('program_exercises').put(row);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
  dialog.close();
  await renderCard();
  document.dispatchEvent(new CustomEvent('azab:targets-changed'));
  toast(tr('saved'));
}
function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}
async function renderCard() {
  const profile = (await all('profile')).find(row => !row.deleted_at);
  const targets = (await all('daily_targets')).filter(row => !row.deleted_at).sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  const goals = (await all('goals')).filter(row => row.status === 'active' && !row.deleted_at).sort((a, b) => b.updated_at - a.updated_at);
  const weight = (await all('weight_logs')).filter(row => !row.deleted_at).sort((a, b) => (b.timestamp || b.logged_at || 0) - (a.timestamp || a.logged_at || 0))[0];
  const card = $('#phase1Card');
  if (!card) return;
  if (!profile) {
    card.innerHTML = `<div class="card-title"><div><h3>${tr('cardTitle')}</h3><p class="muted">${tr('cardHint')}</p></div><span class="pill">SETUP</span></div><button type="button" class="primary" id="p1-open">${tr('edit')}</button>`;
  } else {
    const goal = goals[0];
    const target = targets[0];
    card.innerHTML = `<div class="card-title"><div><h3>${escapeHtml(profile.name || tr('cardTitle'))}</h3><p class="muted">${tr('cardHint')}</p></div><span class="pill">${escapeHtml(profile.experience_level ? tr(profile.experience_level) : '')}</span></div>
      <div class="p1-summary"><span>${tr('height')}: <strong>${Number(profile.height_cm).toFixed(0)} cm</strong></span><span>${tr('currentWeight')}: <strong>${weight ? Number(weight.weight_kg).toFixed(1) + ' kg' : '—'}</strong></span><span>${tr('targetWeight')}: <strong>${goal ? Number(goal.target_weight_kg).toFixed(1) + ' kg' : '—'}</strong></span><span>${tr('calories')}: <strong>${target?.calories ?? '—'}</strong></span></div>
      <button type="button" class="secondary" id="p1-open">${tr('edit')}</button>`;
  }
  $('#p1-open', card)?.addEventListener('click', openEditor);
}
async function getWorkoutPlan(dayKey) {
  const programs = (await all('programs')).filter(row => row.is_active && !row.deleted_at).sort((a, b) => b.updated_at - a.updated_at);
  const program = programs[0];
  if (!program) return [];
  const days = (await all('program_days')).filter(row => row.program_id === program.id && !row.deleted_at).sort((a, b) => a.position - b.position);
  const index = ({ push: 0, pull: 1, legs: 2 })[dayKey];
  const day = days.find(row => row.day_key === dayKey) || days[index];
  if (!day) return [];
  const relations = (await all('program_exercises')).filter(row => row.program_day_id === day.id && !row.deleted_at).sort((a, b) => a.position - b.position);
  const exercises = await all('exercises');
  const english = document.documentElement.lang === 'en';
  return relations.map(row => {
    const exercise = exercises.find(item => item.id === row.exercise_id && !item.deleted_at);
    if (!exercise) return null;
    return {
      id: exercise.id, exercise_id: exercise.id, relation_id: row.id,
      name: english ? exercise.name : (exercise.name_ar || exercise.name),
      target_sets: row.target_sets, rep_min: row.rep_min, rep_max: row.rep_max,
      target_rir: row.target_rir, rest_seconds: row.rest_seconds,
      starting_weight_kg: exercise.starting_weight_kg,
    };
  }).filter(Boolean);
}

export async function initPhase1() {
  db = await openDB();
  installDialog();
  const home = $('#home');
  if (home && !$('#phase1Card')) {
    const card = document.createElement('article');
    card.id = 'phase1Card'; card.className = 'card p1-profile-card';
    $('#backupCard', home)?.insertAdjacentElement('afterend', card);
  }
  window.azabGetWorkoutPlan = getWorkoutPlan;
  await renderCard();
  const state = await loadState();
  const profileReady = !!(state.profile?.experience_level && state.profile?.training_days && Array.isArray(state.profile?.equipment));
  const hasGoal = state.goals.some(row => row.status === 'active');
  if (!(profileReady && hasGoal && state.targets.length && state.program)) {
    await openEditor();
  }
  const observer = new MutationObserver(() => { renderCard(); });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
}
