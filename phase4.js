import {
  aggregatePeriodVolume,
  flattenCompletedSets,
  groupExerciseSessions,
  personalRecords,
  progressionRecommendation,
} from './progression-core.mjs';

const DB_NAME = 'azab-fitness-os';
const DB_VERSION = 4;
const $ = (selector, root = document) => root.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const locale = () => document.documentElement.lang === 'en' ? 'en' : 'ar';
const tr = key => copy[locale()][key] ?? key;
const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const copy = {
  ar: {
    title: 'تقدم القوة والتحليلات', eyebrow: 'PHASE 4 · محلي وأوفلاين',
    weeklySummary: 'ملخص الأسبوع الحالي', completedSessions: 'جلسات مكتملة', weeklyVolume: 'حجم الحمل المسجل', loadedSets: 'مجموعات محمّلة',
    fromPreviousWeek: 'مقارنة بالأسبوع السابق', noPreviousVolume: 'لا يوجد حجم للأسبوع السابق للمقارنة.',
    exercise: 'التمرين', chooseExercise: 'اختار تمرينًا من سجل مكتمل', period: 'الفترة', weeks: 'آخر 8 أسابيع', months: 'آخر 6 شهور',
    trendTitle: 'اتجاه الحجم التدريبي', trendSubtitleWeek: 'حمل مسجل × تكرارات · أسبوعيًا', trendSubtitleMonth: 'حمل مسجل × تكرارات · شهريًا',
    noExerciseData: 'كمّل جلسة تدريب وسجّل الحمل والتكرارات عشان يظهر التحليل.',
    prs: 'أفضل الأرقام المسجلة', bestLoad: 'أعلى حمل', bestReps: 'أعلى تكرار بحمل', bestE1rm: 'أعلى e1RM تقديري',
    history: 'آخر الجلسات المكتملة', noHistory: 'لا يوجد تاريخ مكتمل لهذا التمرين بعد.',
    date: 'التاريخ', sessionsUnit: 'جلسات', setsUnit: 'مجموعة', volumeUnit: 'كجم × تكرار', repsUnit: 'تكرار',
    recommendation: 'التدرج المقترح', recommendationIntro: 'اقتراح مبني على الخطة وآخر جلسة مكتملة فقط. لا يغيّر البرنامج أو الأوزان تلقائيًا.',
    noHistoryAdvice: 'لا توجد جلسة مكتملة لهذا التمرين حتى الآن.',
    missingPlan: 'نطاق التكرار أو عدد المجموعات غير موجود في لقطة الخطة لهذه الجلسة؛ لن أقترح تغيير حمل.',
    missingTargetRir: 'هدف RIR غير محفوظ في هذه الجلسة؛ سجّل/حدّد هدف RIR قبل استخدام اقتراح زيادة الحمل.',
    moreSetsNeeded: 'أكمل عدد المجموعات المستهدف قبل تقييم التدرج.',
    incompleteSetData: 'بعض المجموعات ينقصها حمل أو تكرار. أكمل تسجيل المجموعات قبل تقييم التدرج.',
    missingRir: 'سجّل RIR لكل مجموعة عمل قبل تقييم زيادة الحمل.',
    buildReps: 'حافظ على الحمل الحالي وركّز على بلوغ الحد الأدنى للتكرارات المقررة أولًا.',
    holdLoad: 'استمر على الحمل الحالي وابنِ التكرارات تدريجيًا حتى يصل كل set للحد الأعلى المقرر.',
    holdRir: 'التكرارات وصلت للحد الأعلى، لكن RIR أقل من الهدف. ثبّت الحمل وسجّل جهدًا مناسبًا قبل الزيادة.',
    increaseLoad: 'كل المجموعات وصلت للحد الأعلى للتكرار مع RIR عند الهدف أو أعلى؛ الزيادة الصغيرة التالية ممكنة.',
    currentLoad: 'الحمل الحالي', suggestedLoad: 'حمل مقترح للجلسة القادمة',
    manualOnly: 'راجع الرقم وعدّله بنفسك في الخطة إذا قررت استخدامه؛ هذه شاشة قراءة ولا تحفظ أي تغيير.',
    volumeNote: 'الحجم هنا = الحمل الخارجي بالكيلوجرام × التكرارات. مجموعات وزن الجسم أو المجموعات بلا حمل مسجل لا تدخل الحساب.',
    e1rmNote: 'e1RM تقدير بمعادلة Epley للمجموعات المحمّلة من 1 إلى 12 تكرارًا فقط؛ ليس اختبار أقصى فعليًا ولا نصيحة طبية.',
    localNote: 'الحسابات تقرأ سجلات التدريب المكتملة على هذا الجهاز فقط. السجلات المحذوفة منطقيًا والجلسات غير المكتملة مستبعدة.',
    databaseError: 'تعذر قراءة سجل التمرين المحلي الآن. جرّب إعادة فتح التطبيق.',
    chartAccessible: 'رسم الحجم التدريبي حسب الفترة', emptyValue: '—',
  },
  en: {
    title: 'Strength progression & analytics', eyebrow: 'PHASE 4 · LOCAL & OFFLINE',
    weeklySummary: 'This week', completedSessions: 'Completed sessions', weeklyVolume: 'Logged load volume', loadedSets: 'Loaded sets',
    fromPreviousWeek: 'vs previous week', noPreviousVolume: 'No prior-week volume to compare.',
    exercise: 'Exercise', chooseExercise: 'Choose an exercise with completed history', period: 'Period', weeks: 'Last 8 weeks', months: 'Last 6 months',
    trendTitle: 'Training-volume trend', trendSubtitleWeek: 'Logged load × reps · weekly', trendSubtitleMonth: 'Logged load × reps · monthly',
    noExerciseData: 'Complete a workout and log load and reps to see analytics.',
    prs: 'Logged personal records', bestLoad: 'Heaviest load', bestReps: 'Most reps with load', bestE1rm: 'Highest estimated e1RM',
    history: 'Recent completed sessions', noHistory: 'No completed history for this exercise yet.',
    date: 'Date', sessionsUnit: 'sessions', setsUnit: 'sets', volumeUnit: 'kg × reps', repsUnit: 'reps',
    recommendation: 'Progression suggestion', recommendationIntro: 'Based only on the plan and the latest completed session. It never changes your program or loads automatically.',
    noHistoryAdvice: 'There is no completed session for this exercise yet.',
    missingPlan: 'The rep range or prescribed set count is missing from this session snapshot; no load change is suggested.',
    missingTargetRir: 'Target RIR was not saved in this session; set/log an RIR target before using a load-increase suggestion.',
    moreSetsNeeded: 'Complete the prescribed number of sets before evaluating progression.',
    incompleteSetData: 'Some sets are missing load or reps. Finish logging the sets before evaluating progression.',
    missingRir: 'Log RIR for every working set before evaluating a load increase.',
    buildReps: 'Keep the current load and first work toward the minimum prescribed reps.',
    holdLoad: 'Keep the current load and build reps gradually until every set reaches the prescribed top end.',
    holdRir: 'Reps reached the top end, but RIR is below target. Hold the load and log effort at the target before increasing.',
    increaseLoad: 'Every set reached the top of the rep range with RIR at or above target; a small next increase may be reasonable.',
    currentLoad: 'Current load', suggestedLoad: 'Suggested next-session load',
    manualOnly: 'Review and adjust the number yourself in your plan if you choose to use it; this screen is read-only and saves no change.',
    volumeNote: 'Volume = external load in kg × reps. Bodyweight or sets without a logged load are excluded.',
    e1rmNote: 'e1RM uses the Epley estimate for loaded sets of 1–12 reps only; it is not an actual max test or medical advice.',
    localNote: 'Calculations read completed training logs on this device only. Soft-deleted rows and incomplete sessions are excluded.',
    databaseError: 'Could not read the local workout history. Try reopening the app.',
    chartAccessible: 'Training-volume chart by period', emptyValue: '—',
  },
};

let db;
let panel;
let selectedExerciseKey = '';
let selectedPeriod = 'week';

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

function number(value, digits = 0) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return tr('emptyValue');
  return new Intl.NumberFormat(locale() === 'en' ? 'en-US' : 'ar-EG', { maximumFractionDigits: digits }).format(Number(value));
}

function dateLabel(value, mode = 'week') {
  if (!value) return tr('emptyValue');
  const options = mode === 'month' ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' };
  return new Intl.DateTimeFormat(locale() === 'en' ? 'en-US' : 'ar-EG', options).format(new Date(`${value}T12:00:00`));
}

function localDateForSession(session) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(session.local_date || '')) return session.local_date;
  const time = Number(session.completed_at || session.started_at);
  if (!Number.isFinite(time)) return '';
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function volumeDelta(current, previous) {
  if (!(previous > 0)) return tr('noPreviousVolume');
  const delta = ((current - previous) / previous) * 100;
  const rounded = Math.round(delta);
  const prefix = rounded > 0 ? '+' : '';
  return `${tr('fromPreviousWeek')}: ${prefix}${number(rounded)}%`;
}

function chartSvg(periods, mode) {
  const width = 560;
  const height = 220;
  const left = 42;
  const right = 12;
  const top = 20;
  const bottom = 46;
  const plotHeight = height - top - bottom;
  const plotWidth = width - left - right;
  const values = periods.map(item => item.volume_kg_reps);
  const max = Math.max(1, ...values);
  const slot = plotWidth / Math.max(1, periods.length);
  const barWidth = Math.min(34, slot * 0.58);
  const grids = [0, 0.5, 1].map(ratio => {
    const y = top + plotHeight * ratio;
    const value = max * (1 - ratio);
    return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" class="p4-gridline"></line><text x="${left - 7}" y="${y + 4}" text-anchor="end" class="p4-axis-label">${escape(number(value))}</text>`;
  }).join('');
  const bars = periods.map((item, index) => {
    const x = left + index * slot + (slot - barWidth) / 2;
    const barHeight = Math.max(1, (item.volume_kg_reps / max) * plotHeight);
    const y = top + plotHeight - barHeight;
    const label = dateLabel(item.start_date, mode);
    const title = `${label}: ${number(item.volume_kg_reps, 1)} ${tr('volumeUnit')}`;
    return `<g><title>${escape(title)}</title><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="5" class="p4-bar"></rect><text x="${(x + barWidth / 2).toFixed(1)}" y="${height - 15}" text-anchor="middle" class="p4-period-label">${escape(label)}</text></g>`;
  }).join('');
  return `<svg class="p4-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(tr('chartAccessible'))}" preserveAspectRatio="xMidYMid meet"><title>${escape(tr('chartAccessible'))}</title>${grids}${bars}</svg>`;
}

function summaryMarkup(sessions, records, today) {
  const periods = aggregatePeriodVolume(records, { mode: 'week', count: 2, anchorDate: today });
  const current = periods.at(-1) || { start_date: today, volume_kg_reps: 0, set_count: 0 };
  const previous = periods.at(-2) || { volume_kg_reps: 0 };
  const completedThisWeek = sessions.filter(session => {
    if (!session || session.deleted_at || session.status !== 'completed') return false;
    const date = localDateForSession(session);
    return date >= current.start_date && date <= today;
  }).length;
  return `<section class="p4-panel" aria-labelledby="p4-summary-heading"><div class="p4-heading"><div><p class="p4-eyebrow">${escape(tr('eyebrow'))}</p><h3 id="p4-summary-heading">${escape(tr('weeklySummary'))}</h3></div></div><div class="p4-summary-grid"><article class="p4-stat"><span>${escape(tr('completedSessions'))}</span><strong>${escape(number(completedThisWeek))}</strong><small>${escape(tr('sessionsUnit'))}</small></article><article class="p4-stat"><span>${escape(tr('weeklyVolume'))}</span><strong>${escape(number(current.volume_kg_reps, 1))}</strong><small>${escape(tr('volumeUnit'))}</small><small class="p4-delta">${escape(volumeDelta(current.volume_kg_reps, previous.volume_kg_reps))}</small></article><article class="p4-stat"><span>${escape(tr('loadedSets'))}</span><strong>${escape(number(current.set_count))}</strong><small>${escape(tr('setsUnit'))}</small></article></div><p class="p4-note">${escape(tr('volumeNote'))}</p></section>`;
}

function recordCard(label, record, value, detail) {
  return `<article class="p4-record"><span>${escape(label)}</span><strong>${escape(value)}</strong><small>${escape(detail || tr('emptyValue'))}</small></article>`;
}

function personalRecordsMarkup(records) {
  const prs = personalRecords(records);
  const bestLoad = prs.best_load;
  const bestReps = prs.best_reps;
  const bestE1rm = prs.best_e1rm;
  return `<section class="p4-panel" aria-labelledby="p4-pr-heading"><h3 id="p4-pr-heading">${escape(tr('prs'))}</h3><div class="p4-record-grid">${recordCard(tr('bestLoad'), bestLoad, bestLoad ? `${number(bestLoad.value_kg, 1)} kg` : tr('emptyValue'), bestLoad ? `${number(bestLoad.reps)} ${tr('repsUnit')} · ${dateLabel(bestLoad.date)}` : '')}${recordCard(tr('bestReps'), bestReps, bestReps ? `${number(bestReps.reps)} ${tr('repsUnit')}` : tr('emptyValue'), bestReps ? `${number(bestReps.value_kg, 1)} kg · ${dateLabel(bestReps.date)}` : '')}${recordCard(tr('bestE1rm'), bestE1rm, bestE1rm ? `${number(bestE1rm.value_kg, 1)} kg` : tr('emptyValue'), bestE1rm ? `${number(bestE1rm.load_kg, 1)} kg × ${number(bestE1rm.reps)} · ${dateLabel(bestE1rm.date)}` : '')}</div><p class="p4-note">${escape(tr('e1rmNote'))}</p></section>`;
}

function trendMarkup(exercise) {
  const periods = aggregatePeriodVolume(exercise?.records || [], {
    mode: selectedPeriod,
    count: selectedPeriod === 'month' ? 6 : 8,
    anchorDate: localToday(),
  });
  const subtitle = selectedPeriod === 'month' ? tr('trendSubtitleMonth') : tr('trendSubtitleWeek');
  return `<section class="p4-panel" aria-labelledby="p4-trend-heading"><div class="p4-heading p4-trend-heading"><div><h3 id="p4-trend-heading">${escape(tr('trendTitle'))}</h3><p class="p4-note">${escape(subtitle)}</p></div><label class="p4-control"><span>${escape(tr('period'))}</span><select data-p4-period><option value="week" ${selectedPeriod === 'week' ? 'selected' : ''}>${escape(tr('weeks'))}</option><option value="month" ${selectedPeriod === 'month' ? 'selected' : ''}>${escape(tr('months'))}</option></select></label></div>${exercise ? chartSvg(periods, selectedPeriod) : `<p class="p4-empty">${escape(tr('noExerciseData'))}</p>`}<p class="p4-note">${escape(tr('volumeNote'))}</p></section>`;
}

function sessionHistoryMarkup(exercise) {
  if (!exercise?.sessions.length) return `<section class="p4-panel"><h3>${escape(tr('history'))}</h3><p class="p4-empty">${escape(tr('noHistory'))}</p></section>`;
  const rows = exercise.sessions.slice(-6).reverse().map(session => {
    const loaded = session.sets.filter(set => set.is_loaded_set);
    const volume = loaded.reduce((sum, set) => sum + set.volume_kg_reps, 0);
    const bestEstimate = personalRecords(loaded).best_e1rm;
    const e1rmText = bestEstimate ? ` · e1RM ${number(bestEstimate.value_kg, 1)} kg` : '';
    return `<div class="p4-history-row"><div><strong>${escape(dateLabel(session.date, 'week'))}</strong><small>${escape(number(loaded.length))} ${escape(tr('setsUnit'))}</small></div><strong>${escape(number(volume, 1))} ${escape(tr('volumeUnit'))}${escape(e1rmText)}</strong></div>`;
  }).join('');
  return `<section class="p4-panel" aria-labelledby="p4-history-heading"><h3 id="p4-history-heading">${escape(tr('history'))}</h3><div class="p4-history-list">${rows}</div></section>`;
}

function recommendationMarkup(exercise) {
  const recommendation = progressionRecommendation(exercise?.sessions || []);
  const messageKey = {
    'no-history': 'noHistoryAdvice',
    'missing-plan': 'missingPlan',
    'missing-target-rir': 'missingTargetRir',
    'more-sets-needed': 'moreSetsNeeded',
    'incomplete-set-data': 'incompleteSetData',
    'missing-rir': 'missingRir',
    'build-reps': 'buildReps',
    'hold-load': 'holdLoad',
    'hold-rir': 'holdRir',
    'increase-load': 'increaseLoad',
  }[recommendation.status] || 'noHistoryAdvice';
  const suggested = recommendation.status === 'increase-load'
    ? `<div class="p4-suggestion"><span>${escape(tr('currentLoad'))}</span><strong>${escape(number(recommendation.current_load_kg, 1))} kg</strong><span>${escape(tr('suggestedLoad'))}</span><strong>${escape(number(recommendation.suggested_load_kg, 1))} kg</strong></div>`
    : '';
  return `<section class="p4-panel p4-recommendation" aria-labelledby="p4-recommend-heading"><h3 id="p4-recommend-heading">${escape(tr('recommendation'))}</h3><p class="p4-note">${escape(tr('recommendationIntro'))}</p><p class="p4-advice" role="status">${escape(tr(messageKey))}</p>${suggested}<p class="p4-note">${escape(tr('manualOnly'))}</p></section>`;
}

function renderEmptyExercises(today, sessions, records) {
  return `${summaryMarkup(sessions, records, today)}<section class="p4-panel"><h3>${escape(tr('title'))}</h3><p class="p4-empty">${escape(tr('noExerciseData'))}</p><p class="p4-note">${escape(tr('localNote'))}</p></section>`;
}

async function render() {
  if (!panel || !db) return;
  const today = localToday();
  try {
    const [sessions, setLogs] = await Promise.all([all('workout_sessions'), all('set_logs')]);
    const records = flattenCompletedSets(sessions, setLogs);
    const exercises = groupExerciseSessions(records);
    if (!exercises.some(exercise => exercise.key === selectedExerciseKey)) selectedExerciseKey = exercises[0]?.key || '';
    if (!exercises.length) {
      panel.innerHTML = renderEmptyExercises(today, sessions, records);
      return;
    }
    const selected = exercises.find(exercise => exercise.key === selectedExerciseKey) || exercises[0];
    selectedExerciseKey = selected.key;
    const selector = `<label class="p4-control p4-exercise-control"><span>${escape(tr('exercise'))}</span><select data-p4-exercise>${exercises.map(exercise => `<option value="${escape(exercise.key)}" ${exercise.key === selected.key ? 'selected' : ''}>${escape(exercise.name)}</option>`).join('')}</select></label>`;
    panel.innerHTML = `<section class="p4-shell" aria-label="${escape(tr('title'))}">${summaryMarkup(sessions, records, today)}<section class="p4-panel"><div class="p4-select-row">${selector}</div><h3 class="p4-selected-name">${escape(selected.name)}</h3></section>${personalRecordsMarkup(selected.records)}${trendMarkup(selected)}${sessionHistoryMarkup(selected)}${recommendationMarkup(selected)}<p class="p4-note p4-local-note">${escape(tr('localNote'))}</p></section>`;
  } catch {
    panel.innerHTML = `<section class="p4-panel"><h3>${escape(tr('title'))}</h3><p class="p4-warning" role="alert">${escape(tr('databaseError'))}</p></section>`;
  }
}

function onChange(event) {
  if (event.target.matches('[data-p4-exercise]')) selectedExerciseKey = event.target.value;
  else if (event.target.matches('[data-p4-period]')) selectedPeriod = event.target.value === 'month' ? 'month' : 'week';
  else return;
  render();
}

export async function initPhase4() {
  db = await openDB();
  panel = $('#progressionAnalytics');
  if (!panel) return;
  panel.addEventListener('change', onChange);
  window.azabRenderProgression = render;
  await render();
}
