/* ═════════════════════════════════════════════════════════════
   nsl-app.js
   MERGED FILE: nsl-data-core.js + nsl-login.js

   Load this ONE file instead of the two originals (drop the two
   separate <script> tags and point them both at this file, keeping
   the same load order relative to DiscordSDKLib / FirebaseBundle).

   Changes made while merging (all about removing duplication / bugs
   that were breaking the Discord Activity handshake):

     1. THE HANDSHAKE BUG: Section 1 (data core) already creates ONE
        shared DiscordSDK instance and calls sdk.ready() on it,
        exposing it as window.__nslDiscordSdk /
        window.__nslDiscordSdkReadyPromise — with an explicit comment
        warning not to create a second instance. Section 2 (login)
        was ignoring that and constructing a SECOND `new DiscordSDK(...)`
        against the same instanceId and calling .ready() on IT too.
        Two instances racing ready() against the same instanceId is
        exactly what the core file's own comment says causes ready()
        to hang. Fixed: runDiscordAuth() now just awaits the existing
        window.__nslDiscordSdkReadyPromise and reuses window.__nslDiscordSdk
        instead of building its own SDK.

     2. `DISCORD_INSTANCE_ID` was referenced inside runDiscordAuth()
        but was never declared in either file — that's a
        ReferenceError waiting to happen. Replaced with the real
        instance id, NSL_INSTANCE_ID, from Section 1.

     3. `DISCORD_APP_ID` (login file) and `NSL_DISCORD_APP_ID` (data
        core) were the same value declared twice under two names.
        Kept only NSL_DISCORD_APP_ID; all usages updated.

     4. The login file's `if (IS_DISCORD) {...}` block called
        `patchUrlMappings(...)` a second time — Section 1 already
        does this once. Removed the duplicate call.

     5. `nslBuildNavUrl()` in the login file duplicated
        `nslPreserveDiscordParams()` from the data core (same logic,
        data core's version is slightly safer — it no-ops when there
        are no Discord params). Removed the duplicate, everything now
        uses nslPreserveDiscordParams / window.nslPreserveDiscordParams.

   Nothing else was changed — the !IS_DISCORD (normal web login) flow
   is untouched, and the data core's public API (nslLoad/nslSave/etc)
   is untouched.
═══════════════════════════════════════════════════════════════ */


/* ═════════════════════════════════════════════════════════════
   SECTION 1 — DATA CORE
   (formerly nsl-data-core.js — content unchanged)
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
  : 'https://aged-cloud-bfd5.priyan-node.workers.dev/';

const NSL_DISCORD_APP_ID = '1532256337990389880';

/* ---- DISCORD PARAM PRESERVATION ----
   Must be declared BEFORE the SDK instance below uses them. */
const NSL_BOOT_PARAMS = new URLSearchParams(window.location.search);
const NSL_FRAME_ID = NSL_BOOT_PARAMS.get('frame_id') || null;
const NSL_INSTANCE_ID = NSL_BOOT_PARAMS.get('instance_id') || NSL_FRAME_ID || null;

/* ---- SHARED DISCORD SDK INSTANCE ----
   ONE instance for the whole page, reused by nsl-discord-invite.js,
   nsl-streaks-extra.js (essential links), and the login/auth flow
   below (Section 2) via window.__nslDiscordSdk /
   window.__nslDiscordSdkReadyPromise. Do NOT create additional
   DiscordSDK instances elsewhere — multiple instances racing to
   ready() against the same instanceId is what causes ready() to hang. */
let __nslDiscordSdk = null;
window.__nslDiscordSdkReadyPromise = Promise.resolve(false);

if (IS_DISCORD && window.DiscordSDKLib && typeof window.DiscordSDKLib.DiscordSDK === 'function') {
  try {
    __nslDiscordSdk = new window.DiscordSDKLib.DiscordSDK(NSL_DISCORD_APP_ID, {
      instanceId: NSL_INSTANCE_ID || NSL_FRAME_ID
    });
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
let _hasSyncedDown = false;     // guards against re-fire stomping fresh writes
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
          // Single-page app now (login screen lives inside app.html) — show
          // it in place. Done directly here (not via window.nslShowLoginGate)
          // because this Firebase callback can fire before the login section
          // below has finished executing.
          const appEl = document.getElementById('app-content');
          const gateEl = document.getElementById('login-gate');
          if (appEl) appEl.style.display = 'none';
          if (gateEl) gateEl.style.display = '';
          _uid = null;
          _nslFireReady();
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
  const doRedirect = () => {
    localStorage.removeItem('nsl_user');
    localStorage.removeItem(NSL_UID_KEY);
    // Single-page app now — just swap back to the login screen in place,
    // no navigation/reload needed.
    const appEl = document.getElementById('app-content');
    const gateEl = document.getElementById('login-gate');
    if (appEl) appEl.style.display = 'none';
    if (gateEl) gateEl.style.display = '';
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


/* ═════════════════════════════════════════════════════════════
   SECTION 2 — LOGIN / DISCORD ACTIVITY AUTH
   (formerly nsl-login.js — see the changelog at the top of this
   file for what was deduplicated/fixed while merging)
═══════════════════════════════════════════════════════════════ */

console.log("BUILD_TEST_2026_06_18_v1");

/* ══════════════════════════════════════════════════════════════════
   TEMPORARY DIAGNOSTIC FLAG
   When true: after the shared Discord SDK is ready, we stop BEFORE
   authorize/authenticate/Firebase and just show a button that calls
   sdk.commands.openExternalLink(). This isolates whether external-link
   opening works at all, independent of auth/payment plumbing. Flip
   back to false (or delete this block) once confirmed.
   ══════════════════════════════════════════════════════════════════ */
const NSL_TEST_MODE = true;
const NSL_TEST_URL = "htpps://quietplace.space"; // ⚠ typo — should be "https://", fix before using for real

const DISCORD_REDIRECT_URI = "https://nexus-labs-sys.github.io/files/";

/* Used by both the Discord Activity auth flow and the normal web login flow. */
function nslEnterApp() {
  document.getElementById('login-gate').style.display = 'none';
  document.getElementById('app-content').style.display = '';
  window.dispatchEvent(new CustomEvent('nsl-authed'));
}
window.nslEnterApp = nslEnterApp;

/* Reverse of nslEnterApp — used by logout and by the "no cached session"
   fallback in Section 1. Single-page app now, so this is just a
   visibility swap, never a real navigation. */
function nslShowLoginGate() {
  document.getElementById('app-content').style.display = 'none';
  document.getElementById('login-gate').style.display = '';
  window.dispatchEvent(new CustomEvent('nsl-loggedout'));
}
window.nslShowLoginGate = nslShowLoginGate;

if (IS_DISCORD) {

  document
    .getElementById("discord-gate")
    .classList.add("active");

  if (
    !window.DiscordSDKLib ||
    typeof window.DiscordSDKLib.DiscordSDK !== "function"
  ) {
    setGateError(
      "Discord SDK bundle not loaded."
    );
  } else {
    // URL mappings were already patched once in Section 1 — no need to
    // repeat it here.
    runDiscordAuth();
  }
}

/* Uses the SINGLE shared DiscordSDK instance created in Section 1
   (window.__nslDiscordSdk / window.__nslDiscordSdkReadyPromise) instead
   of constructing a second instance and calling ready() again — that
   second-instance-plus-second-ready() pattern is what was hanging the
   handshake. */
async function runDiscordAuth() {
  console.log("[NSL] instanceId:", NSL_INSTANCE_ID);

  if (!NSL_INSTANCE_ID) {
    setGateError("No Discord instance ID found.");
    return;
  }

  try {
    setGateStatus("Connecting to Discord...");

    console.log("[NSL] before shared sdk ready promise");

    const ready = await Promise.race([
      window.__nslDiscordSdkReadyPromise,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("sdk.ready timeout")),
          10000
        )
      ),
    ]);

    const sdk = window.__nslDiscordSdk;

    if (!ready || !sdk) {
      throw new Error("Discord SDK handshake did not complete");
    }

    console.log("[NSL] after sdk ready (shared instance)");

    /* ── TEST MODE: stop right here, before authorize/auth/Firebase.
       Show a button that calls openExternalLink so we can confirm,
       in isolation, whether link-opening works inside this Activity. ── */
    if (NSL_TEST_MODE) {
      setGateStatus("Handshake OK ✶ Ready to test external link.");
      showTestLinkButton(sdk);
      return;
    }

    setGateStatus("Requesting access...");

    const authResult = await sdk.commands.authorize({
      client_id: NSL_DISCORD_APP_ID,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify"],
    });

    const code = authResult.code;

    console.log("[NSL] got code:", !!code);

    if (!code) {
      throw new Error("No authorization code");
    }

    setGateStatus("Verifying identity...");

    const tokenRes = await fetch(
      WORKER_PREFIX + "/discord-token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
        }),
      }
    );

    console.log("[NSL] worker status:", tokenRes.status);

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(
        `Worker ${tokenRes.status}: ${errText}`
      );
    }

    const tokenData = await tokenRes.json();

    const access_token = tokenData.access_token;
    const firebaseCustomToken =
      tokenData.firebaseCustomToken;

    if (!access_token) {
      throw new Error("No access token returned");
    }

    if (!firebaseCustomToken) {
      throw new Error(
        "No Firebase custom token returned from worker"
      );
    }

    setGateStatus("Authenticating with Discord...");

    const auth = await sdk.commands.authenticate({
      access_token,
    });

    const discordUser = auth.user;

    console.log(
      "[NSL] discord-authenticated:",
      discordUser.username
    );

    setGateStatus("Signing into your account...");

    if (!window.FirebaseBundle) {
      throw new Error("Firebase bundle not loaded");
    }

    const FB = window.FirebaseBundle;

    const fbApp = FB.initializeApp({
      apiKey: "AIzaSyAmrYGmTuoHP_sY4pG_MFan2CKZPlirbAk",
      authDomain: "nexus-study-lab.firebaseapp.com",
      projectId: "nexus-study-lab",
      storageBucket: "nexus-study-lab.firebasestorage.app",
      messagingSenderId: "610669979476",
      appId: "1:610669979476:web:de9af7a8da3cb71f720ac1",
    });

    const fbAuth = FB.getAuth(fbApp);

    const fbResult = await FB.signInWithCustomToken(
      fbAuth,
      firebaseCustomToken
    );

    const fbUser = fbResult.user;

    console.log(
      "[NSL] firebase-authenticated:",
      fbUser.uid
    );

    localStorage.setItem(
      "nsl_user",
      JSON.stringify({
        uid: fbUser.uid,
        name:
          discordUser.global_name ||
          discordUser.username,
        email: "",
        guest: false,
        discord_id: discordUser.id,
        discord_user: discordUser.username,
      })
    );

    localStorage.setItem(
      "nsl_active_uid",
      fbUser.uid
    );

    setGateStatus(
      "Welcome " +
      (discordUser.global_name ||
        discordUser.username)
    );

    setTimeout(() => {
      nslEnterApp();
    }, 500);

  } catch (err) {
    console.error(
      "[NSL] Authentication failed:",
      err
    );

    setGateError(
      String(err.message || err)
    );

    const retryBtn =
      document.getElementById("btn-retry");

    if (retryBtn) {
      retryBtn.classList.add("visible");

      retryBtn.onclick = () => {
        retryBtn.classList.remove("visible");
        runDiscordAuth();
      };
    }
  }
}

function showTestLinkButton(sdk) {
  const btn = document.getElementById("btn-test-link");
  const resultEl = document.getElementById("test-link-result");
  if (!btn) return;

  btn.classList.add("visible");
  resultEl.textContent = "";

  btn.onclick = async () => {
    btn.disabled = true;
    resultEl.textContent = "Calling openExternalLink(" + NSL_TEST_URL + ")…";
    try {
      const res = await sdk.commands.openExternalLink({ url: NSL_TEST_URL });
      console.log("[NSL] openExternalLink result:", res);
      resultEl.textContent = "Result: " + JSON.stringify(res) +
        " — if a browser tab/prompt opened, links work. If 'opened' is false/null, check the app's URL Mappings / external link allowlist in the Discord Dev Portal.";
    } catch (err) {
      console.error("[NSL] openExternalLink failed:", err);
      resultEl.textContent = "Error: " + String(err.message || err);
    } finally {
      btn.disabled = false;
    }
  };
}

function setGateStatus(text) {
  document.getElementById("gate-status").textContent = text;
  document.getElementById("gate-spinner").classList.remove("hidden");
}

function setGateError(html) {
  document.getElementById("gate-status").innerHTML = html;
  document.getElementById("gate-spinner").classList.add("hidden");
}

function sanitize(str) {
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}



if (!IS_DISCORD) {

  document.getElementById('normal-login').style.display = 'flex';

  if (typeof window.FirebaseBundle === 'undefined') {
    document.getElementById('bundle-error').style.display = 'block';
    ['btn-google', 'btn-discord', 'main-btn', 'guest-btn'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.disabled = true;
    });
  }

  var auth = null;
  var FB = null;

  var suppressAuthListener = false;

  if (window.FirebaseBundle) {
    FB = window.FirebaseBundle;
    console.log('FirebaseBundle:', FB);
    console.log('Keys:', Object.keys(FB));
    console.log('signInWithCustomToken:', typeof FB.signInWithCustomToken);
    FB.initializeApp({
      apiKey: 'AIzaSyAmrYGmTuoHP_sY4pG_MFan2CKZPlirbAk',
      authDomain: 'nexus-study-lab.firebaseapp.com',
      projectId: 'nexus-study-lab',
      storageBucket: 'nexus-study-lab.firebasestorage.app',
      messagingSenderId: '610669979476',
      appId: '1:610669979476:web:de9af7a8da3cb71f720ac1',
    });

    auth = FB.getAuth();

    FB.getRedirectResult(auth).then(function (result) {
      if (result && result.user) {
        saveUser(result.user);
        nslEnterApp();
      }
    }).catch(function (err) {
      if (err.code !== 'auth/no-auth-event') setMsg(friendlyError(err.code), 'error');
    });

    FB.onAuthStateChanged(auth, function (user) {
      if (suppressAuthListener) return;
      if (!user) return;

      var isPasswordAccount = user.providerData.length > 0 &&
        user.providerData.some(function (p) { return p.providerId === 'password'; });

      if (isPasswordAccount && !user.emailVerified) {
        FB.signOut(auth);
        return;
      }

      saveUser(user);
      nslEnterApp();
    });

    handleDiscordCallback();
  }

  function saveUser(user, nameOverride) {
    localStorage.setItem('nsl_user', JSON.stringify({
      uid: user.uid,
      email: user.email || '',
      name: nameOverride || user.displayName || (user.email ? user.email.split('@')[0] : 'Scholar'),
      photo: user.photoURL || null,
      guest: false,
    }));
  }

  function setMsg(text, type) {
    var el = document.getElementById('msg');
    el.textContent = text;
    el.className = 'msg' + (type ? ' ' + type : '');
  }

  function setMsgHTML(html, type) {
    var el = document.getElementById('msg');
    el.innerHTML = html;
    el.className = 'msg' + (type ? ' ' + type : '');
  }

  function clearMsg() { setMsg('', ''); }

  function setLoading(on) {
    var btn = document.getElementById('main-btn');
    btn.disabled = on;
    btn.innerHTML = on
      ? '<span class="spinner"></span>One moment…'
      : (currentTab === 'register' ? 'Create Account' : 'Enter the Lab');
  }

  function showOverlay(text) {
    document.getElementById('social-loading-text').textContent = text || 'Connecting…';
    document.getElementById('social-loading').classList.add('show');
  }
  function hideOverlay() {
    document.getElementById('social-loading').classList.remove('show');
  }

  function friendlyError(code) {
    var map = {
      'auth/invalid-email': "That email address doesn't look right.",
      'auth/user-not-found': 'No account found with that email.',
      'auth/wrong-password': 'Wrong password — try again.',
      'auth/invalid-credential': 'Email or password is incorrect.',
      'auth/email-already-in-use': 'An account with that email already exists.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/too-many-requests': 'Too many attempts — please wait a moment.',
      'auth/network-request-failed': 'Network error — check your connection.',
      'auth/popup-closed-by-user': 'Sign-in window was closed. Try again.',
      'auth/popup-blocked': 'Popup was blocked — trying redirect…',
      'auth/cancelled-popup-request': 'Sign-in was cancelled.',
      'auth/operation-not-allowed': 'This sign-in method is not currently enabled.',
    };
    return map[code] || 'Something went wrong. Please try again.';
  }

  var currentTab = 'login';

  function switchTab(tab) {
    currentTab = tab;
    var isReg = (tab === 'register');
    document.getElementById('tab-login').classList.toggle('active', !isReg);
    document.getElementById('tab-login').setAttribute('aria-selected', String(!isReg));
    document.getElementById('tab-register').classList.toggle('active', isReg);
    document.getElementById('tab-register').setAttribute('aria-selected', String(isReg));
    document.getElementById('register-name-field').style.display = isReg ? 'flex' : 'none';
    document.getElementById('forgot-row').style.display = isReg ? 'none' : 'block';
    var pwd = document.getElementById('login-password');
    var btn = document.getElementById('main-btn');
    if (isReg) {
      btn.textContent = 'Create Account';
      pwd.setAttribute('autocomplete', 'new-password');
      pwd.setAttribute('placeholder', 'Choose a password');
    } else {
      btn.textContent = 'Enter the Lab';
      pwd.setAttribute('autocomplete', 'current-password');
      pwd.setAttribute('placeholder', '••••••••');
    }
    clearMsg();
  }

  function handleGoogleLogin() {
    if (!auth || !FB) return;
    clearMsg();
    document.getElementById('btn-google').disabled = true;
    showOverlay('Connecting to Google…');
    var provider = new FB.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    FB.signInWithPopup(auth, provider).then(function (result) {
      saveUser(result.user);
      hideOverlay();
      nslEnterApp();
    }).catch(function (err) {
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
        setMsg(friendlyError(err.code), 'error');
        FB.signInWithRedirect(auth, provider).catch(function (e2) {
          hideOverlay();
          document.getElementById('btn-google').disabled = false;
          setMsg(friendlyError(e2.code), 'error');
        });
      } else {
        hideOverlay();
        document.getElementById('btn-google').disabled = false;
        setMsg(friendlyError(err.code), 'error');
      }
    });
  }

  function handleDiscordWebLogin() {
    clearMsg();
    showOverlay('Redirecting to Discord…');
    var state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('discord_oauth_state', state);
    var params = new URLSearchParams({
      client_id: NSL_DISCORD_APP_ID,
      redirect_uri: DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: 'identify email',
      state: state,
    });
    window.location.href = 'https://discord.com/api/oauth2/authorize?' + params.toString();
  }

  async function handleDiscordCallback() {
    var urlParams = new URLSearchParams(window.location.search);
    var code = urlParams.get('code');
    var state = urlParams.get('state');
    if (!code) return;

    history.replaceState({}, '', window.location.pathname);

    var savedState = sessionStorage.getItem('discord_oauth_state');
    sessionStorage.removeItem('discord_oauth_state');
    if (state !== savedState) {
      setMsg('Discord sign-in failed — security check failed. Try again.', 'error');
      return;
    }

    showOverlay('Finishing Discord sign-in…');
    try {
      var res = await fetch(WORKER_PREFIX + '/discord-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, redirect_uri: DISCORD_REDIRECT_URI }),
      });
      if (!res.ok) throw new Error('Worker responded with ' + res.status);
      var data = await res.json();
      var firebaseToken = data.firebaseToken;
      var discordUser = data.discordUser;
      var result = await FB.signInWithCustomToken(auth, firebaseToken);
      saveUser(result.user, discordUser && discordUser.username);
      hideOverlay();
      nslEnterApp();
    } catch (err) {
      hideOverlay();
      setMsg('Discord sign-in failed — ' + (err.message || 'unknown error'), 'error');
    }
  }

  function handleEmailSubmit() {
    if (!auth || !FB) return;
    var email = document.getElementById('login-email').value.trim();
    var pass = document.getElementById('login-password').value;
    clearMsg();
    if (!email || !pass) { setMsg('Please fill in all fields.', 'error'); return; }
    if (!email.includes('@')) { setMsg('Enter a valid email address.', 'error'); return; }
    if (pass.length < 6) { setMsg('Password must be at least 6 characters.', 'error'); return; }
    if (currentTab === 'register') {
      var name = document.getElementById('reg-name').value.trim();
      if (!name) { setMsg('Please enter your name.', 'error'); return; }
      doRegister(name, email, pass);
    } else {
      doLogin(email, pass);
    }
  }

  function doLogin(email, pass) {
    setLoading(true);
    suppressAuthListener = true;
    FB.signInWithEmailAndPassword(auth, email, pass).then(function (cred) {

      if (!cred.user.emailVerified) {
        FB.signOut(auth).then(function () {
          suppressAuthListener = false;
          setLoading(false);
          showUnverifiedMessage(email);
        });
        return;
      }

      suppressAuthListener = false;
      saveUser(cred.user);
      setMsg('Welcome back ✶', 'success');
      setTimeout(nslEnterApp, 500);
    }).catch(function (err) {
      suppressAuthListener = false;
      setMsg(friendlyError(err.code), 'error');
      setLoading(false);
    });
  }

  function doRegister(name, email, pass) {
    setLoading(true);
    suppressAuthListener = true;

    FB.createUserWithEmailAndPassword(auth, email, pass).then(function (cred) {
      var user = cred.user;

      return FB.updateProfile(user, { displayName: name }).catch(function (err) {
        console.warn('[NSL] updateProfile failed (non-fatal):', err);
      }).then(function () {
        return FB.sendEmailVerification(user).catch(function (err) {
          console.warn('[NSL] sendEmailVerification failed:', err);
          err._nslAccountCreated = true;
          err._nslStage = 'verification-email';
          throw err;
        });
      }).then(function () {
        return FB.signOut(auth);
      });
    }).then(function () {
      suppressAuthListener = false;
      setLoading(false);
      setMsgHTML(
        'Account created — check <strong>' + sanitize(email) + '</strong> for a verification link, then sign in.',
        'success'
      );
      switchTab('login');
      document.getElementById('login-email').value = email;
    }).catch(function (err) {
      suppressAuthListener = false;
      setLoading(false);

      if (err && err._nslAccountCreated) {
        FB.signOut(auth).catch(function () { });
        setMsgHTML(
          'Account created, but the verification email failed to send. ' +
          'Switch to Sign In and use "Resend verification email" after entering your password.',
          'error'
        );
        switchTab('login');
        document.getElementById('login-email').value = email;
        return;
      }

      setMsg(friendlyError(err.code), 'error');
    });
  }

  function showUnverifiedMessage(email) {
    setMsgHTML(
      'Please verify <strong>' + sanitize(email) + '</strong> before signing in. ' +
      '<button type="button" class="msg-inline-btn" id="resend-verify-btn">Resend verification email</button>',
      'error'
    );
    var btn = document.getElementById('resend-verify-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        var pass = document.getElementById('login-password').value;
        resendVerification(email, pass);
      });
    }
  }

  function resendVerification(email, pass) {
    if (!pass) {
      setMsg('Enter your password above, then tap "Resend verification email" again.', 'error');
      return;
    }
    suppressAuthListener = true;
    FB.signInWithEmailAndPassword(auth, email, pass).then(function (cred) {
      return FB.sendEmailVerification(cred.user).then(function () {
        return FB.signOut(auth);
      });
    }).then(function () {
      suppressAuthListener = false;
      setMsg('Verification email resent — check your inbox (and spam folder).', 'success');
    }).catch(function (err) {
      suppressAuthListener = false;
      setMsg(friendlyError(err.code), 'error');
    });
  }

  function doForgotPassword() {
    if (!auth || !FB) return;
    var email = document.getElementById('login-email').value.trim();
    if (!email) { setMsg('Enter your email address above first.', 'error'); return; }
    if (!email.includes('@')) { setMsg('Enter a valid email address.', 'error'); return; }
    FB.sendPasswordResetEmail(auth, email).then(function () {
      setMsg('Reset email sent — check your inbox (and spam folder).', 'success');
    }).catch(function (err) {
      setMsg(friendlyError(err.code), 'error');
    });
  }

  function enterAsGuest() {
    localStorage.setItem('nsl_user', JSON.stringify({ guest: true }));
    nslEnterApp();
  }

  /* ── Email toggle: reveal tabs/form on demand ── */
  function toggleEmailForm() {
    var wrap = document.getElementById('email-form-wrap');
    var btn = document.getElementById('email-toggle-btn');
    var isHidden = wrap.style.display === 'none';
    wrap.style.display = isHidden ? 'block' : 'none';
    btn.setAttribute('aria-expanded', String(isHidden));
    btn.textContent = isHidden ? 'Hide email sign-in' : 'Use email instead';
  }

  document.getElementById('btn-google').addEventListener('click', handleGoogleLogin);
  document.getElementById('btn-discord').addEventListener('click', handleDiscordWebLogin);
  document.getElementById('main-btn').addEventListener('click', handleEmailSubmit);
  document.getElementById('guest-btn').addEventListener('click', enterAsGuest);
  document.getElementById('forgot-btn').addEventListener('click', doForgotPassword);
  document.getElementById('back-btn').addEventListener('click', nslEnterApp);
  document.getElementById('email-toggle-btn').addEventListener('click', toggleEmailForm);
  document.getElementById('tab-login').addEventListener('click', function () { switchTab('login'); });
  document.getElementById('tab-register').addEventListener('click', function () { switchTab('register'); });
  document.getElementById('reg-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('login-email').focus(); });
  document.getElementById('login-email').addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('login-password').focus(); });
  document.getElementById('login-password').addEventListener('keydown', function (e) { if (e.key === 'Enter') handleEmailSubmit(); });

} /* END !IS_DISCORD */



/* ─────────────────────────────────────────────────────────────
   If the person already has a saved session (web only — Discord
   always re-runs its own handshake/auth flow above), skip the
   login screen and go straight into the app.
───────────────────────────────────────────────────────────────*/
if (!IS_DISCORD && localStorage.getItem('nsl_user')) {
  nslEnterApp();
}