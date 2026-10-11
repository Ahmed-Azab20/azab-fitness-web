import {
  BACKFILL_SETTING_KEY,
  DB_VERSION,
  REDIRECT_PENDING_KEY,
  SYNC_STORES,
  applySyncSnapshot,
  chunkFirestoreWrites,
  createSyncQueue,
  flushQueuedSync,
  inspectSyncData,
  needsFirstMergeConfirmation,
} from './phase6-core.mjs';

export const FIREBASE_SDK_VERSION = '12.19.0';
const FIREBASE_CONFIG = Object.freeze({
  apiKey: 'AIzaSyBc1o7l6WxUATbGYBIbB641XV76lpGxtQk',
  authDomain: 'azab-fitness.firebaseapp.com',
  projectId: 'azab-fitness',
  storageBucket: 'azab-fitness.firebasestorage.app',
  messagingSenderId: '1097873060191',
  appId: '1:1097873060191:web:2b011791f2511005bf46ea',
});
const FIRST_SYNC_PREFIX = 'azab-firebase-first-sync:';
const LAST_SYNC_PREFIX = 'azab-firebase-last-sync:';
const copy = {
  en: {
    title: 'Settings', subtitle: 'Optional cloud sync', panelTitle: 'Firebase sync',
    intro: 'Your data stays on this device unless you sign in with Google. Firebase is an opt-in sync mirror; it never blocks offline use.',
    tab: 'Settings', signIn: 'Sign in with Google', signOut: 'Sign out', syncNow: 'Sync now',
    signedOut: 'Signed out — no data is being uploaded.', signingIn: 'Connecting to Google…',
    syncing: 'Syncing your records…', synced: 'Synced · {time}',
    offline: 'Offline — local changes are saved and will sync when you reconnect.',
    error: 'Sync error: {detail}', mergeCancelled: 'Merge cancelled. No records were changed.',
    photos: 'Progress photos stay on this device and are not synced.',
    mergeTitle: 'Confirm first sync',
    mergeBody: 'Found {local} local records and {remote} cloud records. Review the account, per-store counts, timestamp backfills, and singleton conflicts below before continuing. Newer updated_at wins; local wins ties. Conflicting singleton rows are retained as soft-deleted records; nothing is hard-deleted.',
    mergeAccount: 'Google account: {email}', emailUnavailable: 'email unavailable',
    countsHeading: 'Per-store records (local · cloud · backfilled timestamps):',
    countLine: '{store}: {local} · {remote} · {backfilled}',
    backfilledHeading: 'Rows stamped by the v5 migration (store: record IDs):',
    backfilledLine: '{store}: {ids}{localOnly}', localOnly: ' (local-only; not synced)',
    singletonHeading: 'Singleton conflicts (winner kept; other copy soft-deleted):',
    singletonLine: '{store} [{slot}] · local IDs: {localIds} · cloud IDs: {remoteIds} · winner: {winner}',
    winnerLocal: 'local', winnerRemote: 'cloud',
    mergeYes: 'Merge and sync', mergeNo: 'Cancel',
    redirectNoUser: 'Google redirect returned without a signed-in user. The mobile redirect flow was not changed; report this result before retrying.',
    authDomain: 'Google sign-in rejected this domain (auth/unauthorized-domain). Sync stopped; check the configured Firebase authorized domains.',
    providerOff: 'Google sign-in is not enabled for this Firebase project (auth/operation-not-allowed). Sync stopped.',
    permission: 'Firestore denied access (permission-denied). Sync stopped; check the existing per-user rules.',
    popupBlocked: 'The browser blocked the sign-in popup. Allow popups and try again.',
    offlineStart: 'You are offline. Your records remain local; reconnect and tap Sync now.',
    generic: 'The operation stopped', noUser: 'No signed-in Google user was returned.',
    records: 'Records merged: {uploaded} uploaded, {downloaded} downloaded.',
  },
  ar: {
    title: 'الإعدادات', subtitle: 'مزامنة سحابية اختيارية', panelTitle: 'مزامنة Firebase',
    intro: 'بياناتك تظل على هذا الجهاز إلا إذا سجلت الدخول بجوجل. Firebase نسخة مزامنة اختيارية، ولا تمنع الاستخدام بدون إنترنت.',
    tab: 'الإعدادات', signIn: 'تسجيل الدخول بجوجل', signOut: 'تسجيل الخروج', syncNow: 'مزامنة الآن',
    signedOut: 'لم يتم تسجيل الدخول — لا يتم رفع أي بيانات.', signingIn: 'جاري الاتصال بجوجل…',
    syncing: 'جاري مزامنة سجلاتك…', synced: 'تمت المزامنة · {time}',
    offline: 'أنت غير متصل — تغييراتك محفوظة محلياً وستتم مزامنتها عند عودة الاتصال.',
    error: 'خطأ في المزامنة: {detail}', mergeCancelled: 'تم إلغاء الدمج. لم يتم تغيير أي سجل.',
    photos: 'صور التقدم تظل على هذا الجهاز ولا تتم مزامنتها.',
    mergeTitle: 'تأكيد أول مزامنة',
    mergeBody: 'تم العثور على {local} سجل محلي و{remote} سجل سحابي. راجع الحساب وأعداد كل مخزن والسجلات التي أضيف لها وقت التعديل وتعارضات السجلات المفردة أدناه قبل المتابعة. الأحدث حسب updated_at يفوز والمحلي يفوز عند التعادل. تُحفظ النسخة الأخرى كحذف منطقي ولا يُحذف أي سجل نهائياً.',
    mergeAccount: 'حساب جوجل: {email}', emailUnavailable: 'البريد الإلكتروني غير متاح',
    countsHeading: 'السجلات حسب المخزن (محلي · سحابي · أضيف لها وقت):',
    countLine: '{store}: {local} · {remote} · {backfilled}',
    backfilledHeading: 'السجلات التي أضافت ترقية v5 وقت تحديث لها (المخزن: المعرّفات):',
    backfilledLine: '{store}: {ids}{localOnly}', localOnly: ' (محلي فقط؛ لا تتم مزامنته)',
    singletonHeading: 'تعارضات السجلات المفردة (تُحفظ النسخة الفائزة وتُنقل الأخرى للحذف المنطقي):',
    singletonLine: '{store} [{slot}] · المعرّفات المحلية: {localIds} · السحابية: {remoteIds} · الفائز: {winner}',
    winnerLocal: 'محلي', winnerRemote: 'سحابي',
    mergeYes: 'دمج ومزامنة', mergeNo: 'إلغاء',
    redirectNoUser: 'اكتملت إعادة التوجيه من جوجل دون إرجاع مستخدم مسجّل الدخول. لم يتم تغيير طريقة إعادة التوجيه؛ أبلغ عن هذه النتيجة قبل المحاولة مرة أخرى.',
    authDomain: 'رفض تسجيل الدخول نطاق هذا الموقع (auth/unauthorized-domain). توقفت المزامنة؛ راجع النطاقات المسموح بها في Firebase.',
    providerOff: 'تسجيل الدخول بجوجل غير مفعّل لهذا المشروع (auth/operation-not-allowed). توقفت المزامنة.',
    permission: 'رفض Firestore الوصول (permission-denied). توقفت المزامنة؛ راجع القواعد الحالية لكل مستخدم.',
    popupBlocked: 'منع المتصفح نافذة تسجيل الدخول. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.',
    offlineStart: 'أنت غير متصل. سجلاتك ما زالت محلية؛ أعد الاتصال واضغط «مزامنة الآن».',
    generic: 'تم إيقاف العملية', noUser: 'لم يتم إرجاع مستخدم جوجل مسجّل الدخول.',
    records: 'السجلات التي تمت مزامنتها: {uploaded} رُفعت و{downloaded} نُزّلت.',
  },
};

const STORE_LABELS = {
  en: {
    profile: 'Profile', settings: 'Settings', goals: 'Goals', daily_targets: 'Daily targets',
    weight_logs: 'Weight logs', workout_sessions: 'Workout sessions', set_logs: 'Set logs',
    programs: 'Programs', program_days: 'Program days', exercises: 'Exercises',
    program_exercises: 'Program exercises', foods: 'Foods', food_logs: 'Food logs',
    saved_meals: 'Saved meals', saved_meal_items: 'Saved meal items', water_logs: 'Water logs',
    sleep_logs: 'Sleep logs', measurements: 'Measurements', progress_photos: 'Progress photos',
  },
  ar: {
    profile: 'الملف الشخصي', settings: 'الإعدادات', goals: 'الأهداف', daily_targets: 'الأهداف اليومية',
    weight_logs: 'سجل الوزن', workout_sessions: 'جلسات التمرين', set_logs: 'المجموعات',
    programs: 'البرامج', program_days: 'أيام البرامج', exercises: 'التمارين',
    program_exercises: 'تمارين البرامج', foods: 'الأطعمة', food_logs: 'سجل الطعام',
    saved_meals: 'الوجبات المحفوظة', saved_meal_items: 'مكونات الوجبات المحفوظة', water_logs: 'سجل الماء',
    sleep_logs: 'سجل النوم', measurements: 'القياسات', progress_photos: 'صور التقدم',
  },
};

let db;
let queue;
let localAdapter;
let runtimePromise;
let runtime;
let currentUser = null;
let authUnsubscribe = null;
let allowSync = false;
let syncPromise = null;
let signInBusy = false;
let statusState = { kind: 'signedOut' };
let root;

function t(key, values = {}) {
  const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), copy[lang][key] || copy.en[key] || key);
}
function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeSet(key, value) { try { localStorage.setItem(key, value); } catch { /* Local IndexedDB records remain the source of truth. */ } }
function queueStorage() {
  try { return window.localStorage; }
  catch { return { getItem: () => null, setItem: () => {}, removeItem: () => {} }; }
}
function byId(id) { return document.getElementById(id); }
function setStatus(kind, values = {}) { statusState = { kind, ...values }; renderSettings(); }
function formattedCount(value) {
  return new Intl.NumberFormat(document.documentElement.lang === 'en' ? 'en-US' : 'ar-EG').format(value);
}
function formattedTime(value) {
  return new Intl.DateTimeFormat(document.documentElement.lang === 'en' ? 'en-US' : 'ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
function statusText() {
  if (statusState.kind === 'signingIn') return t('signingIn');
  if (statusState.kind === 'syncing') return t('syncing');
  if (statusState.kind === 'offline') return t('offline');
  if (statusState.kind === 'synced') return t('synced', { time: formattedTime(statusState.time) });
  if (statusState.kind === 'error') return t('error', { detail: statusState.detail });
  if (statusState.kind === 'mergeCancelled') return t('mergeCancelled');
  return t('signedOut');
}
function renderSettings() {
  if (!root) return;
  const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
  const title = byId('settingsTitle');
  const subtitle = byId('settingsSubtitle');
  const panelTitle = byId('p6PanelTitle');
  const intro = byId('p6Intro');
  const status = byId('p6Status');
  const photos = byId('p6PhotosNote');
  const signIn = byId('p6SignIn');
  const signOut = byId('p6SignOut');
  const syncNow = byId('p6SyncNow');
  const settingsTab = document.querySelector('[data-tab="settings"] small');
  if (title) title.textContent = t('title');
  if (subtitle) subtitle.textContent = t('subtitle');
  if (panelTitle) panelTitle.textContent = t('panelTitle');
  if (intro) intro.textContent = t('intro');
  if (status) status.textContent = statusText();
  if (photos) photos.textContent = t('photos');
  if (signIn) { signIn.textContent = t('signIn'); signIn.hidden = Boolean(currentUser); }
  if (signOut) { signOut.textContent = t('signOut'); signOut.hidden = !currentUser; }
  if (syncNow) { syncNow.textContent = t('syncNow'); syncNow.hidden = !currentUser; }
  if (settingsTab) settingsTab.textContent = copy[lang].tab;
  if (status) status.dataset.state = statusState.kind;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

function openLocalDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('azab-fitness-os', DB_VERSION);
    request.onsuccess = () => {
      const opened = request.result;
      opened.onversionchange = () => opened.close();
      resolve(opened);
    };
    request.onerror = () => reject(request.error);
  });
}
function readAll(storeName) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}
function putLocal(storeName, row) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(row);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('IndexedDB write failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB write aborted'));
  });
}
async function readLocalSetting(key) {
  return (await readAll('settings')).find(row => row.key === key && !row.deleted_at) || null;
}
async function writeLocalSetting(key, value) {
  const old = await readLocalSetting(key);
  await putLocal('settings', {
    ...(old || {}), id: `settings:${key}`, key, value,
    created_at: old?.created_at || Date.now(), updated_at: Date.now(), deleted_at: null,
  });
}

async function loadFirebase() {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
  const [appApi, authApi, firestoreApi] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`),
  ]);
  const app = appApi.getApps().find(item => item.name === '[DEFAULT]') || appApi.initializeApp(FIREBASE_CONFIG);
  const auth = authApi.getAuth(app);
  const firestore = firestoreApi.getFirestore(app);
  const local = localAdapter;
  const remote = {
    async list(uid, storeName) {
      const snapshot = await firestoreApi.getDocs(firestoreApi.collection(firestore, 'users', uid, storeName));
      return snapshot.docs.map(item => ({ ...item.data(), id: item.id }));
    },
    async putMany(uid, writes) {
      const chunks = chunkFirestoreWrites(writes);
      for (const chunk of chunks) {
        const batch = firestoreApi.writeBatch(firestore);
        for (const item of chunk) {
          batch.set(firestoreApi.doc(firestore, 'users', uid, item.storeName, item.recordId), item.data);
        }
        await batch.commit();
      }
    },
  };
  runtime = { app, auth, firestore, appApi, authApi, firestoreApi, local, remote };
  if (!authUnsubscribe) {
    authUnsubscribe = authApi.onAuthStateChanged(auth, user => {
      currentUser = user || null;
      renderSettings();
      if (!user && !signInBusy) setStatus('signedOut');
    }, error => setStatus('error', { detail: friendlyError(error) }));
  }
  return runtime;
}
function ensureFirebase() {
  if (!runtimePromise) {
    runtimePromise = loadFirebase().catch(error => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}
function localErrorCode(error) { return String(error?.code || 'unknown').toLowerCase(); }
function friendlyError(error) {
  const code = localErrorCode(error);
  if (code.includes('unauthorized-domain')) return t('authDomain');
  if (code.includes('operation-not-allowed')) return t('providerOff');
  if (code.includes('permission-denied')) return t('permission');
  if (code.includes('popup-blocked')) return t('popupBlocked');
  return `${t('generic')} (${code})`;
}
function isMobile() {
  return Boolean(navigator.userAgentData?.mobile) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

function mergeDetails(snapshot, user) {
  const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
  const lines = [
    t('mergeAccount', { email: user?.email || t('emailUnavailable') }),
    t('countsHeading'),
  ];
  for (const storeName of SYNC_STORES) {
    const records = snapshot.stores[storeName] || { local: [], remote: [] };
    const backfilled = snapshot.backfilledByStore?.[storeName]?.length || 0;
    lines.push(t('countLine', {
      store: STORE_LABELS[lang][storeName] || storeName,
      local: formattedCount(records.local.length),
      remote: formattedCount(records.remote.length),
      backfilled: formattedCount(backfilled),
    }));
  }
  if (snapshot.backfilled?.length) {
    lines.push('', t('backfilledHeading'));
    const stores = [...new Set(snapshot.backfilled.map(row => row.storeName))];
    for (const storeName of stores) {
      const rows = snapshot.backfilled.filter(row => row.storeName === storeName);
      lines.push(t('backfilledLine', {
        store: STORE_LABELS[lang][storeName] || storeName,
        ids: rows.map(row => row.recordId).join(', '),
        localOnly: rows.some(row => row.localOnly) ? t('localOnly') : '',
      }));
    }
  }
  if (snapshot.singletonConflicts?.length) {
    lines.push('', t('singletonHeading'));
    for (const conflict of snapshot.singletonConflicts) {
      lines.push(t('singletonLine', {
        store: STORE_LABELS[lang][conflict.storeName] || conflict.storeName,
        slot: conflict.canonicalId,
        localIds: conflict.localIds.join(', ') || '—',
        remoteIds: conflict.remoteIds.join(', ') || '—',
        winner: t(conflict.winner === 'local' ? 'winnerLocal' : 'winnerRemote'),
      }));
    }
  }
  return lines.join('\n');
}

function confirmMerge(snapshot, user) {
  const dialog = byId('p6MergeDialog');
  const text = byId('p6MergeText');
  const heading = byId('p6MergeTitle');
  const yes = byId('p6MergeYes');
  const no = byId('p6MergeNo');
  if (!dialog || !text || typeof dialog.showModal !== 'function') return Promise.resolve(false);
  heading.textContent = t('mergeTitle');
  text.textContent = `${t('mergeBody', { local: formattedCount(snapshot.localCount), remote: formattedCount(snapshot.remoteCount) })}\n\n${mergeDetails(snapshot, user)}`;
  yes.textContent = t('mergeYes');
  no.textContent = t('mergeNo');
  return new Promise(resolve => {
    const onClose = () => resolve(dialog.returnValue === 'merge');
    dialog.addEventListener('close', onClose, { once: true });
    dialog.showModal();
  });
}

async function syncUserData(user) {
  if (!user?.uid) return;
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    if (!navigator.onLine) { setStatus('offline'); return; }
    setStatus('syncing');
    const queuedAtStart = queue.list();
    const firstSyncKey = `${FIRST_SYNC_PREFIX}${user.uid}`;
    let totals;
    if (safeGet(firstSyncKey) !== '1') {
      const backfillMarker = await readLocalSetting(BACKFILL_SETTING_KEY);
      const snapshot = await inspectSyncData({
        uid: user.uid, local: runtime.local, remote: runtime.remote, stores: SYNC_STORES,
        backfilledRows: backfillMarker?.value?.rows || [],
      });
      if (needsFirstMergeConfirmation(snapshot) && !(await confirmMerge(snapshot, user))) {
        setStatus('mergeCancelled');
        return;
      }
      totals = await applySyncSnapshot({ snapshot, uid: user.uid, local: runtime.local, remote: runtime.remote, stores: SYNC_STORES });
      queue.clearCovered(queuedAtStart);
      if (backfillMarker) await writeLocalSetting(BACKFILL_SETTING_KEY, { ...backfillMarker.value, rows: [] });
      safeSet(firstSyncKey, '1');
    } else {
      totals = await flushQueuedSync({ uid: user.uid, local: runtime.local, remote: runtime.remote, queue, stores: SYNC_STORES });
    }
    const syncedAt = Date.now();
    safeSet(`${LAST_SYNC_PREFIX}${user.uid}`, String(syncedAt));
    setStatus('synced', { time: syncedAt, totals });
  })().catch(error => {
    setStatus('error', { detail: friendlyError(error) });
  }).finally(() => { syncPromise = null; });
  return syncPromise;
}

async function activateUser(user) {
  if (!user?.uid) { setStatus('error', { detail: t('noUser') }); return; }
  currentUser = user;
  allowSync = true;
  renderSettings();
  await syncUserData(user);
}

async function beginRedirect(auth, provider, authApi) {
  await writeLocalSetting(REDIRECT_PENDING_KEY, '1');
  try {
    await authApi.signInWithRedirect(auth, provider);
  } catch (error) {
    await writeLocalSetting(REDIRECT_PENDING_KEY, null);
    throw error;
  }
}

async function signIn() {
  if (signInBusy) return;
  signInBusy = true;
  setStatus('signingIn');
  try {
    const active = await ensureFirebase();
    if (active.auth.currentUser) {
      await activateUser(active.auth.currentUser);
      return;
    }
    const provider = new active.authApi.GoogleAuthProvider();
    active.auth.languageCode = document.documentElement.lang === 'en' ? 'en' : 'ar';
    if (isMobile()) {
      await beginRedirect(active.auth, provider, active.authApi);
      return;
    }
    try {
      const result = await active.authApi.signInWithPopup(active.auth, provider);
      await activateUser(result.user || active.auth.currentUser);
    } catch (error) {
      if (localErrorCode(error).includes('popup-blocked')) {
        await beginRedirect(active.auth, provider, active.authApi);
        return;
      }
      throw error;
    }
  } catch (error) {
    setStatus('error', { detail: friendlyError(error) });
  } finally {
    signInBusy = false;
  }
}

async function handlePendingRedirect() {
  try {
    const redirectFlag = await readLocalSetting(REDIRECT_PENDING_KEY);
    if (redirectFlag?.value !== '1') return;
    if (!navigator.onLine) { setStatus('offline'); return; }
    if (signInBusy) return;
    signInBusy = true;
    setStatus('signingIn');
    const active = await ensureFirebase();
    const result = await active.authApi.getRedirectResult(active.auth);
    await writeLocalSetting(REDIRECT_PENDING_KEY, null);
    const user = result?.user || active.auth.currentUser;
    if (!user) {
      allowSync = false;
      setStatus('error', { detail: t('redirectNoUser') });
      return;
    }
    await activateUser(user);
  } catch (error) {
    await writeLocalSetting(REDIRECT_PENDING_KEY, null);
    setStatus('error', { detail: friendlyError(error) });
  } finally {
    signInBusy = false;
  }
}

async function signOut() {
  try {
    if (!runtime) return;
    await runtime.authApi.signOut(runtime.auth);
    allowSync = false;
    currentUser = null;
    setStatus('signedOut');
  } catch (error) {
    setStatus('error', { detail: friendlyError(error) });
  }
}

export async function initPhase6(database) {
  try {
    db = database || await openLocalDatabase();
    localAdapter = {
      list: storeName => readAll(storeName),
      put: (storeName, row) => putLocal(storeName, row),
    };
    queue = createSyncQueue(queueStorage());
    window.azabQueueSyncWrite = (storeName, row) => queue?.enqueue(storeName, row);
    root = byId('settings');
    if (!root) return;
    byId('p6SignIn')?.addEventListener('click', signIn);
    byId('p6SignOut')?.addEventListener('click', signOut);
    byId('p6SyncNow')?.addEventListener('click', () => currentUser ? void syncUserData(currentUser) : void signIn());
    document.querySelector('[data-tab="settings"]')?.addEventListener('click', renderSettings);
    document.addEventListener('azab:language-changed', renderSettings);
    window.addEventListener('offline', () => { if (currentUser) setStatus('offline'); });
    window.addEventListener('online', () => {
      void readLocalSetting(REDIRECT_PENDING_KEY).then(flag => {
        if (flag?.value === '1') void handlePendingRedirect();
        else if (currentUser && allowSync) void syncUserData(currentUser);
      }).catch(error => setStatus('error', { detail: friendlyError(error) }));
    });
    window.azabRenderPhase6Settings = renderSettings;
    window.azabPhase6AfterLoad = () => { void handlePendingRedirect(); };
    renderSettings();
  } catch (error) {
    // Firebase is intentionally absent from startup; local app use stays available.
    const status = byId('p6Status');
    if (status) status.textContent = `${t('generic')} (${localErrorCode(error)})`;
  }
}
