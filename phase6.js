import {
  BACKFILL_SETTING_KEY,
  DB_VERSION,
  REDIRECT_PENDING_KEY,
  SYNC_STORES,
  applyLiveSyncStoreSnapshot,
  applySyncSnapshot,
  chunkFirestoreWrites,
  createSyncQueue,
  flushQueuedSync,
  inspectSyncData,
  needsFirstMergeConfirmation,
  observeAuthState,
  setDeviceAuthPersistence,
  synchronizeAll,
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
    intro: 'Your data stays on this device unless you sign in with Google. After your first sign-in on this browser, the app remembers the session and syncs automatically on startup and when records change. Each new device/browser needs its own initial sign-in; offline use stays local.',
    tab: 'Settings', signIn: 'Sign in with Google', signOut: 'Sign out', syncNow: 'Sync now',
    signedOut: 'Signed out — no data is being uploaded.', restoringAuth: 'Restoring your Google session…', signingIn: 'Connecting to Google…',
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
    redirectNoUser: 'A pending Google redirect returned without a signed-in user. New sign-in attempts use the popup; no redirect fallback was attempted.',
    authDomain: 'Google sign-in rejected this domain (auth/unauthorized-domain). Sync stopped; check the configured Firebase authorized domains.',
    providerOff: 'Google sign-in is not enabled for this Firebase project (auth/operation-not-allowed). Sync stopped.',
    permission: 'Firestore denied access (permission-denied). Sync stopped; check the existing per-user rules.',
    popupBlocked: 'The browser blocked the sign-in popup (auth/popup-blocked). Allow popups and try again; sign-in will not switch to redirect.',
    popupClosed: 'The sign-in popup was closed or cancelled. Try again if you still want to sign in.',
    offlineStart: 'You are offline. Your records remain local and sync when you reconnect.',
    generic: 'The operation stopped', noUser: 'No signed-in Google user was returned.',
    records: 'Records merged: {uploaded} uploaded, {downloaded} downloaded.',
  },
  ar: {
    title: 'الإعدادات', subtitle: 'مزامنة سحابية اختيارية', panelTitle: 'مزامنة Firebase',
    intro: 'تظل بياناتك على هذا الجهاز إلا إذا سجلت الدخول بجوجل. بعد أول تسجيل دخول على هذا المتصفح، يتذكر التطبيق الجلسة ويزامن تلقائياً عند الفتح وعند تغيير السجلات. كل جهاز أو متصفح جديد يحتاج تسجيل دخول أول مرة؛ والاستخدام بدون إنترنت يظل محلياً.',
    tab: 'الإعدادات', signIn: 'تسجيل الدخول بجوجل', signOut: 'تسجيل الخروج', syncNow: 'مزامنة الآن',
    signedOut: 'لم يتم تسجيل الدخول — لا يتم رفع أي بيانات.', restoringAuth: 'جاري استعادة جلسة جوجل…', signingIn: 'جاري الاتصال بجوجل…',
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
    redirectNoUser: 'اكتملت إعادة توجيه جوجل معلّقة دون إرجاع مستخدم مسجّل الدخول. تسجيل الدخول الجديد يستخدم النافذة المنبثقة، ولن يتم التحويل تلقائياً إلى إعادة التوجيه.',
    authDomain: 'رفض تسجيل الدخول نطاق هذا الموقع (auth/unauthorized-domain). توقفت المزامنة؛ راجع النطاقات المسموح بها في Firebase.',
    providerOff: 'تسجيل الدخول بجوجل غير مفعّل لهذا المشروع (auth/operation-not-allowed). توقفت المزامنة.',
    permission: 'رفض Firestore الوصول (permission-denied). توقفت المزامنة؛ راجع القواعد الحالية لكل مستخدم.',
    popupBlocked: 'منع المتصفح نافذة تسجيل الدخول (auth/popup-blocked). اسمح بالنوافذ المنبثقة ثم أعد المحاولة؛ لن يتم التحويل إلى إعادة التوجيه.',
    popupClosed: 'أُغلقت نافذة تسجيل الدخول أو أُلغي الطلب. أعد المحاولة إذا كنت لا تزال تريد تسجيل الدخول.',
    offlineStart: 'أنت غير متصل. سجلاتك ما زالت محلية وستتم مزامنتها عند عودة الاتصال.',
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
let authInitialized = false;
let syncRequested = false;
let syncTimer = null;
let liveUnsubscribes = [];
let liveUid = null;
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
  if (statusState.kind === 'restoringAuth') return t('restoringAuth');
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
  if (signIn) {
    signIn.textContent = t('signIn');
    signIn.hidden = Boolean(currentUser);
    signIn.disabled = statusState.kind === 'restoringAuth' || statusState.kind === 'signingIn';
  }
  if (signOut) { signOut.textContent = t('signOut'); signOut.hidden = !currentUser || !authInitialized; }
  if (syncNow) { syncNow.textContent = t('syncNow'); syncNow.hidden = !currentUser || !authInitialized || !allowSync; }
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
  await setDeviceAuthPersistence(authApi, auth);
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
    listen(uid, storeName, onRows, onError) {
      const reference = firestoreApi.collection(firestore, 'users', uid, storeName);
      return firestoreApi.onSnapshot(reference,
        snapshot => onRows(snapshot.docs.map(item => ({ ...item.data(), id: item.id }))),
        onError);
    },
  };
  runtime = { app, auth, firestore, appApi, authApi, firestoreApi, local, remote, authStateReady: null };
  if (!authUnsubscribe) {
    const observer = observeAuthState(authApi, auth, user => {
      const previousUid = currentUser?.uid || null;
      currentUser = user || null;
      renderSettings();
      if (!user) {
        allowSync = false;
        stopRealtimeSync();
        if (!signInBusy && authInitialized) setStatus('signedOut');
        return;
      }
      if (previousUid && previousUid !== user.uid) {
        allowSync = false;
        stopRealtimeSync();
      }
      if (authInitialized && !signInBusy && previousUid !== user.uid) void activateUser(user);
    }, error => setStatus('error', { detail: friendlyError(error) }));
    authUnsubscribe = observer.unsubscribe;
    runtime.authStateReady = observer.ready;
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
function stopRealtimeSync() {
  for (const unsubscribe of liveUnsubscribes.splice(0)) {
    try { unsubscribe(); } catch { /* A stopped listener is already inactive. */ }
  }
  liveUid = null;
}
function haltSyncOnPermissionDenied(error) {
  if (!localErrorCode(error).includes('permission-denied')) return;
  allowSync = false;
  syncRequested = false;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = null;
  stopRealtimeSync();
}
function startRealtimeSync(user) {
  if (!user?.uid || !runtime?.remote?.listen || liveUid === user.uid) return;
  stopRealtimeSync();
  liveUid = user.uid;
  for (const storeName of SYNC_STORES) {
    let active = true;
    let pending = Promise.resolve();
    try {
      const unsubscribe = runtime.remote.listen(user.uid, storeName, remoteRows => {
        pending = pending.then(async () => {
          if (!active || currentUser?.uid !== user.uid || !allowSync) return;
          const totals = await applyLiveSyncStoreSnapshot({
            uid: user.uid, storeName, local: runtime.local, remote: runtime.remote, remoteRows,
          });
          if (totals.downloaded > 0) {
            window.dispatchEvent(new CustomEvent('azab:remote-records-applied', { detail: { storeName, downloaded: totals.downloaded } }));
          }
        }).catch(error => {
          if (active && currentUser?.uid === user.uid) {
            haltSyncOnPermissionDenied(error);
            setStatus('error', { detail: friendlyError(error) });
          }
        });
      }, error => {
        if (active && currentUser?.uid === user.uid) {
          haltSyncOnPermissionDenied(error);
          setStatus('error', { detail: friendlyError(error) });
        }
      });
      liveUnsubscribes.push(() => { active = false; unsubscribe?.(); });
    } catch (error) {
      active = false;
      haltSyncOnPermissionDenied(error);
      setStatus('error', { detail: friendlyError(error) });
    }
  }
}
function beginSync(task) {
  if (syncPromise) { syncRequested = true; return syncPromise; }
  let succeeded = false;
  syncPromise = Promise.resolve().then(task).then(result => {
    succeeded = Boolean(result);
    return succeeded;
  }).catch(error => {
    haltSyncOnPermissionDenied(error);
    setStatus('error', { detail: friendlyError(error) });
    return false;
  }).finally(() => {
    syncPromise = null;
    const runAgain = syncRequested && succeeded;
    syncRequested = false;
    if (runAgain) setTimeout(requestQueuedSync, 0);
  });
  return syncPromise;
}
function requestQueuedSync() {
  if (!currentUser?.uid || !allowSync || !navigator.onLine || !queue?.count()) return;
  if (syncPromise) { syncRequested = true; return; }
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    const user = currentUser;
    if (!user?.uid || !allowSync || !navigator.onLine) return;
    void beginSync(async () => {
      if (!queue.count()) return true;
      setStatus('syncing');
      const totals = await flushQueuedSync({ uid: user.uid, local: runtime.local, remote: runtime.remote, queue, stores: SYNC_STORES });
      if (currentUser?.uid !== user.uid || !allowSync) return false;
      setStatus('synced', { time: Date.now(), totals });
      return true;
    });
  }, 120);
}
function localErrorCode(error) { return String(error?.code || 'unknown').toLowerCase(); }
function friendlyError(error) {
  const code = localErrorCode(error);
  if (code.includes('unauthorized-domain')) return t('authDomain');
  if (code.includes('operation-not-allowed')) return t('providerOff');
  if (code.includes('permission-denied')) return t('permission');
  if (code.includes('popup-blocked')) return t('popupBlocked');
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) return t('popupClosed');
  return `${t('generic')} (${code})`;
}
export function signInWithPopupOnly(authApi, auth, provider) {
  return authApi.signInWithPopup(auth, provider);
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
  if (!user?.uid) return false;
  return beginSync(async () => {
    if (!navigator.onLine) { setStatus('offline'); return false; }
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
      if (currentUser?.uid !== user.uid || !allowSync) return false;
      if (needsFirstMergeConfirmation(snapshot) && !(await confirmMerge(snapshot, user))) {
        setStatus('mergeCancelled');
        return false;
      }
      totals = await applySyncSnapshot({ snapshot, uid: user.uid, local: runtime.local, remote: runtime.remote, stores: SYNC_STORES });
      queue.clearCovered(queuedAtStart);
      if (backfillMarker) await writeLocalSetting(BACKFILL_SETTING_KEY, { ...backfillMarker.value, rows: [] });
      safeSet(firstSyncKey, '1');
    } else {
      totals = await synchronizeAll({ uid: user.uid, local: runtime.local, remote: runtime.remote, stores: SYNC_STORES });
      queue.clearCovered(queuedAtStart);
    }
    if (currentUser?.uid !== user.uid || !allowSync) return false;
    const syncedAt = Date.now();
    safeSet(`${LAST_SYNC_PREFIX}${user.uid}`, String(syncedAt));
    setStatus('synced', { time: syncedAt, totals });
    return true;
  });
}

async function activateUser(user) {
  if (!user?.uid) { setStatus('error', { detail: t('noUser') }); return false; }
  currentUser = user;
  allowSync = true;
  renderSettings();
  const synced = await syncUserData(user);
  if (synced && currentUser?.uid === user.uid && allowSync) startRealtimeSync(user);
  return synced;
}

async function signIn() {
  if (signInBusy) return;
  signInBusy = true;
  setStatus('signingIn');
  try {
    await writeLocalSetting(REDIRECT_PENDING_KEY, null);
    const active = await ensureFirebase();
    await active.authStateReady;
    authInitialized = true;
    const restoredUser = active.auth.currentUser || currentUser;
    if (restoredUser) {
      await activateUser(restoredUser);
      return;
    }
    const provider = new active.authApi.GoogleAuthProvider();
    active.auth.languageCode = document.documentElement.lang === 'en' ? 'en' : 'ar';
    const result = await signInWithPopupOnly(active.authApi, active.auth, provider);
    await activateUser(result.user || active.auth.currentUser);
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
    await active.authStateReady;
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
    syncRequested = false;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = null;
    stopRealtimeSync();
    currentUser = null;
    setStatus('signedOut');
  } catch (error) {
    setStatus('error', { detail: friendlyError(error) });
  }
}

async function restoreAuthAtStartup() {
  setStatus('restoringAuth');
  try {
    const active = await ensureFirebase();
    const user = await active.authStateReady;
    authInitialized = true;
    if (user) await activateUser(user);
    else setStatus('signedOut');
  } catch (error) {
    if (!runtime) authInitialized = false;
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
    window.azabQueueSyncWrite = (storeName, row) => {
      queue?.enqueue(storeName, row);
      requestQueuedSync();
    };
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
        else if (!authInitialized) void restoreAuthAtStartup();
      }).catch(error => setStatus('error', { detail: friendlyError(error) }));
    });
    window.azabRenderPhase6Settings = renderSettings;
    window.azabPhase6AfterLoad = () => { void handlePendingRedirect(); };
    setStatus('restoringAuth');
    renderSettings();
    void restoreAuthAtStartup();
  } catch (error) {
    // Firebase startup is asynchronous; local app use stays available if it is unavailable.
    const status = byId('p6Status');
    if (status) status.textContent = `${t('generic')} (${localErrorCode(error)})`;
  }
}
