/* ─────────────────────────────────────────────────────────────
 DISCORD DETECTION — must run immediately
───────────────────────────────────────────────────────────── */
/*  block temp
const IS_DISCORD = (
  window.location.hostname.includes('discordsays.com') ||
  window.location.hostname.includes('discord.com') ||
  window.self !== window.top
);
if (IS_DISCORD) document.body.classList.add('discord-activity');
if (IS_DISCORD && window.DiscordSDKLib && window.DiscordSDKLib.patchUrlMappings) {
  try {
    window.DiscordSDKLib.patchUrlMappings([
      { prefix: '/firebase-auth', target: 'identitytoolkit.googleapis.com' },
      { prefix: '/firebase-token', target: 'securetoken.googleapis.com' }
    ], { patchFetch: true, patchXhr: true, patchWebSocket: false, patchSrcAttributes: false });
  } catch (e) { console.warn('patchUrlMappings failed:', e); }
}
*/
/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────── */
/* In nsl
const NSL_KEY_PREFIX = 'nsl_data_';
const NSL_TIMER_KEY = 'nsl_timer_state';
const NSL_UID_KEY = 'nsl_active_uid';

function getUserStorageKey(uid = _uid) {
  if (!uid) return null;
  return `nsl_data_${uid}`;
}

let _db = null;
let _uid = null;
let _authReady = false;

*/
let _domReady = false;
function _tryRender() {
  if (_domReady) doInitialRender();
}
nslOnReady(_tryRender);
nslOnRemoteUpdate(() => {
  // Cloud data changed (e.g. a session finished on another device/page) — refresh the UI.
  refreshAllData(); renderTodos(); renderReminders(); renderGoals();
  const notesEl = document.getElementById('notes-area');
  if (notesEl) notesEl.value = nslLoad().notes || '';
});

/* ─────────────────────────────────────────────────────────────
   DEFAULT DATA SHAPE
───────────────────────────────────────────────────────────── */
/*  block temp
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
    version: 1
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
    version: stored.version || 1
  };
}
*/
/* ─────────────────────────────────────────────────────────────
   LOCAL STORAGE
───────────────────────────────────────────────────────────── */
/*  block temp
function nslLoadLocal() {
  try {
    if (!_uid) return nslDefaults();

    const raw = localStorage.getItem(
      getUserStorageKey()
    );

    return nslMerge(
      raw ? JSON.parse(raw) : null
    );
  } catch (_) {
    return nslDefaults();
  }
}

function nslSaveLocal(data) {
  try {
    if (!_uid) return;

    localStorage.setItem(
      getUserStorageKey(),
      JSON.stringify(data)
    );
  } catch (_) { }
}

function nslClearCache(uid = _uid) {
  if (uid) {
    localStorage.removeItem(
      getUserStorageKey(uid)
    );
  }

  localStorage.removeItem(NSL_TIMER_KEY);
  localStorage.removeItem('nsl_timer_clock');
}
*/
/* ─────────────────────────────────────────────────────────────
   FIRESTORE  (v9 MODULAR API — doc/getDoc/setDoc/deleteDoc)
───────────────────────────────────────────────────────────── */
/*  block temp
function _userDocRef() {
  if (!_db || !_uid) return null;
  return doc(_db, 'users', _uid, 'data', 'nsl');
}

function nslLoad() { return nslLoadLocal(); }

function nslSave(data) {

  console.log("========== SAVE ==========");


  nslSaveLocal(data);

  if (!_uid) {
    console.error("NO UID");
    return;
  }

  if (!_db) {
    console.error("NO FIRESTORE");
    return;
  }

  const ref = _userDocRef();

  console.log("DOC REF:", ref);

  setDoc(ref, data)
    .then(() => {
      console.log("✅ FIRESTORE SAVE SUCCESS");
    })
    .catch(err => {
      console.error("❌ FIRESTORE SAVE FAILED");
      console.error(err);
    });
}

async function nslSyncFromFirestore() {
  if (!_uid || !_db) return;
  try {
    const ref = _userDocRef();

    console.log("========== LOAD ==========");
    console.log("UID:", _uid);
    console.log("PATH:", `users/${_uid}/data/nsl`);

    const snap = await getDoc(ref);

    console.log("DOCUMENT EXISTS:", snap.exists());

    if (snap.exists()) {
      console.log("FIRESTORE DATA:", snap.data());
    }
    if (snap.exists()) {
      const merged = nslMerge(snap.data());
      nslSaveLocal(merged);
      if (_domReady) {
        refreshAllData(); renderTodos(); renderReminders(); renderGoals();
        const notesEl = document.getElementById('notes-area');
        if (notesEl) notesEl.value = merged.notes || '';
      }
    } else {
      const local = nslLoadLocal();
      await setDoc(ref, local).catch(e => console.warn('[NSL] First-push failed:', e));
    }
  } catch (e) {
    console.warn('[NSL] Firestore sync failed (offline?):', e);
  }
}
*/
/* ─────────────────────────────────────────────────────────────
   FIREBASE INIT + AUTH  (single instance, single listener)
───────────────────────────────────────────────────────────── */

const {
  initializeApp, getAuth, onAuthStateChanged,
  getFirestore, signOut,
  doc, getDoc, setDoc, deleteDoc
} = window.FirebaseBundle;

/*  block temp
(function initFirebase() {
  try {
    const app = initializeApp({
      apiKey: 'AIzaSyAmrYGmTuoHP_sY4pG_MFan2CKZPlirbAk',
      authDomain: 'nexus-study-lab.firebaseapp.com',
      projectId: 'nexus-study-lab',
      storageBucket: 'nexus-study-lab.firebasestorage.app',
      messagingSenderId: '610669979476',
      appId: '1:610669979476:web:de9af7a8da3cb71f720ac1'
    });
    _db = getFirestore(app);
    const auth = getAuth(app);
    window._nslSignOut = () => signOut(auth);

    onAuthStateChanged(auth, async user => {
      if (user) {

        console.log("========== LOGIN ==========");
        console.log("UID:", user.uid);
        console.log("EMAIL:", user.email);
        console.log("DISPLAY:", user.displayName);

        */
/* ── UID-change guard: wipe previous user's cache ── */
/*  block temp
const prevUid = localStorage.getItem(NSL_UID_KEY);
if (prevUid && prevUid !== user.uid) {
  console.info('[NSL] User changed');

  localStorage.removeItem(
    getUserStorageKey(prevUid)
  );
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
await nslSyncFromFirestore();
applyUserGreeting();
_authReady = true;
_tryRender();

      } else {
  const cached = JSON.parse(localStorage.getItem('nsl_user') || 'null');
  if (!cached) {
    window.location.href = 'login.html' + window.location.search;
    return;
  }
  _uid = null;
  _authReady = true;
  _tryRender();
}
    });

  } catch (e) {
  console.warn('[NSL] Firebase init failed (offline/Discord?):', e);
  _authReady = true;
  _tryRender();
}
}) ();

*/
/* 
function handleLogout() {
  const params = window.location.search;
  const doRedirect = () => {
    localStorage.removeItem('nsl_user');
    localStorage.removeItem(NSL_UID_KEY);
    document.body.style.transition = 'opacity 0.5s ease';
    document.body.style.opacity = '0';
    setTimeout(() => { window.location.href = 'login.html' + params; }, 520);
  };
  if (window._nslSignOut) window._nslSignOut().then(doRedirect).catch(doRedirect);
  else doRedirect();
}

function resetAllData() {
  if (!confirm('Reset ALL data? This cannot be undone.')) return;
  nslClearCache();
  if (_uid && _db) deleteDoc(_userDocRef()).catch(() => { });
  showToast('🗑', 'Data reset');
  setTimeout(() => location.reload(), 800);
}

/* ─────────────────────────────────────────────────────────────
   DATA HELPERS
───────────────────────────────────────────────────────────── */
function nslTodayMins() {
  const data = nslLoad(), today = new Date().toDateString();
  return data.sessions.filter(s => s.date === today).reduce((a, s) => a + (s.duration || 0), 0);
}
function nslWeeklyMins() {
  const data = nslLoad(), result = [0, 0, 0, 0, 0, 0, 0], now = new Date();
  const dow = now.getDay(), monday = new Date(now);
  monday.setDate(now.getDate() - ((dow + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  data.sessions.forEach(s => {
    const d = new Date(s.ts || s.date), diff = Math.floor((d - monday) / 86400000);
    if (diff >= 0 && diff < 7) result[diff] += (s.duration || 0);
  });
  return result;
}



/* ─────────────────────────────────────────────────────────────
   TIMER SYNC WIDGET
───────────────────────────────────────────────────────────── */
let tswDismissed = false, tswLastState = null, tswTickInterval = null;
const hubFmt = s => String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0') + ':' + String(Math.max(0, s) % 60).padStart(2, '0');
const TSW_CIRC = 2 * Math.PI * 23;

function readTimerState() {
  try { const raw = localStorage.getItem(NSL_TIMER_KEY); if (!raw) return null; return JSON.parse(raw); }
  catch (_) { return null; }
}

function updateSessionStatusUI(state) {
  const isRunning = !!(state && state.running);
  const isPaused = !!(state && !state.running && state.remaining < state.totalSecs);
  const label = state ? (state.label || 'Focus Session') : null;
  let liveRem = state ? state.remaining : 0;
  if (isRunning && state.timerEndsAt) liveRem = Math.max(0, Math.floor((state.timerEndsAt - Date.now()) / 1000));
  const statusText = isRunning ? '⏱ ' + label + ' · ' + hubFmt(liveRem)
    : isPaused ? '⏸ ' + label + ' · paused'
      : 'No active session';
  const ss = document.getElementById('session-status'); if (ss) ss.textContent = statusText;
  const ms = document.getElementById('m-session-status'); if (ms) ms.textContent = statusText;
  const pill = document.getElementById('session-status-pill');
  if (pill) pill.classList.toggle('active-session', isRunning);
  const mobileDot = document.querySelector('.mobile-session-pill .dot');
  if (mobileDot) {
    mobileDot.style.background = isRunning ? '#e8a060' : '';
    mobileDot.style.boxShadow = isRunning ? '0 0 8px #e8a060' : '';
    mobileDot.style.animation = isRunning ? 'none' : '';
  }
  document.querySelectorAll('.live-badge').forEach(badge => {
    badge.classList.remove('idle', 'session-active');
    const textNode = Array.from(badge.childNodes).find(n => n.nodeType === 3);
    if (isRunning) { badge.classList.add('session-active'); if (textNode) textNode.textContent = 'Focusing'; }
    else if (state) { if (textNode) textNode.textContent = 'Live'; }
    else { badge.classList.add('idle'); if (textNode) textNode.textContent = 'Idle'; }
  });
}

function startTswTick(state) {
  if (tswTickInterval) clearInterval(tswTickInterval);
  if (!state || !state.running || !state.timerEndsAt) return;
  tswTickInterval = setInterval(() => {
    if (!tswLastState || !tswLastState.timerEndsAt) return;
    const nowRem = Math.max(0, Math.floor((tswLastState.timerEndsAt - Date.now()) / 1000));
    const timeEl = document.getElementById('tsw-time'); if (timeEl) timeEl.textContent = hubFmt(nowRem);
    const ringFill = document.getElementById('tsw-ring-fill');
    if (ringFill && tswLastState.totalSecs > 0)
      ringFill.style.strokeDashoffset = TSW_CIRC * (1 - nowRem / tswLastState.totalSecs);
    updateSessionStatusUI(tswLastState);
    if (nowRem <= 0) {
      clearInterval(tswTickInterval);
      const w = document.getElementById('timer-sync-widget');
      if (w) w.classList.remove('visible');
      updateSessionStatusUI(null);
    }
  }, 1000);
}
function stopTswTick() { if (tswTickInterval) { clearInterval(tswTickInterval); tswTickInterval = null; } }

function updateTimerSyncWidget(state) {
  const widget = document.getElementById('timer-sync-widget'); if (!widget) return;
  if (!state) { widget.classList.remove('visible'); stopTswTick(); updateSessionStatusUI(null); return; }
  const age = Date.now() - (state.ts || 0);
  if (!state.running && age > 60000) { widget.classList.remove('visible'); stopTswTick(); updateSessionStatusUI(null); return; }
  if (tswDismissed) { updateSessionStatusUI(state); return; }
  let rem = state.remaining;
  if (state.running && state.timerEndsAt) rem = Math.max(0, Math.floor((state.timerEndsAt - Date.now()) / 1000));
  const ringFill = document.getElementById('tsw-ring-fill');
  if (ringFill) {
    const pct = state.totalSecs > 0 ? rem / state.totalSecs : 1;
    ringFill.style.strokeDashoffset = TSW_CIRC * (1 - pct);
    ringFill.style.stroke = state.color || '#e8a060';
    ringFill.style.filter = `drop-shadow(0 0 6px ${state.color || '#e8a060'})`;
  }
  const icon = document.getElementById('tsw-ring-icon');
  if (icon) icon.textContent = state.deepWorkActive ? '🔒' : state.running ? '▶' : '⏸';
  const label = document.getElementById('tsw-label'); if (label) label.textContent = state.label || 'Focus Session';
  const timeEl = document.getElementById('tsw-time');
  if (timeEl) { timeEl.textContent = hubFmt(rem); timeEl.className = 'tsw-time' + (state.running ? ' running' : ''); }
  const dot = document.getElementById('tsw-status-dot'), txt = document.getElementById('tsw-status-txt');
  if (state.deepWorkActive) { if (dot) dot.className = 'tsw-status-dot deep'; if (txt) txt.textContent = 'Deep Work locked'; }
  else if (state.running) { if (dot) dot.className = 'tsw-status-dot live'; if (txt) txt.textContent = 'Running · returns on ↗'; }
  else { if (dot) dot.className = 'tsw-status-dot paused'; if (txt) txt.textContent = 'Paused'; }
  widget.classList.add('visible');
  tswLastState = state;
  updateSessionStatusUI(state);
  if (state.running && state.timerEndsAt) startTswTick(state); else stopTswTick();
}

function initTimerSyncWidget() {
  const state = readTimerState();
  updateTimerSyncWidget(state);
  updateSessionStatusUI(state);

  window.addEventListener('storage', handleStorageSync);

  setInterval(() => {
    const s = readTimerState();
    if (!tswTickInterval || !s || !s.running) updateTimerSyncWidget(s);
  }, 3000);

  document.getElementById('tsw-go-btn').addEventListener('click', openFocusApp);
  document.getElementById('tsw-dismiss-btn').addEventListener('click', () => {
    tswDismissed = true; stopTswTick();
    document.getElementById('timer-sync-widget').classList.remove('visible');
  });
}

function handleStorageSync(e) {
  if (e.key === NSL_TIMER_KEY) {
    tswDismissed = false;
    updateTimerSyncWidget(e.newValue ? JSON.parse(e.newValue) : null);
    refreshAllData();
  }
  if (e.key === getUserStorageKey()) {
    refreshAllData(); renderTodos(); renderReminders(); renderGoals();
    showToast('⚡', 'Session synced!');
  }
}

/* Periodic same-tab refresh (catches missed storage events) */
let _lastDataHash = '';
setInterval(() => {
  try {
    const key = getUserStorageKey();
    if (!key) return;
    const raw = localStorage.getItem(key) || '';
    if (raw !== _lastDataHash) { _lastDataHash = raw; refreshAllData(); }
  } catch (_) { }
}, 5000);


function playReminderChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.32);
    });
  } catch (e) { console.warn('[NSL] chime failed:', e); }
}

/* ─────────────────────────────────────────────────────────────
   REMINDER NOTIFICATIONS (in-app toast, works on web + Discord)
───────────────────────────────────────────────────────────── */
const _nslFiredReminders = new Set();
function checkReminders() {
  const data = nslLoad();
  if (!data.reminders || data.reminders.length === 0) return;

  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const nowStr = `${hh}:${mm}`;
  const dayStr = now.toDateString();

  console.log('[NSL reminder check]', nowStr, data.reminders.map(r => r.time + '/' + r.on));

  data.reminders.forEach(r => {
    if (!r.on || r.time !== nowStr) return;
    const fireKey = `${r.id}_${dayStr}_${nowStr}`;
    if (_nslFiredReminders.has(fireKey)) return;
    _nslFiredReminders.add(fireKey);
    showToast(r.icon || '🔔', r.name || 'Reminder');
    playReminderChime();
  });
}

function playReminderChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.32);
    });
  } catch (e) { console.warn('[NSL] chime failed:', e); }
}

/* ─────────────────────────────────────────────────────────────
   THEME / PARTICLES
───────────────────────────────────────────────────────────── */
let manualTheme = null;
function isNightTime() { const h = new Date().getHours(); return h < 6 || h >= 19; }
function applyTheme(night) {
  document.body.classList.toggle('night', night);
  [['theme-icon-sun', 'theme-icon-moon'], ['m-theme-sun', 'm-theme-moon']].forEach(([s, m]) => {
    const se = document.getElementById(s), me = document.getElementById(m);
    if (se && me) { se.style.display = night ? 'block' : 'none'; me.style.display = night ? 'none' : 'block'; }
  });
}
function toggleTheme() {
  const isNight = document.body.classList.contains('night');
  manualTheme = isNight ? 'day' : 'night';
  applyTheme(!isNight);
  showToast(isNight ? '☀' : '☽', isNight ? 'Day mode' : 'Night mode');
}
function setManualTheme(m) {
  manualTheme = m;
  if (m === 'auto') { applyTheme(isNightTime()); showToast('✶', 'Theme: Auto'); }
  else if (m === 'day') { applyTheme(false); showToast('☀', 'Day mode'); }
  else { applyTheme(true); showToast('☽', 'Night mode'); }
}

let particlesEnabled = !IS_DISCORD;
function spawnParticles() {
  if (IS_DISCORD) return;
  const wrap = document.getElementById('particles-wrap');
  for (let i = 0; i < 50; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 5 + 2;
    const x = Math.random() * 100;
    const dur = Math.random() * 22 + 16;
    const delay = Math.random() * 22;
    const drift = (Math.random() - .5) * 120 + 'px';
    p.style.cssText = `width:${size}px;height:${size}px;left:${x}vw;animation-duration:${dur}s;animation-delay:-${delay}s;--drift:${drift}`;
    wrap.appendChild(p);
  }
}
spawnParticles();

function toggleParticles() {
  const btn = document.getElementById('toggle-particles');
  particlesEnabled = !particlesEnabled;
  if (btn) btn.classList.toggle('on', particlesEnabled);
  document.getElementById('particles-wrap').style.opacity = particlesEnabled ? '1' : '0';
}

/* ─────────────────────────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────────────────────────── */
function showView(name) {
  document.querySelectorAll('.section-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const view = document.getElementById('view-' + name);
  if (view) view.classList.add('active');
  const btn = document.getElementById('nav-' + name);
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  const bnav = document.getElementById('bnav-' + name);
  if (bnav) bnav.classList.add('active');
  if (window.innerWidth <= 640) window.scrollTo({ top: 0, behavior: 'smooth' });
  if (['streak', 'analytics', 'calendar'].includes(name)) refreshAllData();
}
function openMobileDrawer() { document.getElementById('more-drawer').classList.add('open'); }
function closeMobileDrawer() { document.getElementById('more-drawer').classList.remove('open'); }

/* ─────────────────────────────────────────────────────────────
   CLOCK & GREETING
───────────────────────────────────────────────────────────── */
function updateClock() {
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = now.getHours(), m = String(now.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM', h12 = (h % 12) || 12;
  const dateStr = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()} · ${h12}:${m} ${ampm}`;
  const dtEl = document.getElementById('current-date-time'); if (dtEl) dtEl.textContent = dateStr;
  const mDate = document.getElementById('mobile-date');
  if (mDate) mDate.textContent = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
  const greet = h < 5 ? 'Burning the midnight oil' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night';
  ['greeting-text', 'mobile-greeting'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = `${greet}, Scholar ✶`;
  });
}
updateClock();
setInterval(updateClock, 1000);
setInterval(() => { if (!manualTheme || manualTheme === 'auto') applyTheme(isNightTime()); }, 60000);

/* ─────────────────────────────────────────────────────────────
   DATA REFRESH
───────────────────────────────────────────────────────────── */
function refreshAllData() {
  const data = nslLoad();
  refreshStreakUI(data); refreshDashboardStats(data); refreshAnalytics(data);
  refreshCalendarStats(data); refreshFocusStats(data); refreshSettingsStats(data);
}
function setTxt(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

function refreshStreakUI(data) {
  const s = data.streak;
  setTxt('current-streak', s.current); setTxt('streak-big-num', s.current);
  setTxt('longest-streak', s.longest); setTxt('total-days', s.totalDays);
  setTxt('dash-streak', s.current); setTxt('dash-longest', s.longest);
  const msgEl = document.getElementById('streak-msg');
  if (msgEl) msgEl.textContent = s.current === 0 ? 'Complete your first session to start your streak!'
    : s.current === 1 ? 'day streak · great start!' : 'day streak · keep it going!';
  const ringEl = document.getElementById('dash-streak-ring');
  if (ringEl) ringEl.style.strokeDashoffset = 188.5 * (1 - Math.min(1, s.current / 30));
  const last7 = data.sessions.filter(ss => (new Date() - new Date(ss.ts || ss.date)) < 7 * 86400000);
  const activeDays7 = new Set(last7.map(ss => ss.date)).size;
  const pct7 = s.totalDays > 0 ? Math.round((activeDays7 / 7) * 100) : null;
  setTxt('weekly-pct', pct7 !== null ? pct7 + '%' : '—');
  const xpCap = data.xp.level * 500, xpPct = xpCap > 0 ? Math.min(100, Math.round((data.xp.today / xpCap) * 100)) : 0;
  setTxt('streak-xp-today', data.xp.today); setTxt('streak-xp-cap', 'of ' + xpCap + ' XP today');
  setTxt('streak-level-lbl', 'Level ' + data.xp.level + ' Scholar'); setTxt('streak-xp-pct', xpPct + '%');
  setTxt('streak-bonus', s.current >= 7 ? '×2' : s.current >= 3 ? '×1.5' : '×1');
  const sxBar = document.getElementById('streak-xp-bar'); if (sxBar) sxBar.style.width = xpPct + '%';
  const dxFill = document.getElementById('dash-xp-fill'); if (dxFill) dxFill.style.width = xpPct + '%';
  setTxt('dash-level-lbl', 'Level ' + data.xp.level); setTxt('dash-xp-val', data.xp.today + ' XP today');
  renderWeekDots(s.weekDays); renderMoodHistory(data.moods);
}

function refreshDashboardStats(data) {
  const todayMins = nslTodayMins(), h = Math.floor(todayMins / 60), m = todayMins % 60;
  setTxt('today-hours', h); setTxt('today-mins', m);
  const mHours = document.getElementById('m-hours');
  if (mHours) mHours.textContent = h > 0 ? `${h}h${m}m` : `${m}m`;
  setTxt('m-streak', data.streak.current); setTxt('m-xp', data.xp.today);
  const xpCap = data.xp.level * 500, xpPct = xpCap > 0 ? Math.min(100, Math.round((data.xp.today / xpCap) * 100)) : 0;
  const mXpBar = document.getElementById('m-xp-bar'); if (mXpBar) mXpBar.style.width = xpPct + '%';
  setTxt('m-level-label', 'Level ' + data.xp.level + ' Scholar · Daily XP');
  setTxt('m-xp-label', data.xp.today + ' / ' + xpCap);
  const changeEl = document.getElementById('today-change');
  if (changeEl) {
    if (todayMins === 0) { changeEl.className = 'stat-change neutral'; changeEl.textContent = 'Start your first session!'; }
    else { changeEl.className = 'stat-change up'; changeEl.textContent = '↑ ' + todayMins + ' min today'; }
  }
  renderTodayMiniBar(data);
  renderWeekChart('week-chart-dash', 'week-labels-dash');
  renderWeekChart('week-chart', 'week-labels');
  const today = new Date().toDateString(), todayMood = data.moods[today];
  if (todayMood) {
    document.querySelectorAll('#dash-mood-row .mood-btn').forEach(btn => {
      const sp = btn.querySelector('span:first-child');
      btn.classList.toggle('selected', sp && sp.textContent === todayMood);
    });
  }
}

function refreshAnalytics(data) {
  const today = new Date().toDateString(), ts = data.sessions.filter(s => s.date === today);
  const listEl = document.getElementById('today-sessions-list');
  if (listEl) {
    if (ts.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><div class="em-icon">⏱</div><div class="em-title">No sessions yet</div><div class="em-sub">Start a focus session to see your activity</div></div>';
    } else {
      listEl.innerHTML = '';
      ts.forEach(s => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:12px 14px;border-radius:11px;background:rgba(255,255,255,0.03);border:1px solid var(--border);display:flex;align-items:center;gap:12px;margin-bottom:8px';
        div.innerHTML = `<div style="width:36px;height:36px;border-radius:9px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--accent);flex-shrink:0">①</div><div><div style="font-size:13px;color:var(--text-main)">${s.label || 'Focus Session'}</div><div style="font-size:11px;color:var(--text-dim)">${new Date(s.ts || s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${s.duration} min</div></div><div style="margin-left:auto;font-size:12px;color:var(--green)">+${(s.duration || 0) * 5} XP</div>`;
        listEl.appendChild(div);
      });
    }
  }
  const totalMins = data.sessions.reduce((a, s) => a + (s.duration || 0), 0);
  setTxt('analytics-total-mins', totalMins >= 60 ? (totalMins / 60).toFixed(1) + 'h' : totalMins + 'm');
  setTxt('analytics-sessions', data.sessions.length);
}

function refreshCalendarStats(data) {
  const now = new Date(), ninety = now.getTime() - 90 * 86400000;
  const recent = data.sessions.filter(s => new Date(s.ts || s.date).getTime() >= ninety);
  const activeDays = new Set(recent.map(s => s.date)).size;
  const totalMins = recent.reduce((a, s) => a + (s.duration || 0), 0);
  const totalH = (totalMins / 60).toFixed(1);
  const avgH = activeDays > 0 ? (totalMins / 60 / activeDays).toFixed(1) : '0';
  const consist = activeDays > 0 ? Math.round((activeDays / 90) * 100) + '%' : '—';
  setTxt('cal-active-days', activeDays); setTxt('cal-total-h', totalH + 'h');
  setTxt('cal-avg', avgH + 'h'); setTxt('cal-consistency', consist);
  renderHeatmapFromData(data.sessions);
}

function refreshFocusStats(data) {
  const today = new Date().toDateString(), ts = data.sessions.filter(s => s.date === today);
  const tm = ts.reduce((a, s) => a + (s.duration || 0), 0);
  setTxt('focus-sessions-today', ts.length);
  setTxt('focus-total-today', tm >= 60 ? Math.floor(tm / 60) + 'h' + (tm % 60) + 'm' : tm + 'm');
}

function refreshSettingsStats(data) {
  const totalMins = data.sessions.reduce((a, s) => a + (s.duration || 0), 0);
  setTxt('settings-sessions', data.sessions.length);
  setTxt('settings-hours', (totalMins / 60).toFixed(1) + 'h');
  setTxt('settings-streak', data.streak.current);
}

/* ── YEAR CALENDAR ── */
let ycalMonth, ycalYear;
function initYearCalendarState() { const n = new Date(); ycalMonth = n.getMonth(); ycalYear = n.getFullYear(); }
function daysInYear(y) { return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365; }
function renderYearProgress() {
  const now = new Date();

  /* ── YEAR ── */
  const yStart = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now - yStart) / 86400000) + 1;
  const yTotal = daysInYear(now.getFullYear());
  const yLeft = yTotal - dayOfYear;
  const yPct = Math.round((dayOfYear / yTotal) * 100);
  setTxt('yearcal-pct', yPct + '%');
  setTxt('yearcal-daysleft', yLeft);
  setTxt('yearcal-yearnum', now.getFullYear());
  setTxt('yearcal-dayof', dayOfYear);
  setTxt('yearcal-total', yTotal);
  const yRing = document.getElementById('yearcal-ring'); if (yRing) yRing.style.strokeDashoffset = 226.2 * (1 - yPct / 100);
  const sub = document.getElementById('yearcal-subtitle'); if (sub) sub.textContent = yLeft + ' days remaining in ' + now.getFullYear();

  /* ── MONTH ── */
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const mTotal = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const mDayOf = now.getDate();
  const mLeft = mTotal - mDayOf;
  const mPct = Math.round((mDayOf / mTotal) * 100);
  setTxt('monthcal-pct', mPct + '%');
  setTxt('monthcal-daysleft', mLeft);
  setTxt('monthcal-monthname', monthNames[now.getMonth()]);
  setTxt('monthcal-dayof', mDayOf);
  setTxt('monthcal-total', mTotal);
  const mRing = document.getElementById('monthcal-ring'); if (mRing) mRing.style.strokeDashoffset = 226.2 * (1 - mPct / 100);

  /* ── DAY ── */
  const secsIntoDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const dPct = Math.round((secsIntoDay / 86400) * 100);
  const secsLeft = 86400 - secsIntoDay;
  const hLeft = Math.floor(secsLeft / 3600), mLeft2 = Math.floor((secsLeft % 3600) / 60);
  setTxt('daycal-pct', dPct + '%');
  setTxt('daycal-hoursleft', hLeft + 'h ' + mLeft2 + 'm');
  const dRing = document.getElementById('daycal-ring'); if (dRing) dRing.style.strokeDashoffset = 226.2 * (1 - dPct / 100);
}

function renderMonthGrid() {
  const grid = document.getElementById('ycal-grid'), dowWrap = document.getElementById('ycal-dow'), label = document.getElementById('ycal-monthlabel');
  if (!grid) return;
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dows = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  if (dowWrap && !dowWrap.dataset.built) { dows.forEach(d => { const s = document.createElement('span'); s.textContent = d; dowWrap.appendChild(s); }); dowWrap.dataset.built = '1'; }
  label.textContent = monthNames[ycalMonth] + ' ' + ycalYear;
  grid.innerHTML = '';
  const first = new Date(ycalYear, ycalMonth, 1), startDow = first.getDay();
  const numDays = new Date(ycalYear, ycalMonth + 1, 0).getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 0; i < startDow; i++) { const e = document.createElement('div'); e.className = 'ycal-cell empty'; grid.appendChild(e); }
  for (let d = 1; d <= numDays; d++) {
    const cellDate = new Date(ycalYear, ycalMonth, d);
    const cell = document.createElement('div'); cell.className = 'ycal-cell';
    if (cellDate.getTime() === today.getTime()) cell.classList.add('today');
    else if (cellDate.getTime() < today.getTime()) cell.classList.add('past');
    cell.textContent = d;
    grid.appendChild(cell);
  }
}

function ycalChangeMonth(delta) {
  ycalMonth += delta;
  if (ycalMonth < 0) { ycalMonth = 11; ycalYear--; }
  else if (ycalMonth > 11) { ycalMonth = 0; ycalYear++; }
  renderMonthGrid();
}
//init
function initYearCalendar() {
  initYearCalendarState();
  renderYearProgress();
  renderMonthGrid();
  setInterval(renderYearProgress, 30000); // was 60000 — update twice as often for the day ring
}
/* ─────────────────────────────────────────────────────────────
   RENDER HELPERS
───────────────────────────────────────────────────────────── */
function renderHeatmapFromData(sessions) {
  const grid = document.getElementById('heatmap'); if (!grid) return;
  grid.innerHTML = '';
  const dayMap = {};
  sessions.forEach(s => { dayMap[s.date] = (dayMap[s.date] || 0) + (s.duration || 0); });
  for (let i = 89; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toDateString(), mins = dayMap[dateStr] || 0;
    const h = mins === 0 ? 0 : mins < 30 ? 1 : mins < 60 ? 2 : mins < 120 ? 3 : mins < 180 ? 4 : 5;
    const cell = document.createElement('div');
    cell.className = 'hm-cell'; cell.setAttribute('data-h', h);
    cell.title = `${d.toLocaleDateString()}: ${mins} min`;
    grid.appendChild(cell);
  }
  const leg = document.getElementById('hm-legend-cells'); if (!leg) return;
  leg.innerHTML = '';
  for (let i = 0; i <= 5; i++) {
    const c = document.createElement('div');
    c.style.cssText = `width:12px;height:12px;border-radius:3px;background:${i === 0 ? 'rgba(255,255,255,0.04)' : `rgba(232,149,42,${[0.15, 0.3, 0.5, 0.75, 0.95][i - 1]})`}`;
    leg.appendChild(c);
  }
}

function renderWeekChart(cid, lid) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = nslWeeklyMins().map(m => +(m / 60).toFixed(1));
  const max = Math.max(0.1, ...hours);
  const chart = document.getElementById(cid), labels = document.getElementById(lid);
  if (!chart) return;
  chart.innerHTML = ''; if (labels) labels.innerHTML = '';
  const todayIdx = (new Date().getDay() + 6) % 7;
  days.forEach((d, i) => {
    const bar = document.createElement('div');
    bar.className = 'chart-bar' + (i === todayIdx ? ' today' : '');
    bar.style.height = (hours[i] / max * 100) + '%';
    bar.title = `${d}: ${hours[i]}h`;
    chart.appendChild(bar);
    if (labels) { const lbl = document.createElement('span'); lbl.textContent = d[0]; labels.appendChild(lbl); }
  });
}

function renderTodayMiniBar(data) {
  const wrap = document.getElementById('today-mini-bars'); if (!wrap) return;
  wrap.innerHTML = '';
  const today = new Date().toDateString(), ts = data.sessions.filter(s => s.date === today);
  if (ts.length === 0) {
    for (let i = 0; i < 8; i++) { const b = document.createElement('div'); b.className = 'mini-bar'; b.style.height = '5%'; wrap.appendChild(b); }
    return;
  }
  const maxD = Math.max(1, ...ts.map(s => s.duration));
  ts.slice(-8).forEach(s => {
    const b = document.createElement('div'); b.className = 'mini-bar';
    b.style.height = Math.max(5, Math.round((s.duration / maxD) * 100)) + '%';
    wrap.appendChild(b);
  });
}

function renderWeekDots(doneDays) {
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'], today = new Date().getDay();
  const wrap = document.getElementById('week-dots'); if (!wrap) return;
  wrap.innerHTML = '';
  labels.forEach((l, i) => {
    const d = document.createElement('div');
    d.className = 'week-dot' + (doneDays.includes(i) ? ' done' : '') + (i === today ? ' today' : '');
    d.innerHTML = `<span style="font-size:13px">${doneDays.includes(i) ? '✓' : l}</span><span class="wd">${l}</span>`;
    wrap.appendChild(d);
  });
}

function renderMoodHistory(moods) {
  const wrap = document.getElementById('mood-history-week'); if (!wrap) return;
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const now = new Date(), dow = now.getDay(), monday = new Date(now);
  monday.setDate(now.getDate() - ((dow + 6) % 7)); monday.setHours(0, 0, 0, 0);
  wrap.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const dStr = d.toDateString(), emoji = moods[dStr] || null;
    const col = document.createElement('div'); col.className = 'mood-bar-day';
    col.innerHTML = `<div class="mood-bar-dot${emoji ? ' filled' : ''}">${emoji || dayLabels[i]}</div><span class="mood-bar-lbl">${days[i]}</span>`;
    wrap.appendChild(col);
  }
}

/* ─────────────────────────────────────────────────────────────
   TIMER
───────────────────────────────────────────────────────────── */
let timerInterval = null, timerRunning = false, timerTotal = 25 * 60, timerRemaining = 25 * 60;

function setPreset(mins, el) {
  if (timerRunning) return;
  timerTotal = mins * 60; timerRemaining = timerTotal; updateTimerDisplay();
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
}

function updateTimerDisplay() {
  const m = Math.floor(timerRemaining / 60), s = String(timerRemaining % 60).padStart(2, '0');
  const text = `${m}:${s}`;
  ['dash-timer-display', 'focus-timer-display'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = text; });
  const pct = timerRemaining / timerTotal;
  const c1 = document.getElementById('dash-timer-circle'), c2 = document.getElementById('focus-timer-circle');
  if (c1) c1.style.strokeDashoffset = 326.7 * (1 - pct);
  if (c2) c2.style.strokeDashoffset = 490 * (1 - pct);
}

function hubToggleTimer() {
  timerRunning = !timerRunning;
  ['dash-timer-btn', 'focus-timer-btn'].forEach(id => {
    const b = document.getElementById(id); if (b) b.textContent = timerRunning ? 'Pause' : 'Resume';
  });
  ['dash-timer-status', 'focus-timer-status'].forEach(id => {
    const s = document.getElementById(id); if (s) s.textContent = timerRunning ? 'focusing…' : 'paused';
  });
  if (timerRunning) {
    timerInterval = setInterval(() => {
      if (timerRemaining <= 0) { clearInterval(timerInterval); timerRunning = false; onTimerComplete(Math.round(timerTotal / 60)); return; }
      timerRemaining--; updateTimerDisplay();
    }, 1000);
  } else { clearInterval(timerInterval); }
}

function hubResetTimer() {
  clearInterval(timerInterval); timerRunning = false; timerRemaining = timerTotal; updateTimerDisplay();
  ['dash-timer-btn', 'focus-timer-btn'].forEach(id => { const b = document.getElementById(id); if (b) b.textContent = 'Start'; });
  ['dash-timer-status', 'focus-timer-status'].forEach(id => { const s = document.getElementById(id); if (s) s.textContent = 'ready'; });
}

function onTimerComplete(durationMins) {
  ['dash-timer-btn', 'focus-timer-btn'].forEach(id => { const b = document.getElementById(id); if (b) b.textContent = 'Start'; });
  ['dash-timer-status', 'focus-timer-status'].forEach(id => { const s = document.getElementById(id); if (s) s.textContent = 'done!'; });
  const data = nslLoad(), today = new Date().toDateString(), xpGained = durationMins * 5;
  data.sessions.push({ date: today, duration: durationMins, label: 'Focus Session', ts: Date.now() });
  data.xp.today += xpGained; data.xp.totalXP += xpGained;
  data.xp.level = Math.floor(1 + data.xp.totalXP / 500);
  const last = data.streak.lastStudyDate, nowDate = new Date(); nowDate.setHours(0, 0, 0, 0);
  const dayOfWeek = new Date().getDay();
  if (!data.streak.weekDays.includes(dayOfWeek)) data.streak.weekDays.push(dayOfWeek);
  if (last !== today) {
    if (last) {
      const lastDate = new Date(last); lastDate.setHours(0, 0, 0, 0);
      const diff = Math.round((nowDate - lastDate) / 86400000);
      data.streak.current = diff === 1 ? data.streak.current + 1 : 1;
    } else { data.streak.current = 1; }
    if (data.streak.current > data.streak.longest) data.streak.longest = data.streak.current;
    data.streak.totalDays++; data.streak.lastStudyDate = today;
  }
  nslSave(data); refreshAllData(); showToast('✶', 'Session done! +' + xpGained + ' XP');
  timerRemaining = timerTotal; updateTimerDisplay();
}

/* ─────────────────────────────────────────────────────────────
   MOOD / TODOS / REMINDERS / GOALS / NOTES
───────────────────────────────────────────────────────────── */
function selectMood(btn) {
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const emoji = btn.dataset.emoji, label = btn.dataset.label, data = nslLoad();
  data.moods[new Date().toDateString()] = emoji;
  nslSave(data); showToast(emoji, 'Mood: ' + label);
}

function renderTodos() {
  const data = nslLoad(), todos = data.todos, list = document.getElementById('todo-list');
  if (!list) return;
  list.innerHTML = '';
  const active = todos.filter(t => !t.done), done = todos.filter(t => t.done);
  setTxt('todo-count', active.length + ' left');
  if (todos.length === 0) {
    list.innerHTML = '<div class="empty-state" style="padding:20px 0"><div class="em-icon">✅</div><div class="em-title">No tasks yet</div><div class="em-sub">Add your first task above</div></div>';
    return;
  }
  [...active, ...done].forEach(t => {
    const item = document.createElement('div');
    item.className = 'todo-item' + (t.done ? ' done' : '');
    item.innerHTML = `<div class="todo-check${t.done ? ' checked' : ''}" data-id="${t.id}"></div><span class="todo-text">${t.text}</span><span class="priority-tag p-${t.priority}">${t.priority}</span><button class="todo-del" data-id="${t.id}">×</button>`;
    list.appendChild(item);
  });
}

function addTodo() {
  const input = document.getElementById('todo-input'), text = input ? input.value.trim() : '';
  if (!text) return;
  const data = nslLoad();
  data.todos.push({ id: Date.now(), text, priority: 'mid', done: false });
  nslSave(data); input.value = ''; renderTodos(); showToast('✶', 'Task added');
}

function toggleTodo(id) {
  const data = nslLoad(), t = data.todos.find(t => t.id === id);
  if (t) { t.done = !t.done; nslSave(data); renderTodos(); }
}

function deleteTodo(id) {
  const data = nslLoad();
  data.todos = data.todos.filter(t => t.id !== id);
  nslSave(data); renderTodos();
}

function renderReminders() {
  const data = nslLoad(), list = document.getElementById('reminder-list');
  if (!list) return;
  list.innerHTML = '';
  data.reminders.forEach(r => {
    const item = document.createElement('div'); item.className = 'reminder-item';
    item.innerHTML = `<span class="reminder-icon">${r.icon}</span><div class="reminder-info"><div class="reminder-name">${r.name}</div><div class="reminder-time">${r.time}</div></div><button class="reminder-toggle${r.on ? ' on' : ''}" data-id="${r.id}"></button><button class="todo-del reminder-del" data-id="${r.id}" title="Remove reminder">×</button>`;
    list.appendChild(item);
  });
}

function toggleReminder(id) {
  const data = nslLoad(), r = data.reminders.find(r => r.id === id);
  if (r) { r.on = !r.on; nslSave(data); renderReminders(); }
}
function deleteReminder(id) {
  const data = nslLoad();
  data.reminders = data.reminders.filter(r => r.id !== id);
  nslSave(data); renderReminders(); showToast('✶', 'Reminder removed');
}
function renderGoals() {
  const data = nslLoad(), list = document.getElementById('goal-list');
  if (!list) return;
  list.innerHTML = '';
  const emptyEl = document.getElementById('goals-empty');
  if (emptyEl) emptyEl.style.display = data.goals.length === 0 ? 'block' : 'none';
  data.goals.forEach(g => {
    const pct = Math.min(100, Math.round((g.current / g.target) * 100)), item = document.createElement('div');
    item.className = 'goal-item';
    item.innerHTML = `<div class="goal-header"><span class="goal-name">${g.name}</span><div style="display:flex;align-items:center;gap:6px"><button class="goal-adj" data-id="${g.id}" data-delta="-0.5" title="Subtract 30 min">−</button><span class="goal-pct" data-id="${g.id}" title="Click to set progress">${pct}% · ${g.current}/${g.target}h</span><button class="goal-adj" data-id="${g.id}" data-delta="0.5" title="Add 30 min">+</button><button class="todo-del goal-del" data-id="${g.id}" title="Remove goal">×</button></div></div><div class="goal-bar-track"><div class="goal-bar-fill" style="width:0%"></div></div>`;
    list.appendChild(item);
    setTimeout(() => { item.querySelector('.goal-bar-fill').style.width = pct + '%'; }, 100);
  });
}
function deleteGoal(id) {
  const data = nslLoad();
  data.goals = data.goals.filter(g => g.id !== id);
  nslSave(data); renderGoals(); showToast('✶', 'Goal removed');
}
function adjustGoalProgress(id, delta) {
  const data = nslLoad(), g = data.goals.find(g => g.id === id);
  if (!g) return;
  const wasComplete = g.current >= g.target;
  g.current = Math.max(0, Math.round((g.current + delta) * 100) / 100);
  nslSave(data); renderGoals();
  if (!wasComplete && g.current >= g.target) showToast('🎯', g.name + ' goal complete!');
}
function setGoalProgress(id) {
  const data = nslLoad(), g = data.goals.find(g => g.id === id);
  if (!g) return;
  const input = prompt('Set progress for "' + g.name + '" (hours):', g.current);
  if (input === null) return;
  const val = parseFloat(input);
  if (isNaN(val) || val < 0) return;
  const wasComplete = g.current >= g.target;
  g.current = Math.round(val * 100) / 100;
  nslSave(data); renderGoals();
  if (!wasComplete && g.current >= g.target) showToast('🎯', g.name + ' goal complete!');
}

function initNotes() {
  const area = document.getElementById('notes-area'); if (!area) return;
  const data = nslLoad(); area.value = data.notes || ''; updateNotesCount();
  let timer;
  area.addEventListener('input', () => {
    updateNotesCount(); clearTimeout(timer);
    const saved = document.getElementById('notes-saved'); if (saved) saved.textContent = 'Saving…';
    timer = setTimeout(() => {
      const d = nslLoad(); d.notes = area.value; nslSave(d);
      const s2 = document.getElementById('notes-saved'); if (s2) s2.textContent = '✶ Auto-saved';
    }, 800);
  });
}
function updateNotesCount() {
  const area = document.getElementById('notes-area'), count = document.getElementById('notes-count');
  if (area && count) count.textContent = area.value.length + ' chars';
}

/* ─────────────────────────────────────────────────────────────
   QUOTES
───────────────────────────────────────────────────────────── */
const quotes = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Study hard what interests you the most in the most undisciplined way possible.", author: "Richard Feynman" },
  { text: "Education is not the filling of a pail, but the lighting of a fire.", author: "W.B. Yeats" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "Wisdom is not a product of schooling but of the lifelong attempt to acquire it.", author: "Albert Einstein" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" }
];
let quoteIdx = 0, quoteTimer;

function showQuote(idx) {
  const q = quotes[idx], textEl = document.getElementById('quote-text'), authEl = document.getElementById('quote-author');
  if (!textEl) return;
  textEl.style.opacity = 0; authEl.style.opacity = 0;
  setTimeout(() => {
    textEl.textContent = '\u201c' + q.text + '\u201d'; authEl.textContent = '— ' + q.author;
    textEl.style.transition = 'opacity 0.8s'; authEl.style.transition = 'opacity 0.8s 0.2s';
    textEl.style.opacity = 1; authEl.style.opacity = 1;
  }, 300);
  document.querySelectorAll('.quote-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
}

function initQuotes() {
  const dots = document.getElementById('quote-dots'); if (!dots) return;
  quotes.forEach((_, i) => {
    const d = document.createElement('div'); d.className = 'quote-dot' + (i === 0 ? ' active' : '');
    d.dataset.idx = i; dots.appendChild(d);
  });
  showQuote(0);
  quoteTimer = setInterval(() => { quoteIdx = (quoteIdx + 1) % quotes.length; showQuote(quoteIdx); }, 9000);
}

/* ─────────────────────────────────────────────────────────────
   MODALS / TOAST / GREETING
───────────────────────────────────────────────────────────── */
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function showToast(icon, msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-icon').textContent = icon;
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function applyUserGreeting() {
  try {
    const user = JSON.parse(localStorage.getItem('nsl_user') || '{}');
    let name = 'Scholar';
    if (user.guest) name = 'Guest';
    else if (user.name) name = user.name.split(' ')[0];
    else if (user.email) {
      const local = user.email.split('@')[0].replace(/[._\-+]/g, ' ').split(' ');
      name = local[0].charAt(0).toUpperCase() + local[0].slice(1);
    }
    ['sidebar-avatar', 'mobile-avatar'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = name.charAt(0).toUpperCase();
    });
    const h = new Date().getHours();
    const greet = h < 5 ? 'Burning the midnight oil' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night';
    ['greeting-text', 'mobile-greeting'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = `${greet}, ${name} ✶`;
    });
  } catch (_) { }
}
function openFocusApp() {
  if (typeof nslShowView === 'function') {
    // Merged single-page mode (app.html): switch views in place, no navigation,
    // so the Discord Activity SDK's RPC handshake never gets torn down.
    nslShowView('focus');
    return;
  }
  // Standalone streak.html on a normal browser tab: real navigation is fine.
  document.body.style.transition = 'opacity 0.5s ease';
  document.body.style.opacity = '0';
  setTimeout(() => { window.location.href = nslPreserveDiscordParams('app.html'); }, 520);
}

/* ─────────────────────────────────────────────────────────────
   doInitialRender — fires once both DOM and auth are ready.
   This replaces the old direct calls at the bottom of
   DOMContentLoaded so render never runs before auth resolves.
───────────────────────────────────────────────────────────── */
function doInitialRender() {
  applyTheme(isNightTime());
  applyUserGreeting();
  refreshAllData();
  renderTodos();
  renderReminders();
  renderGoals();
  initNotes();
  initQuotes();
  updateTimerDisplay();
  initTimerSyncWidget();
  initYearCalendar();
}

/* ─────────────────────────────────────────────────────────────
   DOM READY — wires up all event listeners.
   doInitialRender() is NOT called directly here — it's called
   by _tryRender() once auth has also resolved (see Firebase
   init block above).
───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  /* ── Sidebar nav ── */
  ['dashboard', 'streak', 'analytics', 'calendar', 'tasks', 'yearcal', 'goals', 'notes', 'focus', 'settings'].forEach(v => {
    const btn = document.getElementById('nav-' + v);
    if (btn) btn.addEventListener('click', () => showView(v));
  });

  /* ── Bottom nav ── */
  ['dashboard', 'tasks', 'focus', 'streak'].forEach(v => {
    const btn = document.getElementById('bnav-' + v);
    if (btn) btn.addEventListener('click', () => { showView(v); closeMobileDrawer(); });
  });
  document.getElementById('bnav-more-btn').addEventListener('click', openMobileDrawer);

  /* ── Drawer ── */
  document.querySelectorAll('.drawer-item[data-view]').forEach(item =>
    item.addEventListener('click', () => { showView(item.dataset.view); closeMobileDrawer(); })
  );
  document.getElementById('drawer-backdrop').addEventListener('click', closeMobileDrawer);
  document.getElementById('drawer-logout').addEventListener('click', () => { handleLogout(); closeMobileDrawer(); });

  /* ── Logo / focus links ── */
  document.getElementById('logo-mark').addEventListener('click', openFocusApp);
  document.getElementById('focus-link-btn').addEventListener('click', openFocusApp);
  document.getElementById('mobile-focus-btn').addEventListener('click', openFocusApp);

  /* ── Theme ── */

  document.getElementById('mobile-theme-toggle').addEventListener('click', toggleTheme);
  document.querySelectorAll('.theme-btn').forEach(btn =>
    btn.addEventListener('click', () => setManualTheme(btn.dataset.theme))
  );

  /* ── Auth / data ── */
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('toggle-particles').addEventListener('click', toggleParticles);
  document.getElementById('reset-data-btn').addEventListener('click', resetAllData);

  /* ── Toggles ── */
  document.querySelectorAll('.js-toggle').forEach(btn =>
    btn.addEventListener('click', () => btn.classList.toggle('on'))
  );
  document.getElementById('break-reminder-toggle').addEventListener('click', function () {
    this.classList.toggle('on');
  });

  /* ── Mood ── */
  document.querySelectorAll('.mood-btn').forEach(btn =>
    btn.addEventListener('click', () => selectMood(btn))
  );

  /* ── Todos ── */
  document.getElementById('todo-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTodo();
  });
  document.getElementById('todo-add-btn').addEventListener('click', () => openModal('todo-modal'));
  document.getElementById('modal-todo-save').addEventListener('click', () => {
    const text = document.getElementById('modal-todo-text').value.trim();
    const priority = document.getElementById('modal-todo-priority').value;
    if (!text) return;
    const data = nslLoad();
    data.todos.push({ id: Date.now(), text, priority, done: false });
    nslSave(data); closeModal('todo-modal'); renderTodos(); showToast('✶', 'Task added');
  });
  document.getElementById('todo-list').addEventListener('click', e => {
    const check = e.target.closest('.todo-check'); if (check) toggleTodo(+check.dataset.id);
    const del = e.target.closest('.todo-del'); if (del) deleteTodo(+del.dataset.id);
  });

  /* ── Reminders ── */
  document.getElementById('add-reminder-btn').addEventListener('click', () => openModal('reminder-modal'));
  document.getElementById('modal-reminder-save').addEventListener('click', () => {
    const name = document.getElementById('modal-reminder-name').value.trim();
    const time = document.getElementById('modal-reminder-time').value;
    const icon = document.getElementById('modal-reminder-icon').value || '🔔';
    if (!name) return;
    const data = nslLoad();
    data.reminders.push({ id: Date.now(), name, time, icon, on: true });
    nslSave(data); closeModal('reminder-modal'); renderReminders(); showToast('✶', 'Reminder added');
  });
  document.getElementById('reminder-list').addEventListener('click', e => {
    const toggle = e.target.closest('.reminder-toggle');
    if (toggle && toggle.dataset.id) toggleReminder(+toggle.dataset.id);
    const del = e.target.closest('.reminder-del');
    if (del) deleteReminder(+del.dataset.id);
  });

  document.getElementById('ycal-prev').addEventListener('click', () => ycalChangeMonth(-1));
  document.getElementById('ycal-next').addEventListener('click', () => ycalChangeMonth(1));
  /* ── Goals ── */
  document.getElementById('add-goal-btn').addEventListener('click', () => openModal('goal-modal'));
  document.getElementById('modal-goal-save').addEventListener('click', () => {
    const name = document.getElementById('modal-goal-name').value.trim();
    const target = parseFloat(document.getElementById('modal-goal-target').value) || 10;
    const current = parseFloat(document.getElementById('modal-goal-current').value) || 0;
    if (!name) return;
    const data = nslLoad();
    data.goals.push({ id: Date.now(), name, target, current });
    nslSave(data); closeModal('goal-modal'); renderGoals(); showToast('✶', 'Goal added');
  });
  document.getElementById('goal-list').addEventListener('click', e => {
    const del = e.target.closest('.goal-del');
    if (del) deleteGoal(+del.dataset.id);
    const adj = e.target.closest('.goal-adj');
    if (adj) adjustGoalProgress(+adj.dataset.id, parseFloat(adj.dataset.delta));
    const pctLabel = e.target.closest('.goal-pct');
    if (pctLabel) setGoalProgress(+pctLabel.dataset.id);
  });

  /* ── Modal close ── */
  document.querySelectorAll('.btn-ghost[data-close]').forEach(btn =>
    btn.addEventListener('click', () => closeModal(btn.dataset.close))
  );
  document.querySelectorAll('.modal-overlay').forEach(m =>
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); })
  );

  /* ── Timer presets ── */
  document.querySelectorAll('.preset-btn').forEach(btn =>
    btn.addEventListener('click', () => setPreset(+btn.dataset.mins, btn))
  );
  document.getElementById('dash-timer-btn').addEventListener('click', hubToggleTimer);
  document.getElementById('focus-timer-btn').addEventListener('click', hubToggleTimer);
  document.getElementById('dash-reset-btn').addEventListener('click', hubResetTimer);
  document.getElementById('focus-reset-btn').addEventListener('click', hubResetTimer);

  /* ── Quotes ── */
  document.getElementById('quote-dots').addEventListener('click', e => {
    const dot = e.target.closest('.quote-dot'); if (!dot) return;
    quoteIdx = +dot.dataset.idx; showQuote(quoteIdx);
    clearInterval(quoteTimer);
    quoteTimer = setInterval(() => { quoteIdx = (quoteIdx + 1) % quotes.length; showQuote(quoteIdx); }, 9000);
  });

  /* ── Keyboard shortcuts ── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') addTodo();
  });

  /* ── Fade in ── */
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 0.7s ease';
  requestAnimationFrame(() => requestAnimationFrame(() => { document.body.style.opacity = '1'; }));

  /* ── Signal DOM ready → triggers deferred render once auth also resolves ── */
  _domReady = true;
  _tryRender();
});
setInterval(checkReminders, 30000);