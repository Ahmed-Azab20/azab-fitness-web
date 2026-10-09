import { effectiveTargetsForDate, sumNutrition } from './nutrition-core.mjs';
import { flattenCompletedSets, groupExerciseSessions, personalRecords, progressionRecommendation } from './progression-core.mjs';

export const COACH_THRESHOLDS = Object.freeze({
  weightLookbackDays: 14,
  intakeLookbackDays: 7,
  deloadLookbackDays: 7,
  weightTargetFraction: 0.5,
  intakeTargetFraction: 0.8,
  defaultSleepMinutes: 7 * 60,
  minimumWeightDaysPerWeek: 2,
  minimumIntakeDays: 3,
  dismissDays: 7,
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const safeNumber = value => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function localDate(value, fallbackTime) {
  if (typeof value === 'string' && ISO_DATE.test(value)) return value;
  const timestamp = safeNumber(value ?? fallbackTime);
  if (timestamp === null) return null;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftDate(dateValue, offset) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function inRange(value, start, end) {
  const date = localDate(value);
  return date && date >= start && date <= end;
}

function cleanRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).filter(row => row && !row.deleted_at);
}

function avg(values) {
  const finite = values.map(safeNumber).filter(value => value !== null);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function weightAverage(rows, start, end) {
  const byDate = new Map();
  for (const row of cleanRows(rows)) {
    const date = localDate(row.local_date, row.timestamp ?? row.logged_at);
    const weight = safeNumber(row.weight_kg);
    if (!date || date < start || date > end || !(weight > 0)) continue;
    byDate.set(date, [...(byDate.get(date) || []), weight]);
  }
  const daily = [...byDate.values()].map(values => avg(values));
  return { average: avg(daily), loggedDays: daily.length };
}

function weightTrend(weightLogs, today) {
  const priorStart = shiftDate(today, -13);
  const priorEnd = shiftDate(today, -7);
  const recentStart = shiftDate(today, -6);
  const previous = weightAverage(weightLogs, priorStart, priorEnd);
  const recent = weightAverage(weightLogs, recentStart, today);
  return {
    previous_average_kg: previous.average,
    previous_logged_days: previous.loggedDays,
    recent_average_kg: recent.average,
    recent_logged_days: recent.loggedDays,
    change_kg_per_week: previous.average === null || recent.average === null ? null : recent.average - previous.average,
  };
}

function activeGoal(goals = []) {
  return cleanRows(goals).filter(goal => goal.status === 'active')
    .sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0))[0] || null;
}

function targetOn(targets, date) {
  return effectiveTargetsForDate(cleanRows(targets), date) || null;
}

function targetField(target, field) {
  const value = safeNumber(target?.[field]);
  return value !== null && value > 0 ? value : null;
}

function nutritionDays(foodLogs, targets, field, start, end) {
  const logsByDate = new Map();
  for (const row of cleanRows(foodLogs)) {
    const date = localDate(row.local_date, row.timestamp ?? row.logged_at);
    if (!date || date < start || date > end) continue;
    logsByDate.set(date, [...(logsByDate.get(date) || []), row]);
  }
  const values = [];
  for (const [date, logs] of logsByDate) {
    const target = targetField(targetOn(targets, date), field);
    if (!target) continue;
    const amount = safeNumber(sumNutrition(logs)[field]);
    if (amount !== null) values.push({ date, amount, target });
  }
  return values;
}

function waterDays(waterLogs, targets, start, end) {
  const logsByDate = new Map();
  for (const row of cleanRows(waterLogs)) {
    const date = localDate(row.local_date, row.timestamp ?? row.logged_at);
    if (!date || date < start || date > end) continue;
    logsByDate.set(date, [...(logsByDate.get(date) || []), row]);
  }
  const values = [];
  for (const [date, logs] of logsByDate) {
    const target = targetField(targetOn(targets, date), 'water_ml');
    if (!target) continue;
    const amount = logs.reduce((sum, row) => sum + (safeNumber(row.amount_ml) || 0), 0);
    values.push({ date, amount, target });
  }
  return values;
}

function sleepDays(sleepLogs, targets, start, end) {
  const logsByDate = new Map();
  for (const row of cleanRows(sleepLogs)) {
    const date = localDate(row.local_date, row.sleep_end);
    const minutes = safeNumber(row.duration_minutes);
    if (!date || date < start || date > end || minutes === null || minutes <= 0) continue;
    logsByDate.set(date, [...(logsByDate.get(date) || []), row]);
  }
  const values = [];
  for (const [date, logs] of logsByDate) {
    const target = targetField(targetOn(targets, date), 'sleep_minutes');
    const amount = logs.reduce((sum, row) => sum + (safeNumber(row.duration_minutes) || 0), 0);
    values.push({ date, amount, target });
  }
  return values;
}

function intakeAverage(days) {
  return {
    average: avg(days.map(day => day.amount)),
    target: avg(days.map(day => day.target)),
    days: days.length,
  };
}

function recentDays(today, count) {
  return { start: shiftDate(today, -(count - 1)), end: today };
}

function weeklySessions(sessions, today, count = 7) {
  const { start, end } = recentDays(today, count);
  return cleanRows(sessions).filter(session => session.status === 'completed'
    && inRange(session.local_date, start, end));
}

function progressionCards(sessions, setLogs) {
  const records = flattenCompletedSets(sessions, setLogs);
  return groupExerciseSessions(records).flatMap(exercise => {
    const recommendation = progressionRecommendation(exercise.sessions);
    if (recommendation.status !== 'increase-load') return [];
    return [{
      id: `double-progression:${exercise.key}`,
      type: 'double-progression',
      fingerprint: `${recommendation.current_load_kg}:${recommendation.suggested_load_kg}:${recommendation.rep_max}:${recommendation.target_rir}`,
      exercise_name: exercise.name,
      recommendation,
    }];
  });
}

function performanceDropSignal(recentSessions, setLogs) {
  const completedIds = new Set(recentSessions.map(session => session.id));
  const setsBySession = new Map();
  for (const row of cleanRows(setLogs)) {
    if (!completedIds.has(row.session_id)) continue;
    const exerciseId = row.exercise_id || row.session_exercise_id || row.exercise_name_snapshot;
    if (!exerciseId) continue;
    const key = `${row.session_id}\u0000${exerciseId}`;
    setsBySession.set(key, [...(setsBySession.get(key) || []), row]);
  }
  const byExercise = new Map();
  for (const session of recentSessions) {
    const exerciseLabels = new Map();
    for (const row of cleanRows(setLogs)) {
      if (row.session_id !== session.id) continue;
      const exerciseId = row.exercise_id || row.session_exercise_id || row.exercise_name_snapshot;
      if (exerciseId && !exerciseLabels.has(exerciseId)) exerciseLabels.set(exerciseId, row.exercise_name_snapshot || String(exerciseId));
    }
    for (const [exerciseId, label] of exerciseLabels) {
      const sets = setsBySession.get(`${session.id}\u0000${exerciseId}`) || [];
      const reps = sets.map(row => safeNumber(row.reps)).filter(value => value !== null && value > 0);
      const e1rms = sets.flatMap(row => {
        const weight = safeNumber(row.weight_kg), count = safeNumber(row.reps);
        return weight > 0 && count > 0 && count <= 12 ? [weight * (1 + count / 30)] : [];
      });
      const byId = byExercise.get(exerciseId) || { label, sessions: [] };
      byId.sessions.push({ date: localDate(session.local_date, session.completed_at || session.started_at), completed_at: Number(session.completed_at || session.started_at || 0), best_e1rm: e1rms.length ? Math.max(...e1rms) : null, total_reps: reps.length ? reps.reduce((sum, value) => sum + value, 0) : null });
      byExercise.set(exerciseId, byId);
    }
  }
  for (const item of byExercise.values()) {
    item.sessions.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.completed_at - b.completed_at);
    if (item.sessions.length < 3) continue;
    const lastThree = item.sessions.slice(-3);
    const e1rmDrops = lastThree.every(row => row.best_e1rm !== null)
      && lastThree[1].best_e1rm < lastThree[0].best_e1rm
      && lastThree[2].best_e1rm < lastThree[1].best_e1rm;
    const repDrops = lastThree.every(row => row.total_reps !== null)
      && lastThree[1].total_reps < lastThree[0].total_reps
      && lastThree[2].total_reps < lastThree[1].total_reps;
    if (e1rmDrops || repDrops) return { exercise_name: item.label, sessions: lastThree, metric: e1rmDrops ? 'e1rm' : 'reps' };
  }
  return null;
}

const FATIGUE_TERMS = /\b(fatigue|fatigued|exhausted|overtrained|very tired|tired)\b|إرهاق|مرهق|مجهد|تعبان|إجهاد|تعب شديد/i;

function deloadSignal(sessions, setLogs, today) {
  const { start, end } = recentDays(today, COACH_THRESHOLDS.deloadLookbackDays);
  const recent = weeklySessions(sessions, today, COACH_THRESHOLDS.deloadLookbackDays)
    .filter(session => inRange(session.local_date, start, end));
  const recentIds = new Set(recent.map(session => session.id));
  const recentSets = cleanRows(setLogs).filter(row => recentIds.has(row.session_id));
  const rirZeroCount = recentSets.filter(row => safeNumber(row.rir) === 0).length;
  const fatigueNotes = recent.filter(session => typeof session.note === 'string' && FATIGUE_TERMS.test(session.note));
  const performanceDrop = performanceDropSignal(recent, recentSets);
  const signals = {
    performance_drop: performanceDrop,
    rir_zero_sets: rirZeroCount >= 3 ? rirZeroCount : 0,
    fatigue_note: fatigueNotes.length,
    // There is no sleep-flag field in the existing v4 sleep_logs schema, so this signal is intentionally not inferred.
    sleep_flag: false,
  };
  const count = Number(Boolean(signals.performance_drop)) + Number(signals.rir_zero_sets > 0) + Number(signals.fatigue_note > 0);
  return { signals, count, recent_sessions: recent.length };
}

export function evaluateCoachRules({ today, targets = [], goals = [], weightLogs = [], foodLogs = [], waterLogs = [], sleepLogs = [], sessions = [], setLogs = [] } = {}) {
  if (!ISO_DATE.test(today || '')) throw new TypeError('today must be a local YYYY-MM-DD date.');
  const cards = [];
  const goal = activeGoal(goals);
  if (goal && goal.goal_type !== 'maintain') {
    const targetRate = Math.abs(safeNumber(goal.target_rate_kg_per_week) || 0);
    const direction = goal.goal_type === 'gain' ? 1 : goal.goal_type === 'cut' ? -1 : 0;
    const trend = weightTrend(weightLogs, today);
    if (direction && targetRate > 0
      && trend.previous_logged_days >= COACH_THRESHOLDS.minimumWeightDaysPerWeek
      && trend.recent_logged_days >= COACH_THRESHOLDS.minimumWeightDaysPerWeek
      && trend.change_kg_per_week !== null
      && trend.change_kg_per_week * direction < targetRate * COACH_THRESHOLDS.weightTargetFraction) {
      cards.push({
        id: 'weight-stalled', type: 'weight-stalled', fingerprint: [trend.previous_average_kg, trend.recent_average_kg, targetRate].map(value => Number(value).toFixed(2)).join(':'),
        change_kg_per_week: trend.change_kg_per_week, target_rate_kg_per_week: targetRate, direction,
        previous_average_kg: trend.previous_average_kg, recent_average_kg: trend.recent_average_kg,
        threshold_kg_per_week: targetRate * COACH_THRESHOLDS.weightTargetFraction,
      });
    }
  }

  const { start, end } = recentDays(today, COACH_THRESHOLDS.intakeLookbackDays);
  const protein = intakeAverage(nutritionDays(foodLogs, targets, 'protein_g', start, end));
  if (protein.days >= COACH_THRESHOLDS.minimumIntakeDays && protein.average < protein.target * COACH_THRESHOLDS.intakeTargetFraction) {
    cards.push({ id: 'protein-low', type: 'protein-low', fingerprint: `${protein.average.toFixed(1)}:${protein.target.toFixed(1)}`, average_g: protein.average, target_g: protein.target, threshold_g: protein.target * COACH_THRESHOLDS.intakeTargetFraction, logged_days: protein.days });
  }
  const water = intakeAverage(waterDays(waterLogs, targets, start, end));
  if (water.days >= COACH_THRESHOLDS.minimumIntakeDays && water.average < water.target * COACH_THRESHOLDS.intakeTargetFraction) {
    cards.push({ id: 'water-low', type: 'water-low', fingerprint: `${water.average.toFixed(1)}:${water.target.toFixed(1)}`, average_ml: water.average, target_ml: water.target, threshold_ml: water.target * COACH_THRESHOLDS.intakeTargetFraction, logged_days: water.days });
  }
  const sleep = intakeAverage(sleepDays(sleepLogs, targets, start, end));
  const sleepTarget = sleep.target ?? COACH_THRESHOLDS.defaultSleepMinutes;
  if (sleep.days >= COACH_THRESHOLDS.minimumIntakeDays && sleep.average < sleepTarget) {
    cards.push({ id: 'sleep-low', type: 'sleep-low', fingerprint: `${sleep.average.toFixed(1)}:${sleepTarget.toFixed(1)}`, average_minutes: sleep.average, target_minutes: sleepTarget, uses_user_target: sleep.target !== null, logged_days: sleep.days });
  }

  const deload = deloadSignal(sessions, setLogs, today);
  if (deload.count >= 2) cards.push({ id: 'deload', type: 'deload', fingerprint: JSON.stringify({ count: deload.count, signals: deload.signals }), ...deload });
  cards.push(...progressionCards(sessions, setLogs));
  return cards;
}

export function filterActiveCoachCards(cards = [], state = {}, now = Date.now()) {
  const items = state?.items && typeof state.items === 'object' ? state.items : {};
  return (cards || []).filter(card => {
    const action = items[card.id];
    if (!action) return true;
    if (action.status === 'dismissed' && Number(action.dismissed_until) > now) return false;
    if (action.status === 'accepted' && action.fingerprint === card.fingerprint) return false;
    return true;
  });
}

function weeklyPersonalRecords(records, weekStart, weekEnd) {
  const before = records.filter(row => row.session_date < weekStart);
  const current = records.filter(row => row.session_date >= weekStart && row.session_date <= weekEnd).slice().sort((a, b) => a.session_date.localeCompare(b.session_date) || a.session_completed_at - b.session_completed_at || (a.set_number || 0) - (b.set_number || 0));
  const best = new Map();
  const addPrior = row => {
    const item = best.get(row.exercise_key) || { name: row.exercise_name, load: 0, reps: 0, e1rm: 0 };
    if (row.is_loaded_set) {
      item.load = Math.max(item.load, row.weight_kg || 0);
      item.reps = Math.max(item.reps, row.reps || 0);
      item.e1rm = Math.max(item.e1rm, row.e1rm_kg || 0);
    }
    best.set(row.exercise_key, item);
  };
  before.forEach(addPrior);
  const events = new Map();
  for (const row of current) {
    if (!row.is_loaded_set) continue;
    const item = best.get(row.exercise_key) || { name: row.exercise_name, load: 0, reps: 0, e1rm: 0 };
    item.name = row.exercise_name || item.name;
    const types = [];
    if (row.weight_kg > item.load) { item.load = row.weight_kg; types.push('max weight'); }
    if (row.reps > item.reps) { item.reps = row.reps; types.push('max reps'); }
    if (row.e1rm_kg && row.e1rm_kg > item.e1rm) { item.e1rm = row.e1rm_kg; types.push('e1RM'); }
    if (types.length) events.set(`${row.exercise_key}`, { name: item.name, types: [...new Set([...(events.get(row.exercise_key)?.types || []), ...types])] });
    best.set(row.exercise_key, item);
  }
  return [...events.values()];
}

function reportAverage(values, locale) {
  if (values === null || values === undefined || !Number.isFinite(Number(values))) return locale === 'ar' ? 'بيانات غير كافية' : 'Not enough data';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits: 1 }).format(Number(values));
}

function nutritionReportAverage(foodLogs, start, end) {
  const byDate = new Map();
  for (const row of cleanRows(foodLogs)) {
    const date = localDate(row.local_date, row.timestamp ?? row.logged_at);
    if (!date || date < start || date > end) continue;
    byDate.set(date, [...(byDate.get(date) || []), row]);
  }
  return avg([...byDate.values()].map(rows => sumNutrition(rows).protein_g));
}

function waterReportAverage(waterLogs, start, end) {
  const byDate = new Map();
  for (const row of cleanRows(waterLogs)) {
    const date = localDate(row.local_date, row.timestamp ?? row.logged_at);
    if (!date || date < start || date > end) continue;
    byDate.set(date, (byDate.get(date) || 0) + (safeNumber(row.amount_ml) || 0));
  }
  return avg([...byDate.values()]);
}

export function buildWeeklyReport({ today, language = 'en', targets = [], goals = [], weightLogs = [], foodLogs = [], waterLogs = [], sleepLogs = [], sessions = [], setLogs = [], activeCards = [] } = {}) {
  if (!ISO_DATE.test(today || '')) throw new TypeError('today must be a local YYYY-MM-DD date.');
  const lang = language === 'ar' ? 'ar' : 'en';
  const week = recentDays(today, 7);
  const previousWeek = { start: shiftDate(today, -13), end: shiftDate(today, -7) };
  const latest = weightAverage(weightLogs, week.start, week.end);
  const previous = weightAverage(weightLogs, previousWeek.start, previousWeek.end);
  const weightChange = latest.average === null || previous.average === null ? null : latest.average - previous.average;
  const workoutRows = weeklySessions(sessions, today);
  const allCompletedSets = flattenCompletedSets(sessions, setLogs);
  const completedSets = allCompletedSets.filter(row => row.session_date >= week.start && row.session_date <= week.end);
  const volume = completedSets.reduce((sum, row) => sum + (Number(row.volume_kg_reps) || 0), 0);
  const prs = weeklyPersonalRecords(allCompletedSets, week.start, week.end);
  const proteinAvg = nutritionReportAverage(foodLogs, week.start, week.end);
  const waterAvg = waterReportAverage(waterLogs, week.start, week.end);
  const sleep = sleepDays(sleepLogs, [], week.start, week.end);
  const sleepAvg = avg(sleep.map(day => day.amount));
  const sections = lang === 'ar' ? {
    title: 'التقرير الأسبوعي · آخر 7 أيام', weight: 'متوسط الوزن', change: 'التغير مقارنة بالأسبوع السابق', workouts: 'التمارين المكتملة', volume: 'الحجم المسجل (كجم × تكرار)', prs: 'الأرقام القياسية الجديدة', protein: 'متوسط البروتين', water: 'متوسط الماء', sleep: 'متوسط النوم', cards: 'بطاقات المدرب النشطة', none: 'لا يوجد', noPrs: 'لم يتم تسجيل رقم قياسي جديد', noCards: 'لا توجد بطاقات نشطة', kg: 'كجم', perWeek: 'كجم/أسبوع', grams: 'جم/يوم', ml: 'مل/يوم', hours: 'س/يوم', sessions: 'جلسة',
  } : {
    title: 'Weekly report · last 7 days', weight: 'Average weight', change: 'Change vs previous week', workouts: 'Completed workouts', volume: 'Logged volume (kg × reps)', prs: 'New personal records', protein: 'Average protein', water: 'Average water', sleep: 'Average sleep', cards: 'Active coach cards', none: 'None', noPrs: 'No new PR recorded', noCards: 'No active cards', kg: 'kg', perWeek: 'kg/week', grams: 'g/day', ml: 'ml/day', hours: 'h/day', sessions: 'sessions',
  };
  const prText = prs.length ? prs.map(record => `${record.name}: ${record.types.join(', ')}`).join('; ') : sections.noPrs;
  const cardText = activeCards.length ? activeCards.map(card => `${card.title}: ${card.reason}`).join('\n  - ') : sections.noCards;
  const dateText = `${week.start} — ${week.end}`;
  const lines = [
    sections.title,
    dateText,
    `${sections.weight}: ${reportAverage(latest.average, lang)} ${sections.kg} (${latest.loggedDays} ${lang === 'ar' ? 'أيام بها سجلات' : 'logged days'})`,
    `${sections.change}: ${weightChange === null ? (lang === 'ar' ? 'بيانات غير كافية' : 'Not enough data') : `${weightChange > 0 ? '+' : ''}${reportAverage(weightChange, lang)} ${sections.perWeek}`}`,
    `${sections.workouts}: ${workoutRows.length} ${sections.sessions}`,
    `${sections.volume}: ${reportAverage(volume, lang)}`,
    `${sections.prs}: ${prText}`,
    `${sections.protein}: ${reportAverage(proteinAvg, lang)} ${sections.grams}`,
    `${sections.water}: ${reportAverage(waterAvg, lang)} ${sections.ml}`,
    `${sections.sleep}: ${reportAverage(sleepAvg === null ? null : sleepAvg / 60, lang)} ${sections.hours}`,
    `${sections.cards}: ${activeCards.length ? `\n  - ${cardText}` : sections.noCards}`,
  ];
  return lines.join('\n');
}
