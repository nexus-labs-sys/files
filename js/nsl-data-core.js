/* ═════════════════════════════════════════════════════════════
   nsl-data-core.js
   SINGLE SOURCE OF TRUTH for Nexus Study Lab data.
   Loaded by BOTH focus.html and streak.html (and login.html if it
   ever needs to read data). Do not duplicate nslLoad/nslSave
   anywhere else — every other script must call these.
═══════════════════════════════════════════════════════════════ */

/* ---- DISCORD DETECTION (shared definition, used by both pages) ---- */
const IS_DISCORD = (
  window.location.hostname.includes('discordsays.com') ||
  window.location.hostname.includes('discord.com') ||
  window.self !== window.top ||
  new URLSearchParams(window.location.search).has('frame_id')
);
if (IS_DISCORD) document.body.classList.add('discord-activity');
if (IS_DISCORD && window.DiscordSDKLib && window.DiscordSDKLib.patchUrlMappings) {
  try {
    window.DiscordSDKLib.patchUrlMappings([
      { prefix: '/firebase-auth', target: 'identitytoolkit.googleapis.com' },
      { prefix: '/firebase-token', target: 'securetoken.googleapis.com' },
      { prefix: '/worker', target: 'green-thunder-d974.priyan-node.workers.dev' }
    ], { patchFetch: true, patchXhr: true, patchWebSocket: false, patchSrcAttributes: false });
  } catch (e) { console.warn('[NSL] patchUrlMappings failed:', e); }
}

const WORKER_PREFIX = IS_DISCORD
  ? '/worker'
  : 'https://aged-cloud-bfd5.priyan-node.workers.dev';   // no trailing slash

const NSL_DISCORD_APP_ID = '1532256337990389880';

/* ---- DISCORD PARAM PRESERVATION ----
   Must be declared BEFORE the SDK instance below uses them. */
const NSL_BOOT_PARAMS = new URLSearchParams(window.location.search);
const NSL_FRAME_ID = NSL_BOOT_PARAMS.get('frame_id') || null;
const NSL_INSTANCE_ID = NSL_BOOT_PARAMS.get('instance_id') || NSL_FRAME_ID || null;

/* ---- SHARED DISCORD SDK INSTANCE ----
   ONE instance for the whole page, reused by nsl-discord-invite.js and
   nsl-streaks-extra.js (essential links) via window.__nslDiscordSdk /
   window.__nslDiscordSdkReadyPromise. Do NOT create additional
   DiscordSDK instances elsewhere — multiple instances racing to
   ready() against the same instanceId is what causes ready() to hang. */
let __nslDiscordSdk = null;
window.__nslDiscordSdkReadyPromise = Promise.resolve(false);

if (IS_DISCORD && window.DiscordSDKLib && typeof window.DiscordSDKLib.DiscordSDK === 'function') {
  try {
    __nslDiscordSdk = new window.DiscordSDKLib.DiscordSDK(NSL_DISCORD_APP_ID);
    window.__nslDiscordSdk = __nslDiscordSdk;
    window.__nslDiscordSdkReadyPromise = __nslDiscordSdk.ready()
      .then(() => {
        console.log('[NSL] Shared Discord SDK ready.');
        return true;
      })
      .catch(e => {
        console.warn('[NSL] Shared Discord SDK ready() rejected:', e);
        return false;
      });
  } catch (e) {
    console.warn('[NSL] Could not create Discord SDK instance for external link handling:', e);
  }
}

function nslPreserveDiscordParams(targetUrl) {
  if (!NSL_FRAME_ID && !NSL_INSTANCE_ID) return targetUrl;
  const qs = window.location.search;
  if (!qs) return targetUrl;
  const sep = targetUrl.includes('?') ? '&' : '?';
  return targetUrl + sep + qs.slice(1);
}

window.nslPreserveDiscordParams = nslPreserveDiscordParams;
window.NSL_FRAME_ID = NSL_FRAME_ID;
window.NSL_INSTANCE_ID = NSL_INSTANCE_ID;
/* ---- CONSTANTS ---- */
const NSL_LEGACY_KEY = 'nsl_data';
const NSL_KEY_PREFIX = 'nsl_data_';
const NSL_TIMER_KEY = 'nsl_timer_state';
const NSL_UID_KEY = 'nsl_active_uid';
const NSL_FIRESTORE_DEBOUNCE_MS = 1500;

/* ---- MODULE STATE ---- */
let _db = null;
let _uid = null;
let _authReady = false;
let _hasSyncedDown = false;     // <-- NEW: guards against re-fire stomping fresh writes
let _firestoreSaveTimer = null;
let _pendingFirestoreData = null;

/* Listeners other scripts can register to know when auth/data is ready
   and when fresh data arrives from Firestore (cross-device sync). */
const _nslReadyCallbacks = [];
const _nslRemoteUpdateCallbacks = [];
function nslOnReady(cb) { if (_authReady) cb(); else _nslReadyCallbacks.push(cb); }
function nslOnRemoteUpdate(cb) { _nslRemoteUpdateCallbacks.push(cb); }
function _nslFireReady() { _authReady = true; _nslReadyCallbacks.forEach(cb => { try { cb(); } catch (e) { console.warn(e); } }); _nslReadyCallbacks.length = 0; }
function _nslFireRemoteUpdate(data) { _nslRemoteUpdateCallbacks.forEach(cb => { try { cb(data); } catch (e) { console.warn(e); } }); }

/* ---- UID RESOLUTION ----
   Falls back to the cached nsl_user.uid immediately (synchronously),
   so saves that happen before onAuthStateChanged fires are NOT lost —
   they still write to the correct per-user localStorage key, and once
   _db/_uid are confirmed by Firebase, the next save pushes to Firestore. */
function nslActiveUid() {
  if (_uid) return _uid;
  try {
    const cachedActive = localStorage.getItem(NSL_UID_KEY);
    if (cachedActive) return cachedActive;
    const user = JSON.parse(localStorage.getItem('nsl_user') || '{}');
    return (user && user.uid) ? user.uid : null;
  } catch (_) { return null; }
}
function getUserStorageKey(uid = nslActiveUid()) {
  return uid ? (NSL_KEY_PREFIX + uid) : NSL_LEGACY_KEY;
}

/* ---- DEFAULT DATA SHAPE ---- */
function nslDefaults() {
  return {
    streak: { current: 0, longest: 0, totalDays: 0, lastStudyDate: null, weekDays: [] },
    xp: { today: 0, level: 1, totalXP: 0 },
    sessions: [],
    moods: {},
    goals: [],
    todos: [],
    reminders: [
      { id: 1, name: 'Morning review', time: '08:00', icon: '📖', on: true },
      { id: 2, name: 'Pomodoro break', time: '10:25', icon: '☕', on: true },
      { id: 3, name: 'Evening wrap-up', time: '21:00', icon: '🌙', on: false }
    ],
    notes: '',
    version: 1,
    updatedAt: 0
  };
}

function nslMerge(stored) {
  const d = nslDefaults();
  if (!stored) return d;
  return {
    streak: Object.assign({}, d.streak, stored.streak || {}),
    xp: Object.assign({}, d.xp, stored.xp || {}),
    sessions: Array.isArray(stored.sessions) ? stored.sessions : [],
    moods: (stored.moods && typeof stored.moods === 'object') ? stored.moods : {},
    goals: Array.isArray(stored.goals) ? stored.goals : [],
    todos: Array.isArray(stored.todos) ? stored.todos : [],
    reminders: Array.isArray(stored.reminders) ? stored.reminders : d.reminders,
    notes: typeof stored.notes === 'string' ? stored.notes : '',
    version: stored.version || 1,
    updatedAt: stored.updatedAt || 0
  };
}

/* ---- LOCAL STORAGE ---- */
function nslLoadLocal() {
  try {
    const uid = nslActiveUid();
    if (!uid) return nslDefaults();
    const raw = localStorage.getItem(getUserStorageKey(uid));
    return nslMerge(raw ? JSON.parse(raw) : null);
  } catch (_) {
    return nslDefaults();
  }
}
function nslSaveLocal(data) {
  try {
    const uid = nslActiveUid();
    if (!uid) return;
    localStorage.setItem(getUserStorageKey(uid), JSON.stringify(data));
  } catch (_) { }
}
function nslClearCache(uid = nslActiveUid()) {
  if (uid) localStorage.removeItem(getUserStorageKey(uid));
  localStorage.removeItem(NSL_TIMER_KEY);
  localStorage.removeItem('nsl_timer_clock');
}

/* ---- PUBLIC DATA API — every page calls ONLY these two ---- */
function nslLoad() {
  return nslLoadLocal();
}

function nslSave(data) {
  data.updatedAt = Date.now();
  nslSaveLocal(data);
  _scheduleFirestoreSave(data);
}

/* Debounced Firestore push — local write above is always instant &
   synchronous; the cloud write is fire-and-forget and coalesced so a
   1-second timer tick doesn't spam setDoc(). */
function _scheduleFirestoreSave(data) {
  _pendingFirestoreData = data;
  if (_firestoreSaveTimer) clearTimeout(_firestoreSaveTimer);
  _firestoreSaveTimer = setTimeout(_flushFirestoreSave, NSL_FIRESTORE_DEBOUNCE_MS);
}

//_flushFirestoreSave
function _flushFirestoreSave() {
  _firestoreSaveTimer = null;
  const data = _pendingFirestoreData;
  _pendingFirestoreData = null;
  if (!data || !_uid) return;

  if (IS_DISCORD) {
    fetch(WORKER_PREFIX + '/firestore-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: _uid, data })
    }).catch(err => console.warn('[NSL] Discord Firestore save failed:', err));
    return;
  }

  if (!_db) return;
  const ref = doc(_db, 'users', _uid, 'data', 'nsl');
  setDoc(ref, data).catch(err => console.warn('[NSL] Firestore save failed:', err));
}
/* Force any pending debounced write out immediately (call before navigation). */
function nslFlushPendingSave() {
  if (_firestoreSaveTimer) { clearTimeout(_firestoreSaveTimer); _flushFirestoreSave(); }
}
/* True while a local write hasn't been pushed to Firestore yet. Used to
   make sync-down extra safe (see nslSyncFromFirestore below). */
function nslHasPendingSave() { return _firestoreSaveTimer !== null; }

/* ---- FIRESTORE SYNC-DOWN (safe — never overwrites newer OR pending local data) ---- */
async function nslSyncFromFirestore() {
  if (!_uid) return;

  if (IS_DISCORD) {
    try {
      const res = await fetch(WORKER_PREFIX + '/firestore-get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: _uid })
      });
      const json = await res.json();

      if (nslHasPendingSave()) return;
      const local = nslLoadLocal();

      if (!json.exists) {
        if (local.sessions.length > 0 || local.todos.length > 0 || local.notes) {
          fetch(WORKER_PREFIX + '/firestore-set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: _uid, data: local })
          }).catch(e => console.warn('[NSL] First-push failed:', e));
        }
        return;
      }

      const remote = nslMerge(JSON.parse(json.blob));
      if ((remote.updatedAt || 0) > (local.updatedAt || 0)) {
        nslSaveLocal(remote);
        _nslFireRemoteUpdate(remote);
      } else if ((local.updatedAt || 0) > (remote.updatedAt || 0)) {
        fetch(WORKER_PREFIX + '/firestore-set', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: _uid, data: local })
        }).catch(e => console.warn('[NSL] Re-sync push failed:', e));
      }
    } catch (e) {
      console.warn('[NSL] Discord Firestore sync failed:', e);
    }
    return;
  }

  if (!_db) return;
  try {
    const ref = doc(_db, 'users', _uid, 'data', 'nsl');
    const snap = await getDoc(ref);
    if (nslHasPendingSave()) return;
    const local = nslLoadLocal();

    if (!snap.exists()) {
      if (local.sessions.length > 0 || local.todos.length > 0 || local.notes) {
        await setDoc(ref, local).catch(e => console.warn('[NSL] First-push failed:', e));
      }
      return;
    }
    const remote = nslMerge(snap.data());
    if ((remote.updatedAt || 0) > (local.updatedAt || 0)) {
      nslSaveLocal(remote);
      _nslFireRemoteUpdate(remote);
    } else if ((local.updatedAt || 0) > (remote.updatedAt || 0)) {
      setDoc(ref, local).catch(e => console.warn('[NSL] Re-sync push failed:', e));
    }
  } catch (e) {
    console.warn('[NSL] Firestore sync failed (offline?):', e);
  }
}

/* ---- FIREBASE INIT + AUTH (single instance, shared by every page) ---- */
(function initFirebase() {
  if (!window.FirebaseBundle) {
    console.warn('[NSL] FirebaseBundle not found — running localStorage-only.');
    _nslFireReady();
    return;
  }
  const {
    initializeApp, getAuth, onAuthStateChanged,
    getFirestore, signOut,
    doc: _doc, getDoc: _getDoc, setDoc: _setDoc, deleteDoc: _deleteDoc
  } = window.FirebaseBundle;
  doc = _doc; getDoc = _getDoc; setDoc = _setDoc; deleteDoc = _deleteDoc;

  try {
    const app = initializeApp({
      apiKey: 'AIzaSyAmrYGmTuoHP_sY4pG_MFan2CKZPlirbAk',
      authDomain: 'nexus-study-lab.firebaseapp.com',
      projectId: 'nexus-study-lab',
      storageBucket: 'nexus-study-lab.firebasestorage.app',
      messagingSenderId: '610669979476',
      appId: '1:610669979476:web:de9af7a8da3cb71f720ac1'
    });

    if (!IS_DISCORD) {
      _db = getFirestore(app);   // only instantiate Firestore SDK on web — Discord uses REST via the worker
    }
    const auth = getAuth(app);
    window._nslSignOut = () => signOut(auth);

    onAuthStateChanged(auth, async user => {
      if (user) {
        const prevUid = localStorage.getItem(NSL_UID_KEY);
        if (prevUid && prevUid !== user.uid) {
          localStorage.removeItem(getUserStorageKey(prevUid));
          _hasSyncedDown = false; // new user on this device — allow a fresh sync-down
        }
        localStorage.setItem(NSL_UID_KEY, user.uid);

        const stored = JSON.parse(localStorage.getItem('nsl_user') || '{}');
        localStorage.setItem('nsl_user', JSON.stringify({
          uid: user.uid,
          email: user.email || stored.email || '',
          name: user.displayName || stored.name || (user.email ? user.email.split('@')[0] : 'Scholar'),
          photo: user.photoURL || stored.photo || null,
          guest: false
        }));

        _uid = user.uid;

        /* THE FIX: onAuthStateChanged can — and on localhost routinely
           does — re-fire for the SAME signed-in user (token refresh,
           tab regaining focus, IndexedDB persistence re-checks). Only
           run the Firestore sync-down on a genuine first resolution
           per page load. Re-firing must NOT re-pull from Firestore,
           because a write still sitting in the local debounce window
           would get silently overwritten by an older remote doc —
           this was the cause of stats showing correctly for a moment
           and then reverting to zero a few seconds after a session
           completed. */
        if (!_hasSyncedDown) {
          _hasSyncedDown = true;
          await nslSyncFromFirestore();
        }
        _nslFireReady();
      } else {
        const cached = JSON.parse(localStorage.getItem('nsl_user') || 'null');
        if (!cached) {
          window.location.href = nslPreserveDiscordParams('index.html');
          return;
        }
        _uid = null;
        _nslFireReady();
      }
    });
  } catch (e) {
    console.warn('[NSL] Firebase init failed (offline/Discord?):', e);
    _nslFireReady();
  }
})();

function handleLogout() {
  const params = window.location.search;
  const doRedirect = () => {
    localStorage.removeItem('nsl_user');
    localStorage.removeItem(NSL_UID_KEY);
    document.body.style.transition = 'opacity 0.5s ease';
    document.body.style.opacity = '0';
    setTimeout(() => { window.location.href = nslPreserveDiscordParams('app.html'); }, 520);
  };
  if (window._nslSignOut) window._nslSignOut().then(doRedirect).catch(doRedirect);
  else doRedirect();
}

function resetAllData() {
  if (IS_DISCORD) {
    nslConfirmDiscord('Reset ALL data? This cannot be undone.', doResetAllData);
  } else {
    if (!confirm('Reset ALL data? This cannot be undone.')) return;
    doResetAllData();
  }
}

function doResetAllData() {
  nslClearCache();
  if (_uid) {
    if (IS_DISCORD) {
      fetch(WORKER_PREFIX + '/firestore-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: _uid, data: nslDefaults() })
      }).catch(() => { });
    } else if (_db) {
      deleteDoc(doc(_db, 'users', _uid, 'data', 'nsl')).catch(() => { });
    }
  }
  setTimeout(() => location.reload(), 400);
}

/* Minimal in-page confirm dialog for Discord (native confirm() is blocked by the sandbox). */
function nslConfirmDiscord(message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#1a1208;border:1px solid rgba(255,200,100,0.25);border-radius:16px;padding:24px;max-width:320px;text-align:center;font-family:inherit;color:#fdf3e0;">
      <div style="margin-bottom:18px;font-size:14px;line-height:1.5;">${message}</div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="nsl-confirm-cancel" style="padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:none;color:#fdf3e0;cursor:pointer;">Cancel</button>
        <button id="nsl-confirm-ok" style="padding:8px 16px;border-radius:8px;border:none;background:#e8952a;color:#fff;cursor:pointer;">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#nsl-confirm-cancel').onclick = () => overlay.remove();
  overlay.querySelector('#nsl-confirm-ok').onclick = () => { overlay.remove(); onConfirm(); };
}

/* Flush any pending Firestore write when the tab is closing/navigating,
   so a debounced save isn't lost. */
window.addEventListener('beforeunload', nslFlushPendingSave);
window.addEventListener('pagehide', nslFlushPendingSave);

/* Cross-tab/page sync: if another tab/page writes nsl_data_<uid>, pick it up. */
window.addEventListener('storage', e => {
  if (!e.key || e.key !== getUserStorageKey()) return;
  if (!e.newValue) return;
  try { _nslFireRemoteUpdate(nslMerge(JSON.parse(e.newValue))); } catch (_) { }
});