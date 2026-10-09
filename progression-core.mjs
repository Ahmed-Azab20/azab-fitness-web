const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validLocalDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function localDateFromEpoch(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const date = new Date(parsed);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function snapshotForSet(session, set) {
  const exercises = Array.isArray(session.exercises) ? session.exercises : [];
  if (set.session_exercise_id) {
    const sessionMatch = exercises.find(item => item.id === set.session_exercise_id);
    if (sessionMatch) return sessionMatch;
  }
  if (set.exercise_id) {
    return exercises.find(item => item.exercise_id === set.exercise_id || item.id === set.exercise_id) || null;
  }
  return null;
}

function targetFor(snapshot) {
  return {
    target_sets: numberOrNull(snapshot?.target_sets),
    rep_min: numberOrNull(snapshot?.rep_min),
    rep_max: numberOrNull(snapshot?.rep_max),
    target_rir: numberOrNull(snapshot?.target_rir),
  };
}

function normalizedName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function periodStart(dateValue, mode) {
  if (!validLocalDate(dateValue)) return null;
  const date = new Date(`${dateValue}T12:00:00Z`);
  if (mode === 'month') {
    date.setUTCDate(1);
    return date.toISOString().slice(0, 10);
  }
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

function periodKey(dateValue, mode) {
  const start = periodStart(dateValue, mode);
  return start ? (mode === 'month' ? start.slice(0, 7) : start) : null;
}

function shiftPeriod(dateValue, mode, offset) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  if (mode === 'month') date.setUTCMonth(date.getUTCMonth() + offset);
  else date.setUTCDate(date.getUTCDate() + 7 * offset);
  return date.toISOString().slice(0, 10);
}

function localToday() {
  return localDateFromEpoch(Date.now());
}

/**
 * Return only set logs belonging to completed, non-deleted workout sessions.
 * Set rows are retained even if an input is blank so progression advice can
 * distinguish incomplete logging from a completed working set.
 */
export function flattenCompletedSets(workoutSessions = [], setLogs = []) {
  const completed = new Map((workoutSessions || [])
    .filter(session => session && !session.deleted_at && session.status === 'completed' && session.id)
    .map(session => [session.id, session]));
  const result = [];

  for (const set of setLogs || []) {
    if (!set || set.deleted_at || !set.session_id) continue;
    const session = completed.get(set.session_id);
    if (!session) continue;
    const snapshot = snapshotForSet(session, set);
    const exerciseId = set.exercise_id || snapshot?.exercise_id || null;
    const name = String(set.exercise_name_snapshot || snapshot?.name || (exerciseId ? `Exercise ${exerciseId}` : '')).trim();
    const fallbackName = normalizedName(name);
    if (!exerciseId && !fallbackName) continue;

    const date = validLocalDate(set.local_date) ? set.local_date
      : validLocalDate(session.local_date) ? session.local_date
        : localDateFromEpoch(session.completed_at || session.started_at);
    if (!date) continue;

    const weight = numberOrNull(set.weight_kg);
    const reps = numberOrNull(set.reps);
    const rir = numberOrNull(set.rir);
    const hasLoadedReps = weight !== null && weight > 0 && reps !== null && reps > 0;
    const volume = hasLoadedReps ? weight * reps : 0;
    const e1rm = hasLoadedReps && reps <= 12 ? weight * (1 + reps / 30) : null;
    const plan = targetFor(snapshot);

    result.push({
      exercise_key: exerciseId ? `id:${exerciseId}` : `name:${fallbackName}`,
      exercise_id: exerciseId,
      exercise_name: name,
      session_id: session.id,
      session_date: date,
      session_completed_at: numberOrNull(session.completed_at) || numberOrNull(session.started_at) || 0,
      session_exercise_id: set.session_exercise_id || snapshot?.id || null,
      set_id: set.id || null,
      set_number: numberOrNull(set.set_number),
      weight_kg: weight,
      reps,
      rir,
      is_loaded_set: hasLoadedReps,
      volume_kg_reps: volume,
      e1rm_kg: e1rm,
      ...plan,
    });
  }

  return result.sort((a, b) => a.session_date.localeCompare(b.session_date)
    || a.session_completed_at - b.session_completed_at
    || (a.set_number || 0) - (b.set_number || 0));
}

/** Group flat set records by stable exercise identity and workout session. */
export function groupExerciseSessions(records = []) {
  const exercises = new Map();
  for (const record of records || []) {
    if (!record?.exercise_key || !record.session_id) continue;
    let exercise = exercises.get(record.exercise_key);
    if (!exercise) {
      exercise = { key: record.exercise_key, exercise_id: record.exercise_id || null, name: record.exercise_name || '', sessions: [] };
      exercises.set(record.exercise_key, exercise);
    }
    if (record.exercise_name) exercise.name = record.exercise_name;
    let session = exercise.sessions.find(item => item.session_id === record.session_id);
    if (!session) {
      session = {
        session_id: record.session_id,
        date: record.session_date,
        completed_at: record.session_completed_at,
        target_sets: record.target_sets,
        rep_min: record.rep_min,
        rep_max: record.rep_max,
        target_rir: record.target_rir,
        sets: [],
      };
      exercise.sessions.push(session);
    }
    session.sets.push(record);
  }

  return [...exercises.values()]
    .map(exercise => ({
      ...exercise,
      sessions: exercise.sessions.sort((a, b) => a.date.localeCompare(b.date) || a.completed_at - b.completed_at),
      records: (records || []).filter(record => record.exercise_key === exercise.key),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** Lifetime bests; e1RM is Epley and deliberately limited to 1–12 reps. */
export function personalRecords(records = []) {
  const loaded = (records || []).filter(record => record?.is_loaded_set
    && Number.isFinite(record.weight_kg) && record.weight_kg > 0
    && Number.isFinite(record.reps) && record.reps > 0);
  const bestLoad = loaded.slice().sort((a, b) => b.weight_kg - a.weight_kg || b.reps - a.reps)[0] || null;
  const bestReps = loaded.slice().sort((a, b) => b.reps - a.reps || b.weight_kg - a.weight_kg)[0] || null;
  const estimates = loaded.filter(record => record.reps <= 12 && Number.isFinite(record.e1rm_kg));
  const bestE1rm = estimates.sort((a, b) => b.e1rm_kg - a.e1rm_kg || b.weight_kg - a.weight_kg)[0] || null;
  return {
    best_load: bestLoad ? { value_kg: bestLoad.weight_kg, reps: bestLoad.reps, date: bestLoad.session_date } : null,
    best_reps: bestReps ? { reps: bestReps.reps, value_kg: bestReps.weight_kg, date: bestReps.session_date } : null,
    best_e1rm: bestE1rm ? { value_kg: bestE1rm.e1rm_kg, load_kg: bestE1rm.weight_kg, reps: bestE1rm.reps, date: bestE1rm.session_date } : null,
  };
}

/** Build zero-filled weekly or monthly loaded-volume periods. */
export function aggregatePeriodVolume(records = [], { mode = 'week', count, anchorDate = localToday() } = {}) {
  const selectedMode = mode === 'month' ? 'month' : 'week';
  const periodCount = Math.min(24, Math.max(1, Math.trunc(Number(count) || (selectedMode === 'month' ? 6 : 8))));
  const anchor = validLocalDate(anchorDate) ? anchorDate : localToday();
  const anchorStart = periodStart(anchor, selectedMode);
  const totals = new Map();
  for (const record of records || []) {
    const key = periodKey(record?.session_date, selectedMode);
    if (!key) continue;
    const prior = totals.get(key) || { volume_kg_reps: 0, set_count: 0, session_ids: new Set() };
    prior.volume_kg_reps += Number(record.volume_kg_reps) || 0;
    if (record.is_loaded_set) prior.set_count += 1;
    if (record.session_id) prior.session_ids.add(record.session_id);
    totals.set(key, prior);
  }

  return Array.from({ length: periodCount }, (_, index) => {
    const start = shiftPeriod(anchorStart, selectedMode, index - periodCount + 1);
    const key = selectedMode === 'month' ? start.slice(0, 7) : start;
    const total = totals.get(key);
    return {
      key,
      start_date: start,
      volume_kg_reps: total?.volume_kg_reps || 0,
      set_count: total?.set_count || 0,
      session_count: total?.session_ids.size || 0,
    };
  });
}

/**
 * Conservative double-progression prompt for the most recent exercise session.
 * It never writes to the plan or workout records.
 */
export function progressionRecommendation(sessions = []) {
  const latest = (sessions || []).slice().sort((a, b) => a.date.localeCompare(b.date) || a.completed_at - b.completed_at).at(-1);
  if (!latest) return { status: 'no-history' };

  const targetSets = numberOrNull(latest.target_sets);
  const repMin = numberOrNull(latest.rep_min);
  const repMax = numberOrNull(latest.rep_max);
  const targetRir = numberOrNull(latest.target_rir);
  if (!(targetSets > 0 && repMin > 0 && repMax >= repMin)) return { status: 'missing-plan' };
  if (!(targetRir !== null && targetRir >= 0 && targetRir <= 10)) return { status: 'missing-target-rir', target_sets: targetSets };

  const sets = Array.isArray(latest.sets) ? latest.sets : [];
  if (sets.length < targetSets) return { status: 'more-sets-needed', target_sets: targetSets, logged_sets: sets.length };
  const complete = sets.filter(set => set.weight_kg !== null && set.weight_kg > 0
    && set.reps !== null && set.reps > 0);
  if (complete.length !== sets.length || complete.length < targetSets) {
    return { status: 'incomplete-set-data', target_sets: targetSets, logged_sets: sets.length };
  }
  if (complete.some(set => set.rir === null || set.rir < 0 || set.rir > 10)) {
    return { status: 'missing-rir', target_sets: targetSets };
  }

  const currentLoad = Math.max(...complete.map(set => set.weight_kg));
  if (complete.some(set => set.reps < repMin)) {
    return { status: 'build-reps', current_load_kg: currentLoad, rep_min: repMin, rep_max: repMax };
  }
  if (complete.some(set => set.reps < repMax)) {
    return { status: 'hold-load', current_load_kg: currentLoad, rep_min: repMin, rep_max: repMax };
  }
  if (complete.some(set => set.rir < targetRir)) {
    return { status: 'hold-rir', current_load_kg: currentLoad, target_rir: targetRir };
  }

  const increment = Math.max(0.5, Math.round((currentLoad * 0.025) / 0.5) * 0.5);
  const suggestedLoad = Math.round((currentLoad + increment) * 10) / 10;
  return {
    status: 'increase-load',
    current_load_kg: currentLoad,
    suggested_load_kg: suggestedLoad,
    increase_kg: Math.round((suggestedLoad - currentLoad) * 10) / 10,
    target_sets: targetSets,
    rep_min: repMin,
    rep_max: repMax,
    target_rir: targetRir,
  };
}
