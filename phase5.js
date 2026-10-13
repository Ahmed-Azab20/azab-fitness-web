import { buildWeeklyReport, evaluateCoachRules, filterActiveCoachCards } from './coach-core.mjs';

const DB_NAME = 'azab-fitness-os';
const DB_VERSION = 5;
const STATE_KEY = 'phase5_coach_state';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
const $ = (selector, root = document) => root.querySelector(selector);
const locale = () => document.documentElement.lang === 'en' ? 'en' : 'ar';
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const tr = key => copy[locale()][key] ?? key;

const copy = {
  ar: {
    eyebrow: 'المرحلة 5 · محلي ومن دون اتصال',
    heading: 'مدربك · اقتراحات مبنية على بياناتك', empty: 'لا توجد اقتراحات نشطة الآن. سجّل بياناتك باستمرار لظهور ملاحظات أدق.',
    weightTitle: 'اتجاه الوزن أقل من الهدف', weightReason: (card, n) => `متوسط التغير خلال الأسبوعين: ${n(card.change_kg_per_week, 2)} كجم/أسبوع؛ الهدف ${n(card.direction * card.target_rate_kg_per_week, 2)}. حد 50% هو ${n(card.direction * card.threshold_kg_per_week, 2)} كجم/أسبوع.`,
    proteinTitle: 'البروتين أقل من الهدف', proteinReason: (card, n) => `متوسط 7 أيام: ${n(card.average_g, 1)} جم/يوم مقابل هدف ${n(card.target_g, 1)} جم؛ حد 80% هو ${n(card.threshold_g, 1)} جم.`,
    waterTitle: 'الماء أقل من الهدف', waterReason: (card, n) => `متوسط 7 أيام: ${n(card.average_ml, 0)} مل/يوم مقابل هدف ${n(card.target_ml, 0)} مل؛ حد 80% هو ${n(card.threshold_ml, 0)} مل.`,
    sleepTitle: 'متوسط النوم منخفض', sleepReason: (card, n) => `متوسط 7 أيام: ${n(card.average_minutes / 60, 1)} ساعة/يوم مقابل حد ${n(card.target_minutes / 60, 1)} ساعة.`,
    deloadTitle: 'إشارات إرهاق متكررة', deloadReason: (card, n) => {
      const parts = [];
      const drop = card.signals.performance_drop;
      if (drop) {
        const values = drop.metric === 'e1rm'
          ? drop.sessions.map(session => n(session.best_e1rm, 1)).join(' ← ')
          : drop.sessions.map(session => n(session.total_reps, 0)).join(' ← ');
        parts.push(drop.metric === 'e1rm' ? `e1RM لـ ${drop.exercise_name}: ${values} كجم في 3 جلسات` : `تكرارات ${drop.exercise_name}: ${values} في 3 جلسات`);
      }
      if (card.signals.rir_zero_sets) parts.push(`${n(card.signals.rir_zero_sets, 0)} مجموعات بـ RIR = 0 خلال 7 أيام`);
      if (card.signals.fatigue_note) parts.push(`ملاحظات تعب في ${n(card.signals.fatigue_note, 0)} جلسة`);
      return parts.join(' · ');
    },
    progressionTitle: card => `تدرج مقترح · ${card.exercise_name}`,
    progressionReason: (card, n) => `كل المجموعات حققت ${n(card.recommendation.rep_max, 0)} تكرارًا عند RIR ${n(card.recommendation.target_rir, 0)} أو أعلى؛ الحمل المسجل ${n(card.recommendation.current_load_kg, 1)} كجم، والمقترح ${n(card.recommendation.suggested_load_kg, 1)} كجم. لا يتغير برنامجك تلقائيًا.`,
    accept: 'تم التعامل معها', dismiss: 'إخفاء 7 أيام', acted: 'تم تسجيل الاقتراح كتم التعامل معه.', dismissed: 'تم إخفاء الاقتراح لمدة 7 أيام.',
    disclaimer: 'إرشاد للتتبع فقط، مش نصيحة طبية / For tracking only, not medical advice.',
    reportTitle: 'تقرير آخر 7 أيام', copyReport: 'نسخ التقرير الأسبوعي', copied: 'تم نسخ التقرير.', copyFailed: 'تعذر النسخ. انسخ النص من المربع المحدد أدناه.', reportLabel: 'التقرير النصي (قابل للتحديد)', reportError: 'تعذر قراءة البيانات المحلية لإنشاء التقرير.',
    loadError: 'تعذر قراءة بطاقات المدرب من قاعدة البيانات المحلية.',
  },
  en: {
    eyebrow: 'PHASE 5 · LOCAL & OFFLINE',
    heading: 'Coach · data-based suggestions', empty: 'No active suggestions right now. Log consistently for more useful feedback.',
    weightTitle: 'Weight trend below target', weightReason: (card, n) => `14-day weekly change: ${n(card.change_kg_per_week, 2)} kg/week vs target ${n(card.direction * card.target_rate_kg_per_week, 2)}; the 50% threshold is ${n(card.direction * card.threshold_kg_per_week, 2)} kg/week.`,
    proteinTitle: 'Protein below target', proteinReason: (card, n) => `7-day average: ${n(card.average_g, 1)} g/day vs ${n(card.target_g, 1)} g target; the 80% threshold is ${n(card.threshold_g, 1)} g.`,
    waterTitle: 'Water below target', waterReason: (card, n) => `7-day average: ${n(card.average_ml, 0)} ml/day vs ${n(card.target_ml, 0)} ml target; the 80% threshold is ${n(card.threshold_ml, 0)} ml.`,
    sleepTitle: 'Average sleep is low', sleepReason: (card, n) => `7-day average: ${n(card.average_minutes / 60, 1)} h/day vs ${n(card.target_minutes / 60, 1)} h target.`,
    deloadTitle: 'Repeated fatigue signals', deloadReason: (card, n) => {
      const parts = [];
      const drop = card.signals.performance_drop;
      if (drop) {
        const values = drop.metric === 'e1rm'
          ? drop.sessions.map(session => n(session.best_e1rm, 1)).join(' → ')
          : drop.sessions.map(session => n(session.total_reps, 0)).join(' → ');
        parts.push(drop.metric === 'e1rm' ? `${drop.exercise_name} e1RM: ${values} kg across 3 sessions` : `${drop.exercise_name} reps: ${values} across 3 sessions`);
      }
      if (card.signals.rir_zero_sets) parts.push(`${n(card.signals.rir_zero_sets, 0)} sets at RIR = 0 in 7 days`);
      if (card.signals.fatigue_note) parts.push(`fatigue notes in ${n(card.signals.fatigue_note, 0)} sessions`);
      return parts.join(' · ');
    },
    progressionTitle: card => `Progression suggestion · ${card.exercise_name}`,
    progressionReason: (card, n) => `Every set reached ${n(card.recommendation.rep_max, 0)} reps at or above RIR ${n(card.recommendation.target_rir, 0)}; logged load ${n(card.recommendation.current_load_kg, 1)} kg, suggested ${n(card.recommendation.suggested_load_kg, 1)} kg. Your plan is never changed automatically.`,
    accept: 'Accept', dismiss: 'Dismiss · 7 days', acted: 'Marked as acted on.', dismissed: 'Suggestion hidden for 7 days.',
    disclaimer: 'إرشاد للتتبع فقط، مش نصيحة طبية / For tracking only, not medical advice.',
    reportTitle: 'Last 7 days report', copyReport: 'Copy weekly report', copied: 'Report copied.', copyFailed: 'Copy failed. Select and copy the text below.', reportLabel: 'Plain-text report (selectable)', reportError: 'Could not read local data to build the report.',
    loadError: 'Could not read coach cards from the local database.',
  },
};

let db;
let roots = [];
let currentCards = [];
let currentState = { items: {} };
export const COACH_MOUNT_SELECTORS = Object.freeze(['#coachHome', '#coachTab']);

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
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

function put(store, row) {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put({ ...row, updated_at: now, created_at: row.created_at || now });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

function number(value, digits = 0, language = locale()) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ar-EG', { maximumFractionDigits: digits }).format(Number(value));
}

function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function readInputs() {
  const [targets, goals, weightLogs, foodLogs, waterLogs, sleepLogs, sessions, setLogs, settings] = await Promise.all([
    all('daily_targets'), all('goals'), all('weight_logs'), all('food_logs'), all('water_logs'), all('sleep_logs'), all('workout_sessions'), all('set_logs'), all('settings'),
  ]);
  const row = settings.find(item => item.key === STATE_KEY && !item.deleted_at);
  currentState = row?.value && typeof row.value === 'object' ? row.value : { items: {} };
  const input = { today: today(), targets, goals, weightLogs, foodLogs, waterLogs, sleepLogs, sessions, setLogs };
  return { input, settings, row };
}

function localize(card, language = locale()) {
  const text = copy[language === 'en' ? 'en' : 'ar'];
  const n = (value, digits = 0) => number(value, digits, language);
  if (card.type === 'weight-stalled') return { title: text.weightTitle, reason: text.weightReason(card, n) };
  if (card.type === 'protein-low') return { title: text.proteinTitle, reason: text.proteinReason(card, n) };
  if (card.type === 'water-low') return { title: text.waterTitle, reason: text.waterReason(card, n) };
  if (card.type === 'sleep-low') return { title: text.sleepTitle, reason: text.sleepReason(card, n) };
  if (card.type === 'deload') return { title: text.deloadTitle, reason: text.deloadReason(card, n) };
  return { title: text.progressionTitle(card), reason: text.progressionReason(card, n) };
}

function toast(message) {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(window.__phase5Toast);
  window.__phase5Toast = setTimeout(() => node.classList.remove('show'), 2500);
}

function cardMarkup(card, language = locale()) {
  const text = copy[language === 'en' ? 'en' : 'ar'];
  const { title, reason } = localize(card, language);
  return `<article class="p5-card" data-coach-card="${escape(card.id)}"><div class="p5-card-copy"><h3>${escape(title)}</h3><p>${escape(reason)}</p></div><div class="p5-actions"><button class="p5-accept" type="button" data-coach-action="accept" data-coach-id="${escape(card.id)}">${escape(text.accept)}</button><button class="p5-dismiss" type="button" data-coach-action="dismiss" data-coach-id="${escape(card.id)}">${escape(text.dismiss)}</button></div></article>`;
}

export function renderCoachMarkup(cards, language = 'ar') {
  const text = copy[language === 'en' ? 'en' : 'ar'];
  const cardsMarkup = cards.map(card => cardMarkup(card, language)).join('');
  return `<div class="p5-heading"><div><p class="p5-eyebrow">${escape(text.eyebrow)}</p><h2>${escape(text.heading)}</h2></div><button class="p5-report-button" type="button" data-coach-action="report">${escape(text.copyReport)}</button></div>${cardsMarkup ? `<div class="p5-list">${cardsMarkup}</div>` : `<p class="p5-empty">${escape(text.empty)}</p>`}<section class="p5-report" aria-label="${escape(text.reportTitle)}"><label>${escape(text.reportLabel)}</label><textarea data-coach-report aria-label="${escape(text.reportLabel)}" readonly hidden dir="auto"></textarea></section><p class="p5-disclaimer">${escape(text.disclaimer)}</p>`;
}

async function render() {
  if (!roots.length || !db) return;
  try {
    const { input } = await readInputs();
    const rules = evaluateCoachRules(input);
    currentCards = filterActiveCoachCards(rules, currentState, Date.now());
    const markup = renderCoachMarkup(currentCards, locale());
    for (const root of roots) {
      root.setAttribute('aria-label', locale() === 'en' ? 'Phase 5 coach' : 'مدرب المرحلة 5');
      root.innerHTML = markup;
    }
  } catch (error) {
    console.error('Phase 5 coach could not render', error);
    for (const root of roots) root.innerHTML = `<p class="p5-empty" role="alert">${escape(tr('loadError'))}</p>`;
  }
}

async function saveAction(id, action) {
  const card = currentCards.find(item => item.id === id);
  if (!card) return;
  const { settings, row } = await readInputs();
  const state = row?.value && typeof row.value === 'object' ? structuredClone(row.value) : { items: {} };
  if (!state.items || typeof state.items !== 'object') state.items = {};
  const existing = row || settings.find(item => item.key === STATE_KEY);
  state.items[id] = action === 'dismiss'
    ? { status: 'dismissed', dismissed_until: Date.now() + DISMISS_MS }
    : { status: 'accepted', fingerprint: card.fingerprint, acted_at: Date.now() };
  await put('settings', { ...(existing || {}), id: existing?.id || crypto.randomUUID(), key: STATE_KEY, value: state, deleted_at: null });
  toast(action === 'dismiss' ? tr('dismissed') : tr('acted'));
  await render();
}

async function copyReport(root) {
  const { input } = await readInputs();
  const localizedCards = currentCards.map(card => ({ ...card, ...localize(card) }));
  const text = buildWeeklyReport({ ...input, language: locale(), activeCards: localizedCards });
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    const area = $('[data-coach-report]', root);
    if (area) { area.value = text; area.hidden = true; }
    toast(tr('copied'));
  } catch {
    const area = $('[data-coach-report]', root);
    if (!area) return;
    area.value = text;
    area.hidden = false;
    area.focus();
    area.select();
    toast(tr('copyFailed'));
  }
}

async function onClick(root, event) {
  const button = event.target.closest('[data-coach-action]');
  if (!button) return;
  if (button.dataset.coachAction === 'report') await copyReport(root);
  else await saveAction(button.dataset.coachId, button.dataset.coachAction);
}

export async function initPhase5() {
  db = await openDB();
  roots = COACH_MOUNT_SELECTORS.map(selector => $(selector)).filter(Boolean);
  if (!roots.length) return;
  for (const root of roots) root.addEventListener('click', event => onClick(root, event).catch(error => {
    console.error('Phase 5 action failed', error);
    toast(tr('loadError'));
  }));
  document.addEventListener('azab:language-changed', render);
  document.addEventListener('azab:targets-changed', render);
  window.azabRenderCoachHome = render;
  await render();
}
