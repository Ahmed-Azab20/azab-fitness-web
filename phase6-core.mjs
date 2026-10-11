export const SYNC_STORES = Object.freeze([
  'profile', 'settings', 'goals', 'daily_targets', 'weight_logs',
  'workout_sessions', 'set_logs', 'programs', 'program_days',
  'exercises', 'program_exercises', 'foods', 'food_logs', 'saved_meals',
  'saved_meal_items', 'water_logs', 'sleep_logs', 'measurements',
]);

export const DB_VERSION = 5;
export const SYNC_QUEUE_KEY = 'azab-firebase-sync-queue';
export const REDIRECT_PENDING_KEY = 'phase6_redirect_pending';
export const BACKFILL_SETTING_KEY = 'phase6_backfill_v5';
export const EXCLUDED_SETTING_KEYS = Object.freeze([
  'phase5_coach_state', REDIRECT_PENDING_KEY, BACKFILL_SETTING_KEY,
]);
export const MAX_FIRESTORE_BATCH_WRITES = 500;
// Conservative UTF-8 JSON ceiling; leaves room below Firestore's 1 MiB document limit.
export const MAX_FIRESTORE_DOCUMENT_BYTES = 900 * 1024;

const storeSet = new Set(SYNC_STORES);
const excludedSettingKeys = new Set(EXCLUDED_SETTING_KEYS);
const queueKey = item => `${item.storeName}\u0000${item.recordId}`;

export function missingUpdatedAt(row) {
  return row?.updated_at === undefined || row?.updated_at === null;
}

export function backfillUpdatedAt(row, migrationTime) {
  return missingUpdatedAt(row) ? { ...row, updated_at: migrationTime } : row;
}

export function canonicalSingletonId(storeName, row) {
  if (!row || row.deleted_at || row.deletedAt) return null;
  if (storeName === 'profile') return 'profile';
  if (storeName === 'settings' && typeof row.key === 'string' && row.key) return `settings:${row.key}`;
  if (storeName === 'goals' && row.status === 'active') return 'goal:active';
  if (storeName === 'daily_targets' && typeof row.effective_from === 'string' && row.effective_from) return `daily-target:${row.effective_from}`;
  if (storeName === 'programs' && row.is_active) return 'program:active';
  return null;
}

function epoch(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(item => item === undefined ? null : stripUndefined(item));
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) result[key] = stripUndefined(item);
  }
  return result;
}

export function toFirestoreRecord(row) {
  const updatedAt = epoch(row.updated_at ?? row.updatedAt ?? row.created_at, 0);
  const deletedValue = row.deleted_at ?? row.deletedAt ?? null;
  const deletedAt = deletedValue === null ? null : epoch(deletedValue, null);
  return stripUndefined({ ...row, updatedAt, deletedAt });
}

export function fromFirestoreRecord(record, documentId = record?.id) {
  const source = record || {};
  const { updatedAt, deletedAt, ...fields } = source;
  const updated = epoch(updatedAt ?? fields.updated_at ?? fields.created_at, 0);
  const deletedValue = Object.hasOwn(source, 'deletedAt') ? deletedAt : (fields.deleted_at ?? null);
  const deleted = deletedValue === null || deletedValue === undefined ? null : epoch(deletedValue, null);
  return { ...fields, id: documentId || fields.id, updated_at: updated, deleted_at: deleted };
}

function recordTime(row) {
  return epoch(row?.updatedAt ?? row?.updated_at ?? row?.created_at, 0);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
}

function stableHash(value) {
  const text = JSON.stringify(canonical(value));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function sameRecord(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

export function migrationConflictId(storeName, canonicalId, row) {
  return `sync-conflict:${storeName}:${canonicalId}:${stableHash(row)}`;
}

export function normalizeSingletonRows(storeName, rows, migrationTime) {
  const output = new Map((rows || []).map(row => [row.id, { ...row }]));
  const groups = new Map();
  for (const row of rows || []) {
    const canonicalId = canonicalSingletonId(storeName, row);
    if (!canonicalId) continue;
    if (!groups.has(canonicalId)) groups.set(canonicalId, []);
    groups.get(canonicalId).push(row);
  }
  const rekeyed = {};
  for (const [canonicalId, candidates] of groups) {
    const ordered = [...candidates].sort((left, right) => recordTime(right) - recordTime(left) || String(left.id).localeCompare(String(right.id)));
    const winner = ordered[0];
    const canonicalRow = { ...winner, id: canonicalId };
    output.set(canonicalId, canonicalRow);
    if (winner.id !== canonicalId) {
      output.set(winner.id, { ...winner, deleted_at: migrationTime, updated_at: migrationTime });
      if (storeName === 'programs') rekeyed[winner.id] = canonicalId;
    }
    for (const loser of ordered.slice(1)) {
      const tombstoneId = loser.id === canonicalId ? migrationConflictId(storeName, canonicalId, loser) : loser.id;
      output.set(tombstoneId, { ...loser, id: tombstoneId, deleted_at: migrationTime, updated_at: migrationTime });
    }
  }
  return { rows: [...output.values()], rekeyedProgramIds: rekeyed };
}

export function isSyncableRecord(storeName, row) {
  if (!storeSet.has(storeName) || !row?.id) return false;
  return !(storeName === 'settings' && excludedSettingKeys.has(row.key));
}

export function serializedFirestoreDocumentBytes(row) {
  const json = JSON.stringify(row);
  if (typeof json !== 'string') throw new TypeError('Firestore document is not JSON-serializable.');
  return new TextEncoder().encode(json).byteLength;
}

export function chunkFirestoreWrites(writes, maxWrites = MAX_FIRESTORE_BATCH_WRITES) {
  if (!Number.isInteger(maxWrites) || maxWrites < 1 || maxWrites > MAX_FIRESTORE_BATCH_WRITES) {
    throw new RangeError(`Firestore batches must contain between 1 and ${MAX_FIRESTORE_BATCH_WRITES} writes.`);
  }
  const chunks = [];
  let current = [];
  for (const write of writes || []) {
    const bytes = serializedFirestoreDocumentBytes(write.data);
    if (bytes >= MAX_FIRESTORE_DOCUMENT_BYTES) {
      throw new RangeError(`Firestore document is ${bytes} bytes; the safe limit is 900 KiB, below 1 MiB.`);
    }
    current.push(write);
    if (current.length === maxWrites) { chunks.push(current); current = []; }
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function singletonGroups(storeName, localRows, remoteRows) {
  const groups = new Map();
  for (const [source, rows] of [['local', localRows], ['remote', remoteRows]]) {
    for (const row of rows || []) {
      const canonicalId = canonicalSingletonId(storeName, row);
      if (!canonicalId || !isSyncableRecord(storeName, row)) continue;
      if (!groups.has(canonicalId)) groups.set(canonicalId, { canonicalId, local: [], remote: [] });
      groups.get(canonicalId)[source].push(row);
    }
  }
  return groups;
}

function winnerOf(group) {
  return [
    ...group.local.map(row => ({ row, source: 'local' })),
    ...group.remote.map(row => ({ row, source: 'remote' })),
  ].sort((left, right) => recordTime(right.row) - recordTime(left.row)
    || (left.source === right.source ? 0 : left.source === 'local' ? -1 : 1)
    || String(left.row.id).localeCompare(String(right.row.id)))[0];
}

function getSingletonConflicts(stores) {
  const conflicts = [];
  for (const [storeName, group] of Object.entries(stores)) {
    for (const slot of singletonGroups(storeName, group.local, group.remote).values()) {
      if (slot.local.length && slot.remote.length || slot.local.length > 1 || slot.remote.length > 1) {
        const winner = winnerOf(slot);
        conflicts.push({
          storeName, canonicalId: slot.canonicalId,
          localIds: slot.local.map(row => row.id), remoteIds: slot.remote.map(row => row.id),
          winner: winner.source, winnerUpdatedAt: recordTime(winner.row),
        });
      }
    }
  }
  return conflicts;
}

export function needsFirstMergeConfirmation(snapshot) {
  return Number(snapshot?.localCount) > 0 || Number(snapshot?.remoteCount) > 0
    || Number(snapshot?.backfilled?.length) > 0 || Number(snapshot?.singletonConflicts?.length) > 0;
}

export function createSyncQueue(storage, now = () => Date.now()) {
  const read = () => {
    try {
      const parsed = JSON.parse(storage?.getItem(SYNC_QUEUE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(item =>
        item && storeSet.has(item.storeName) && typeof item.recordId === 'string' && item.recordId,
      ) : [];
    } catch { return []; }
  };
  const write = entries => {
    try {
      if (!storage) return;
      if (entries.length) storage.setItem(SYNC_QUEUE_KEY, JSON.stringify(entries));
      else storage.removeItem(SYNC_QUEUE_KEY);
    } catch { /* The IndexedDB row remains durable and is reconciled on the next sync. */ }
  };
  return {
    list: read,
    count: () => read().length,
    enqueue(storeName, row) {
      if (!isSyncableRecord(storeName, row)) return;
      const entries = read();
      const key = `${storeName}\u0000${row.id}`;
      const previous = entries.find(item => queueKey(item) === key);
      const generation = Math.max(Number(now()) || 0, Number(previous?.generation || 0) + 1);
      const next = entries.filter(item => queueKey(item) !== key);
      next.push({ storeName, recordId: row.id, updatedAt: recordTime(row), generation });
      write(next);
    },
    clearCovered(snapshot) {
      const covered = new Map((snapshot || []).map(item => [queueKey(item), item.generation]));
      write(read().filter(item => !covered.has(queueKey(item)) || covered.get(queueKey(item)) !== item.generation));
    },
  };
}

export async function inspectSyncData({ uid, local, remote, stores = SYNC_STORES, backfilledRows = [] }) {
  const byStore = {};
  let localCount = 0;
  let remoteCount = 0;
  for (const storeName of stores) {
    if (!storeSet.has(storeName)) throw new Error(`Unsupported sync store: ${storeName}`);
    const [localRows, remoteRows] = await Promise.all([local.list(storeName), remote.list(uid, storeName)]);
    const safeLocal = (localRows || []).filter(row => isSyncableRecord(storeName, row));
    const safeRemote = (remoteRows || []).map(row => fromFirestoreRecord(row, row.id)).filter(row => isSyncableRecord(storeName, row));
    byStore[storeName] = { local: safeLocal, remote: safeRemote };
    localCount += safeLocal.length;
    remoteCount += safeRemote.length;
  }
  const presentBackfills = [];
  for (const storeName of new Set((backfilledRows || []).map(row => row.storeName))) {
    const rows = byStore[storeName]?.local || await local.list(storeName);
    const pointers = (backfilledRows || []).filter(row => row.storeName === storeName);
    for (const pointer of pointers) {
      if (rows.some(row => row.id === pointer.recordId)) presentBackfills.push({ ...pointer, localOnly: !storeSet.has(storeName) });
    }
  }
  const backfilledByStore = Object.fromEntries([...new Set([...stores, ...presentBackfills.map(row => row.storeName)])]
    .map(name => [name, presentBackfills.filter(row => row.storeName === name)]));
  return {
    uid, stores: byStore, localCount, remoteCount,
    backfilled: presentBackfills, backfilledByStore,
    singletonConflicts: getSingletonConflicts(byStore),
  };
}

export async function applySyncSnapshot({ snapshot, uid = snapshot?.uid, local, remote, stores = SYNC_STORES, now = () => Date.now() }) {
  if (!snapshot || snapshot.uid !== uid) throw new Error('Sync snapshot user mismatch');
  const totals = { uploaded: 0, downloaded: 0, localWins: 0, remoteWins: 0, unchanged: 0, softDeleted: 0 };
  const remotePending = new Map();
  const queueRemote = (storeName, recordId, row) => {
    remotePending.set(`${storeName}\u0000${recordId}`, { storeName, recordId, data: toFirestoreRecord(row) });
  };
  const putLocalIfChanged = async (storeName, row, existingRows) => {
    const existing = (existingRows || []).find(item => item.id === row.id);
    if (existing && sameRecord(existing, row)) return false;
    await local.put(storeName, row);
    totals.downloaded++;
    return true;
  };

  for (const storeName of stores) {
    if (!storeSet.has(storeName)) throw new Error(`Unsupported sync store: ${storeName}`);
    const group = snapshot.stores?.[storeName] || { local: [], remote: [] };
    const localRows = group.local.filter(row => isSyncableRecord(storeName, row));
    const remoteRows = group.remote.filter(row => isSyncableRecord(storeName, row));
    const processedSingletonIds = new Set();

    for (const slot of singletonGroups(storeName, localRows, remoteRows).values()) {
      const winner = winnerOf(slot);
      if (!winner) continue;
      for (const row of [...slot.local, ...slot.remote]) processedSingletonIds.add(row.id);
      if (slot.local.length && slot.remote.length) {
        if (winner.source === 'local') totals.localWins++;
        else totals.remoteWins++;
      }
      const winningRow = { ...winner.row, id: slot.canonicalId, deleted_at: null };
      const allCandidates = [
        ...slot.local.map(row => ({ row, source: 'local' })),
        ...slot.remote.map(row => ({ row, source: 'remote' })),
      ];
      const tombstones = new Map();
      for (const candidate of allCandidates) {
        const sameAsWinner = sameRecord(candidate.row, winner.row);
        const needsAliasTombstone = candidate.row.id !== slot.canonicalId;
        if (!needsAliasTombstone && (candidate === winner || sameAsWinner)) continue;
        if (!needsAliasTombstone && !sameAsWinner) {
          const id = migrationConflictId(storeName, slot.canonicalId, candidate.row);
          tombstones.set(id, { ...candidate.row, id });
        } else {
          tombstones.set(candidate.row.id, candidate.row);
        }
      }
      if (!tombstones.size && slot.local.length && slot.remote.length
        && sameRecord(slot.local[0], slot.remote[0])) totals.unchanged++;
      await putLocalIfChanged(storeName, winningRow, localRows);
      const remoteCanonical = remoteRows.find(row => row.id === slot.canonicalId);
      if (!remoteCanonical || !sameRecord(toFirestoreRecord(remoteCanonical), toFirestoreRecord(winningRow))) {
        queueRemote(storeName, slot.canonicalId, winningRow);
      }
      for (const [id, row] of tombstones) {
        const time = Math.max(Number(now()) || 0, recordTime(row), recordTime(winner.row));
        const tombstone = { ...row, id, deleted_at: time, updated_at: time };
        await putLocalIfChanged(storeName, tombstone, localRows);
        const remoteTombstone = remoteRows.find(item => item.id === id);
        if (!remoteTombstone || !sameRecord(toFirestoreRecord(remoteTombstone), toFirestoreRecord(tombstone))) {
          queueRemote(storeName, id, tombstone);
        }
        totals.softDeleted++;
      }
    }

    const localById = new Map(localRows.filter(row => !processedSingletonIds.has(row.id)).map(row => [row.id, row]));
    const remoteById = new Map(remoteRows.filter(row => !processedSingletonIds.has(row.id)).map(row => [row.id, row]));
    const ids = new Set([...localById.keys(), ...remoteById.keys()]);
    for (const id of ids) {
      const localRow = localById.get(id);
      const remoteRow = remoteById.get(id);
      if (localRow && !remoteRow) {
        queueRemote(storeName, id, localRow);
        continue;
      }
      if (!localRow && remoteRow) {
        await putLocalIfChanged(storeName, fromFirestoreRecord(remoteRow, id), localRows);
        continue;
      }
      if (!localRow || !remoteRow) continue;
      if (recordTime(localRow) >= recordTime(remoteRow)) {
        totals.localWins++;
        if (sameRecord(toFirestoreRecord(localRow), toFirestoreRecord(remoteRow))) totals.unchanged++;
        else queueRemote(storeName, id, localRow);
      } else {
        totals.remoteWins++;
        if (sameRecord(localRow, fromFirestoreRecord(remoteRow, id))) totals.unchanged++;
        else await putLocalIfChanged(storeName, fromFirestoreRecord(remoteRow, id), localRows);
      }
    }
  }

  const writes = [...remotePending.values()];
  const batches = chunkFirestoreWrites(writes);
  for (const batch of batches) {
    if (typeof remote.putMany === 'function') await remote.putMany(uid, batch);
    else for (const item of batch) await remote.put(uid, item.storeName, item.recordId, item.data);
  }
  totals.uploaded = writes.length;
  return totals;
}

export async function synchronizeAll({ uid, local, remote, stores = SYNC_STORES }) {
  const snapshot = await inspectSyncData({ uid, local, remote, stores });
  return applySyncSnapshot({ snapshot, uid, local, remote, stores });
}

export async function flushQueuedSync({ uid, local, remote, queue, stores = SYNC_STORES }) {
  const queuedAtStart = queue.list();
  const result = await synchronizeAll({ uid, local, remote, stores });
  queue.clearCovered(queuedAtStart);
  return { ...result, flushed: queuedAtStart.length };
}
