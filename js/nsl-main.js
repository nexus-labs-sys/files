/* IS_DISCORD / device-block / discord-gate detection now lives in js/nsl-env.js,
   loaded before this file, so it's already available here. */





function nslRecordSession(mins, label, startTimeMs) { if (mins < 1) return 0; const data = nslLoad(), today = new Date().toDateString(); data.sessions.push({ date: today, duration: mins, label: label || 'Focus Session', ts: Date.now() }); const xp = mins * 5; data.xp.today += xp; data.xp.totalXP += xp; data.xp.level = Math.max(1, Math.floor(1 + data.xp.totalXP / 500)); const last = data.streak.lastStudyDate, nd = new Date(); nd.setHours(0, 0, 0, 0); const dow = new Date().getDay(); if (!data.streak.weekDays.includes(dow)) data.streak.weekDays.push(dow); if (last !== today) { if (last) { const ld = new Date(last); ld.setHours(0, 0, 0, 0); const diff = Math.round((nd - ld) / 86400000); data.streak.current = diff === 1 ? data.streak.current + 1 : 1; } else { data.streak.current = 1; } if (data.streak.current > data.streak.longest) data.streak.longest = data.streak.current; data.streak.totalDays++; data.streak.lastStudyDate = today; } if (data.streak.weekDays.length > 7) data.streak.weekDays = data.streak.weekDays.slice(-7); nslSave(data); updateStatsBar(data); if (typeof window.nslReportSession === 'function') { window.nslReportSession({ durationMinutes: mins, label: label || 'Focus Session', startTimeMs: startTimeMs || (Date.now() - mins * 60000), endTimeMs: Date.now() }); } return xp; }

/* ====== TIMER STATE BROADCAST ====== */
function broadcastTimerState() {
  try {
    const state = {
      running, remaining, totalSecs, currentMode, timerEndsAt,
      label: MODES[currentMode] ? MODES[currentMode].label : 'Focus Session',
      color: MODES[currentMode] ? MODES[currentMode].color : '#e8a060',
      deepWorkActive, sessionStartTime, ts: Date.now()
    };
    localStorage.setItem(NSL_TIMER_KEY, JSON.stringify(state));
  } catch (_) { }
}
function clearTimerBroadcast() {
  try { localStorage.removeItem(NSL_TIMER_KEY); } catch (_) { }
}
function updateHubBtn() {
  const btn = document.getElementById('hub-btn');
  if (!btn) return;
  if (running) { btn.classList.add('timer-live'); btn.title = 'Timer running'; }
  else { btn.classList.remove('timer-live'); btn.title = ''; }
}

/* ====== STATS BAR ====== */
function updateStatsBar(data) { data = data || nslLoad(); const today = new Date().toDateString(), ts = data.sessions.filter(s => s.date === today), tm = ts.reduce((a, s) => a + (s.duration || 0), 0), td = tm >= 60 ? Math.floor(tm / 60) + 'h' + (tm % 60) + 'm' : tm + 'm'; const sv = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; }; sv('sb-streak', data.streak.current); sv('sb-today', td); sv('sb-xp', data.xp.today); sv('sb-sessions', ts.length); sv('panel-streak', data.streak.current); sv('panel-today', td); sv('panel-xp', data.xp.today); sv('duration-val', tm); if (typeof checkForNewUnlocks === 'function') checkForNewUnlocks(); if (typeof applyProgressionStage === 'function') applyProgressionStage(); }

/* ====== PARTICLES ====== */
const pCanvas = document.getElementById('particle-canvas'), pCtx = pCanvas.getContext('2d'); let particles = [];
function initParticles() { pCanvas.width = window.innerWidth; pCanvas.height = window.innerHeight; particles = []; for (let i = 0; i < 550; i++)particles.push({ x: Math.random() * pCanvas.width, y: Math.random() * pCanvas.height, r: Math.random() * 1.1 + 0.25, dx: (Math.random() - .5) * .12, dy: (Math.random() - .5) * .12, tw: Math.random() * Math.PI * 2 }); }
initParticles(); window.addEventListener('resize', initParticles);
function drawParticles() { pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height); for (const p of particles) { p.x += p.dx; p.y += p.dy; p.tw += .018; if (p.x < 0) p.x = pCanvas.width; if (p.x > pCanvas.width) p.x = 0; if (p.y < 0) p.y = pCanvas.height; if (p.y > pCanvas.height) p.y = 0; const a = .18 + .22 * Math.sin(p.tw); pCtx.beginPath(); pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2); pCtx.fillStyle = 'rgba(90,144,232,' + a + ')'; pCtx.shadowColor = 'rgba(90,144,232,0.6)'; pCtx.shadowBlur = 8; pCtx.fill(); pCtx.shadowBlur = 0; } requestAnimationFrame(drawParticles); }
drawParticles();

/* ====================================================================
   IMMERSIVE ENVIRONMENT SYSTEM (Phase 1)
   Everything below is config-driven and asset-driven. To add a new
   world / view / weather effect / companion, just add an entry to the
   matching array — no other code changes are required. Assets that
   haven't been uploaded yet simply fail silently and the rest of the
   system (palette, ring tint, weather, companions) still works.
   ==================================================================== */

const bgVideoEl = document.getElementById('bg-video');
const bgMediaEl = document.getElementById('bg-media'), bgOverlay = document.getElementById('bg-overlay');

/* ---- WORLDS ---- */
const SANCTUARY_ID = 'nexus-sanctuary';
const WORLDS = [
  { id: SANCTUARY_ID, sanctuary: true, title: '★ Synectix Sanctuary', description: 'Your evolving home — a space built from layers that grows as you do.', bg: { type: 'video', file: 'sanctuary/rooms/modern-study.webm' }, thumb: 'worlds/thumb/nexus.jpg', palette: { accent: '#dba86a', accent2: '#f0cf9a' }, ambient: 'Night', weather: ['clear', 'rain', 'mist', 'snow', 'storm'], companions: ['sleeping-cat', 'reading-owl', 'fireplace-fox', 'study-robot'], unlock: { type: 'always' } },

  {
    id: 'city-view',
    title: 'City View',
    description: 'A peaceful apartment overlooking the glowing city skyline.',
    bg: { type: 'video', file: 'worlds/city-view.mp4' },
    thumb: 'worlds/thumb/t1.png',
    palette: { accent: '#6ca7d9', accent2: '#b8d8f2' },
    ambient: 'City',
    weather: ['clear'],
    companions: ['sleeping-cat', 'study-robot'],
    unlock: { type: 'hours', value: 0 }
  },


  {
    id: 'mountain-view',
    title: 'Mountain View',
    description: 'A peaceful mountain retreat surrounded by nature.',
    bg: { type: 'video', file: 'worlds/mountain-view.mp4' },
    thumb: 'worlds/thumb/t5.png',
    palette: { accent: '#6fa07f', accent2: '#b7d8c3' },
    ambient: 'Forest',
    weather: ['clear', 'rain', 'mist', 'snow', 'storm'],
    companions: ['study-robot'],
    unlock: { type: 'hours', value: 15 }
  },

  {
    id: 'forest-cabin',
    title: 'Forest & Rain',
    description: 'Rainfall echoes through the forest as you study in comfort.',
    bg: { type: 'video', file: 'worlds/forest and rain.mp4' },
    thumb: 'worlds/thumb/t6.png',
    palette: { accent: '#7aa27a', accent2: '#b9d8b4' },
    ambient: 'Rain',
    weather: ['clear'],
    companions: ['fireplace-fox', 'sleeping-cat'],
    unlock: { type: 'hours', value: 15 }
  },

  {
    id: 'study-room',
    title: 'Study Room',
    description: 'A minimalist desk setup designed for deep focus.',
    bg: { type: 'video', file: 'worlds/studying.mp4' },
    thumb: 'worlds/thumb/t7.png',
    palette: { accent: '#a785ff', accent2: '#d6c8ff' },
    ambient: 'Night',
    weather: ['clear'],
    companions: ['study-robot'],
    unlock: { type: 'hours', value: 18 }
  }

];

/* ---- SANCTUARY: ROOM LAYER (constant base environments, room remains constant once chosen; more rooms can be appended here later) ---- */
const SANCTUARY_ROOMS = [
  { id: 'modern-study', title: 'Modern Study Table', file: 'sanctuary/views/MST/MST-night-sky.png', thumb: 'worlds/thumb/thumb2/MST-ocean.png', unlock: { type: 'always' } },
  { id: 'fireplace-lounge', title: 'Fireplace Lounge', file: 'sanctuary/views/FPL/FPL-night-sky.png', thumb: 'worlds/thumb/thumb2/FPL-forest.png', unlock: { type: 'always' } },
  { id: 'cozy-library', title: 'Cozy Library', file: 'sanctuary/views/LIB/LIB-night-sky.png', thumb: 'worlds/thumb/thumb2/MIN-night-sky.png', unlock: { type: 'always' } },
  { id: 'attic', title: 'Attic', file: 'sanctuary/views/ATT/ATT-night-sky.png', thumb: 'worlds/thumb/thumb2/ATT-auro.png', unlock: { type: 'hours', value: 10 } },
  { id: 'minimalistic', title: 'Minimalistic', file: 'sanctuary/views/MIN/MIN-night-sky.png', thumb: 'worlds/thumb/thumb2/MIN-night-sky.png', unlock: { type: 'streak', value: 7 } }
];

/* ---- SANCTUARY: WINDOW VIEW LAYER — each view is paired per-room (Room × View), so a
   "Mountain Sunrise" view rendered in Modern Study looks different than the same view
   rendered in Attic. Asset path is built from roomId + viewId by sanctuaryViewFile().
   Until a specific room+view asset is uploaded, every combination falls back to one
   shared default image (a night-sky picture) so the layer always shows *something*. ---- */
const SANCTUARY_DEFAULT_VIEW_IMAGE = 'sanctuary/views/ATT/ATT-auro.png';

/* ---- SANCTUARY: WINDOW VIEW LAYER (reintroduced ONLY for Nexus Sanctuary — independent of room, affects only outside scenery) ---- */
const SANCTUARY_VIEWS = [
  { id: 'mountain-sunrise', title: 'Mountain Sunrise', unlock: { type: 'always' } },
  { id: 'forest', title: 'Forest', unlock: { type: 'always' } },
  { id: 'rainy-city', title: 'Rainy City', unlock: { type: 'always' } },
  { id: 'ocean-horizon', title: 'Ocean Horizon', unlock: { type: 'hours', value: 3 } },
  { id: 'night-sky', title: 'Night Sky', unlock: { type: 'hours', value: 8 } },
  { id: 'aurora-sky', title: 'Aurora Sky', unlock: { type: 'streak', value: 10 } }
];

/* ---- WEATHER ---- */
const WEATHER_TYPES = [
  { id: 'clear', title: 'Clear', icon: '☀', unlock: { type: 'always' } },
  { id: 'rain', title: 'Rain', icon: '🌧', unlock: { type: 'always' } },
  { id: 'mist', title: 'Mist', icon: '🌫', unlock: { type: 'always' } },
  { id: 'snow', title: 'Snow', icon: '❄', unlock: { type: 'always' } },
  { id: 'storm', title: 'Storm', icon: '⛈', unlock: { type: 'hours', value: 8 } }
];

/* ---- COMPANIONS ---- */
const COMPANIONS = [
  { id: 'sleeping-cat', title: 'Sleeping Cat', file: '', position: { side: 'bottom-left' }, unlock: { type: 'always' } },
  { id: 'reading-owl', title: 'Reading Owl', file: '', position: { side: 'top-right' }, unlock: { type: 'hours', value: 5 } },
  { id: 'fireplace-fox', title: 'Fireplace Fox', file: '', position: { side: 'bottom-right' }, unlock: { type: 'hours', value: 12 } },
  { id: 'study-robot', title: 'Study Robot', file: '', position: { side: 'bottom-left' }, unlock: { type: 'streak', value: 5 } }
];

/* ---- SANCTUARY: COMPANION LAYER — state-driven, organic behavior (only active when Nexus Sanctuary is the active world).
   Each state may map to its own asset; if a state-specific file 404s, the sprite silently falls back to the
   companion's base file rather than disappearing, so partial asset sets still degrade gracefully. ---- */
const COMPANION_BEHAVIORS = {
  'sleeping-cat': {
    idle: 'sleep', states: [
      { id: 'sleep', file: 'sanctuary/companions/sleeping-cat/sleep.webm', weight: 6 },
      { id: 'blink', file: 'sanctuary/companions/sleeping-cat/blink.webm', weight: 3 },
      { id: 'stretch', file: 'sanctuary/companions/sleeping-cat/stretch.webm', weight: 2 },
      { id: 'watch-rain', file: 'sanctuary/companions/sleeping-cat/watch-rain.webm', weight: 3, context: w => w === 'rain' || w === 'storm' },
      { id: 'leave', file: 'sanctuary/companions/sleeping-cat/leave.webm', weight: 1, exclusive: true },
      { id: 'return', file: 'sanctuary/companions/sleeping-cat/return.webm', weight: 0, exclusive: true, followsFrom: 'leave' }
    ]
  },
  'reading-owl': {
    idle: 'blink', states: [
      { id: 'blink', file: 'sanctuary/companions/reading-owl/blink.webm', weight: 6 },
      { id: 'rotate-head', file: 'sanctuary/companions/reading-owl/rotate-head.webm', weight: 3 },
      { id: 'fly-briefly', file: 'sanctuary/companions/reading-owl/fly-briefly.webm', weight: 1, exclusive: true },
      { id: 'return', file: 'sanctuary/companions/reading-owl/return.webm', weight: 0, exclusive: true, followsFrom: 'fly-briefly' }
    ]
  },
  'fireplace-fox': {
    idle: 'idle', states: [
      { id: 'idle', file: 'companions/fireplace-fox.webm', weight: 6 },
      { id: 'stretch', file: 'sanctuary/companions/fireplace-fox/stretch.webm', weight: 2 },
      { id: 'yawn', file: 'sanctuary/companions/fireplace-fox/yawn.webm', weight: 2 },
      { id: 'watch-rain', file: 'sanctuary/companions/fireplace-fox/watch-rain.webm', weight: 2, context: w => w === 'rain' || w === 'storm' }
    ]
  },
  'study-robot': {
    idle: 'idle', states: [
      { id: 'idle', file: 'companions/study-robot.webm', weight: 6 },
      { id: 'blink', file: 'sanctuary/companions/study-robot/blink.webm', weight: 3 },
      { id: 'rotate-head', file: 'sanctuary/companions/study-robot/rotate-head.webm', weight: 2 }
    ]
  }
};

/* ---- SANCTUARY: AMBIENT EVENT LAYER — rare, low-frequency, organic-timed flourishes. No required assets;
   each plays a brief CSS-driven flourish so the layer works fully before any event-specific media is uploaded. ---- */
const AMBIENT_EVENTS = {
  window: ['shooting-star', 'passing-satellite', 'lightning-flash', 'bird-flying-past'],
  room: ['candle-flicker', 'book-page-turn', 'fireplace-flare', 'lamp-flicker'],
  companion: ['stretch', 'yawn', 'move-position']
};

/* ---- ENVIRONMENT PROGRESSION ---- */
const PROGRESSION_STAGES = [
  { stage: 1, hours: 0, name: 'A quiet beginning' },
  { stage: 2, hours: 5, name: 'Settling in' },
  { stage: 3, hours: 15, name: 'Taking shape' },
  { stage: 4, hours: 30, name: 'Becoming yours' },
  { stage: 5, hours: 60, name: 'A sanctuary' }
];
/* Sanctuary-specific stage flavor (same hour thresholds, shown only when Nexus Sanctuary is the active world) */
const SANCTUARY_STAGES = [
  { stage: 1, hours: 0, name: 'A basic room' },
  { stage: 2, hours: 5, name: 'More books appear' },
  { stage: 3, hours: 15, name: 'Plants take root' },
  { stage: 4, hours: 30, name: 'Decorative lighting glows' },
  { stage: 5, hours: 60, name: 'A fully developed sanctuary' }
];

/* ---- ENVIRONMENT STATE (persisted locally) ---- */
function envDefaults() { return { worldId: 'none', weatherId: 'clear', weatherIntensity: 45, companionsOn: true, companionId: null, sanctuaryRoomId: 'modern-study', sanctuaryViewId: null }; }
function envLoad() { try { const r = localStorage.getItem('nsl_env_state'); if (!r) return envDefaults(); return Object.assign(envDefaults(), JSON.parse(r)); } catch (_) { return envDefaults(); } }
function envSave(s) { try { localStorage.setItem('nsl_env_state', JSON.stringify(s)); } catch (_) { } }
let envState = envLoad();

/* ---- STATS HELPERS (drive progression + unlocks) ---- */
function nslAllTimeFocusMinutes() { const d = nslLoad(); return d.sessions.filter(s => !/break/i.test(s.label || '')).reduce((a, s) => a + (s.duration || 0), 0); }
function nslTotalHours() { return nslAllTimeFocusMinutes() / 60; }
function nslTotalSessionsCount() { return nslLoad().sessions.filter(s => !/break/i.test(s.label || '')).length; }
function nslCurrentStreakDays() { return nslLoad().streak.current; }

function meetsUnlock(req) {
  if (!req || req.type === 'always') return true;
  if (req.type === 'hours') return nslTotalHours() >= req.value;
  if (req.type === 'streak') return nslCurrentStreakDays() >= req.value;
  if (req.type === 'sessions') return nslTotalSessionsCount() >= req.value;
  return true;
}
function unlockLabel(req) {
  if (!req || req.type === 'always') return '';
  if (req.type === 'hours') return req.value + 'h of focus to unlock';
  if (req.type === 'streak') return req.value + '-day streak to unlock';
  if (req.type === 'sessions') return req.value + ' sessions to unlock';
  return '';
}

/* ---- PALETTE ---- */
const DEFAULT_PALETTE = { accent: '#e8a060', accent2: '#f0c080' };
function hexToRgba(hex, a) { const v = hex.replace('#', ''); const r = parseInt(v.substring(0, 2), 16), g = parseInt(v.substring(2, 4), 16), b = parseInt(v.substring(4, 6), 16); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }
function applyPalette(palette) { const p = palette || DEFAULT_PALETTE; const root = document.documentElement.style; root.setProperty('--accent', p.accent); root.setProperty('--accent2', p.accent2); root.setProperty('--accent-dim', hexToRgba(p.accent, 0.45)); root.setProperty('--accent-glow', hexToRgba(p.accent, 0.15)); root.setProperty('--accent-glow2', hexToRgba(p.accent2, 0.08)); }
function getRingColor() { if (currentMode === 'focus') { const w = WORLDS.find(x => x.id === envState.worldId); if (w) return w.palette.accent; } return MODES[currentMode].color; }

/* ---- WORLD SELECTOR ---- */
function buildWorldSelector() {
  const wrap = document.getElementById('world-strip');
  if (!wrap) return;
  wrap.innerHTML = '';
  const noneEl = document.createElement('button');
  noneEl.className = 'world-thumb' + (envState.worldId === 'none' ? ' active' : '');
  noneEl.dataset.world = 'none';
  noneEl.title = 'Open Sky';
  noneEl.innerHTML = '<span class="world-thumb-bg"><img src="worlds/open-sky.jpg" alt="" onerror="this.style.display=\'none\'"></span><span class="world-thumb-label">Open Sky</span>';
  noneEl.addEventListener('click', () => setWorld('none'));
  wrap.appendChild(noneEl);
  WORLDS.forEach(w => wrap.appendChild(buildWorldThumb(w)));
  updateWorldInfo();
}
function buildWorldThumb(w) {
  const unlocked = meetsUnlock(w.unlock);
  const el = document.createElement('button');
  el.className = 'world-thumb' + (envState.worldId === w.id ? ' active' : '') + (unlocked ? '' : ' locked');
  el.dataset.world = w.id;
  el.title = unlocked ? w.title : (w.title + ' — ' + unlockLabel(w.unlock));
  el.innerHTML = '<span class="world-thumb-bg"><img src="' + w.thumb + '" alt="" onerror="this.style.display=\'none\'"></span><span class="world-thumb-label">' + w.title + '</span>' + (unlocked ? '' : '<span class="world-lock">&#128274;</span>');
  el.addEventListener('click', () => {
    if (!unlocked) { showNotify(w.title + ' — ' + unlockLabel(w.unlock)); return; }
    setWorld(w.id);
  });
  return el;
}
function setWorld(id) {
  envState.worldId = id; envSave(envState);
  document.querySelectorAll('.world-thumb').forEach(t => t.classList.toggle('active', t.dataset.world === id));
  applyWorldVisuals();
  updateWorldInfo();
  applyProgressionStage();
  renderBottomPanel();
  renderFloatPanels();
  showNotify(id === 'none' ? 'Open sky.' : 'Entering ' + ((WORLDS.find(x => x.id === id) || {}).title || 'world') + '…');
}
function updateWorldInfo() {
  const infoEl = document.getElementById('world-info');
  if (!infoEl) return;
  const world = WORLDS.find(w => w.id === envState.worldId);
  if (!world) { infoEl.innerHTML = ''; return; }
  infoEl.innerHTML = '<div class="world-info-title">' + world.title + '</div><div class="world-info-desc">' + world.description + '</div><button class="world-ambient-suggest" id="world-ambient-btn">Try ambient · ' + world.ambient + '</button>';
  const btn = document.getElementById('world-ambient-btn');
  if (btn) btn.addEventListener('click', () => { const idx = AMBIENT_SOUNDS.findIndex(a => a.label === world.ambient); if (idx > -1) toggleAmb(idx); });
}
function applyWorldVisuals() {
  const world = WORLDS.find(w => w.id === envState.worldId);
  if (!world) {
    bgMediaEl.classList.remove('visible');
    bgVideoEl.classList.remove('visible');
    bgOverlay.classList.remove('visible');
    pCanvas.classList.remove('hidden');
    applyPalette(null);
  } else {
    pCanvas.classList.add('hidden');
    loadWorldBackground(world);
    applyPalette(world.palette);
    if (!world.weather.includes(envState.weatherId)) { envState.weatherId = world.weather[0] || 'clear'; envSave(envState); }
  }
  toggleSanctuaryUI(world);
  renderDecorOverlay(world);
  renderWeatherChips();
  applyWeather();
  buildCompanionPanel();
  renderCompanions();
  updateDisplay();
}
function toggleSanctuaryUI(world) {
  const isSanctuary = !!(world && world.sanctuary);
  ['room-section', 'sanctuary-view-section'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isSanctuary ? '' : 'none';
  });
  if (isSanctuary) {
    buildRoomSelector();
    renderSanctuaryViewChips();
    applySanctuaryView();
    startCompanionBehavior();
    startAmbientEvents();
  } else {
    document.getElementById('window-view-layer')?.classList.remove('visible');
    stopCompanionBehavior();
    stopAmbientEvents();
  }
}
function loadWorldBackground(world) {
  const bgFile = world.sanctuary ? sanctuaryRoomFile() : world.bg.file;
  if (world.bg.type === 'video') {
    bgMediaEl.classList.remove('visible');
    bgVideoEl.onerror = () => bgVideoEl.classList.remove('visible');
    bgVideoEl.src = bgFile;
    bgVideoEl.load();
    bgVideoEl.play().catch(() => { });
    requestAnimationFrame(() => { bgVideoEl.classList.add('visible'); bgOverlay.classList.add('visible'); });
  } else {
    bgVideoEl.classList.remove('visible');
    bgMediaEl.classList.remove('visible');
    bgMediaEl.src = '';
    setTimeout(() => {
      bgMediaEl.onload = () => { bgMediaEl.classList.add('visible'); bgOverlay.classList.add('visible'); };
      bgMediaEl.onerror = () => { bgMediaEl.classList.remove('visible'); };
      bgMediaEl.src = bgFile;
      setTimeout(() => { if (!bgMediaEl.classList.contains('visible')) bgOverlay.classList.add('visible'); }, 500);
    }, 70);
  }
}

/* ---- ENVIRONMENT PROGRESSION (decor overlay grows with accumulated focus time) ---- */
function currentStage() { const h = nslTotalHours(); let s = PROGRESSION_STAGES[0]; for (const st of PROGRESSION_STAGES) { if (h >= st.hours) s = st; } return s; }
function renderDecorOverlay(world) {
  const img = document.getElementById('progression-decor');
  if (!img) return;
  if (!world) { img.classList.remove('visible'); return; }
  const stage = currentStage().stage;
  img.onload = () => img.classList.add('visible');
  img.onerror = () => img.classList.remove('visible');
  img.classList.remove('visible');
  // img.src=world.sanctuary?('sanctuary/stage-'+stage+'.png'):('worlds/'+world.id+'/stage-'+stage+'.png');
}
function applyProgressionStage() {
  const stage = currentStage();
  document.body.dataset.stage = stage.stage;
  renderDecorOverlay(WORLDS.find(w => w.id === envState.worldId));
  checkStageReveal(stage);
}
function checkStageReveal(stage) {
  let prev = parseInt(localStorage.getItem('nsl_last_stage') || '0', 10);
  if (stage.stage > prev) {
    if (prev > 0) {
      const inSanctuary = envState.worldId === SANCTUARY_ID;
      const name = inSanctuary ? ((SANCTUARY_STAGES.find(s => s.stage === stage.stage) || stage).name) : stage.name;
      showNotify('Your space deepens — ' + name + '.');
    }
    try { localStorage.setItem('nsl_last_stage', String(stage.stage)); } catch (_) { }
  }
}

/* ---- DYNAMIC WEATHER ---- */
const weatherCanvas = document.getElementById('weather-canvas'), wCtx = weatherCanvas.getContext('2d');
let weatherParticles = [], weatherAnimId = null;
function initWeatherCanvas() { weatherCanvas.width = window.innerWidth; weatherCanvas.height = window.innerHeight; }
initWeatherCanvas(); window.addEventListener('resize', initWeatherCanvas);

function renderWeatherChips() {
  const wrap = document.getElementById('weather-chips');
  if (!wrap) return;
  wrap.innerHTML = '';
  const world = WORLDS.find(w => w.id === envState.worldId);
  WEATHER_TYPES.forEach(wt => {
    const compatible = !world || world.weather.includes(wt.id);
    const unlocked = meetsUnlock(wt.unlock);
    const ok = compatible && unlocked;
    const btn = document.createElement('button');
    btn.className = 'bg-chip' + (envState.weatherId === wt.id ? ' active' : '') + (ok ? '' : ' disabled');
    btn.textContent = wt.icon + ' ' + wt.title;
    btn.title = ok ? '' : (!compatible ? 'Not part of this world' : unlockLabel(wt.unlock));
    if (ok) btn.addEventListener('click', () => { envState.weatherId = wt.id; envSave(envState); renderWeatherChips(); renderBottomPanel(); applyWeather(); });
    wrap.appendChild(btn);
  });
}
function applyWeather() {
  const intensity = Math.max(10, envState.weatherIntensity || 45) / 100;
  buildWeatherParticles(envState.weatherId, intensity);
  if (weatherAnimId) { cancelAnimationFrame(weatherAnimId); weatherAnimId = null; }
  wCtx.clearRect(0, 0, weatherCanvas.width, weatherCanvas.height);
  if (envState.weatherId === 'clear') return;
  animateWeather(envState.weatherId, intensity);
}
function buildWeatherParticles(type, intensity) {
  const counts = { rain: 120, mist: 40, snow: 90, storm: 160, clear: 0 };
  const n = Math.round((counts[type] || 0) * Math.max(0.15, intensity));
  weatherParticles = [];
  for (let i = 0; i < n; i++) {
    if (type === 'rain' || type === 'storm') {
      weatherParticles.push({ x: Math.random() * weatherCanvas.width, y: Math.random() * weatherCanvas.height, len: Math.random() * 16 + 8, speed: (type === 'storm' ? 9 : 5) + Math.random() * 4, drift: type === 'storm' ? 2.4 : 0.6 });
    } else if (type === 'snow') {
      weatherParticles.push({ x: Math.random() * weatherCanvas.width, y: Math.random() * weatherCanvas.height, r: Math.random() * 2 + 1, speed: Math.random() * 0.8 + 0.4, sway: Math.random() * Math.PI * 2 });
    } else if (type === 'mist') {
      weatherParticles.push({ x: Math.random() * weatherCanvas.width, y: Math.random() * weatherCanvas.height, r: Math.random() * 120 + 60, speed: Math.random() * 0.15 + 0.05, op: Math.random() * 0.05 + 0.02 });
    }
  }
}
function animateWeather(type, intensity) {
  if (document.hidden) { weatherAnimId = requestAnimationFrame(() => animateWeather(type, intensity)); return; }
  wCtx.clearRect(0, 0, weatherCanvas.width, weatherCanvas.height);
  if (type === 'rain' || type === 'storm') {
    wCtx.strokeStyle = 'rgba(200,220,255,' + (type === 'storm' ? 0.35 : 0.22) + ')'; wCtx.lineWidth = 1;
    weatherParticles.forEach(p => { wCtx.beginPath(); wCtx.moveTo(p.x, p.y); wCtx.lineTo(p.x + p.drift, p.y + p.len); wCtx.stroke(); p.y += p.speed; p.x += p.drift * 0.3; if (p.y > weatherCanvas.height) { p.y = -p.len; p.x = Math.random() * weatherCanvas.width; } });
    if (type === 'storm' && Math.random() < 0.012) flashLightning();
  } else if (type === 'snow') {
    wCtx.fillStyle = 'rgba(255,255,255,0.55)';
    weatherParticles.forEach(p => { p.sway += 0.02; p.x += Math.sin(p.sway) * 0.4; p.y += p.speed; wCtx.beginPath(); wCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2); wCtx.fill(); if (p.y > weatherCanvas.height) { p.y = -4; p.x = Math.random() * weatherCanvas.width; } });
  } else if (type === 'mist') {
    weatherParticles.forEach(p => { p.x += p.speed; wCtx.beginPath(); wCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2); wCtx.fillStyle = 'rgba(255,255,255,' + p.op + ')'; wCtx.fill(); if (p.x > weatherCanvas.width + p.r) p.x = -p.r; });
  }
  weatherAnimId = requestAnimationFrame(() => animateWeather(type, intensity));
}
function flashLightning() { wCtx.fillStyle = 'rgba(255,255,255,0.18)'; wCtx.fillRect(0, 0, weatherCanvas.width, weatherCanvas.height); }

/* ---- COMPANIONS ---- */
function buildCompanionPanel() {
  const toggleBtn = document.getElementById('companion-toggle-btn');
  if (toggleBtn) { toggleBtn.classList.toggle('active', envState.companionsOn); toggleBtn.textContent = 'Companion: ' + (envState.companionsOn ? 'On' : 'Off'); }
  const wrap = document.getElementById('companion-chips');
  if (!wrap) return;
  wrap.innerHTML = '';
  const world = WORLDS.find(w => w.id === envState.worldId);
  const compatibleIds = world ? world.companions : COMPANIONS.map(c => c.id);
  COMPANIONS.filter(c => compatibleIds.includes(c.id)).forEach(c => {
    const unlocked = meetsUnlock(c.unlock);
    const chip = document.createElement('button');
    chip.className = 'bg-chip' + (envState.companionId === c.id ? ' active' : '') + (unlocked ? '' : ' disabled');
    chip.textContent = c.title;
    chip.title = unlocked ? '' : unlockLabel(c.unlock);
    if (unlocked) chip.addEventListener('click', () => { envState.companionId = c.id; envSave(envState); buildCompanionPanel(); renderCompanions(); });
    wrap.appendChild(chip);
  });
}
function resolveActiveCompanion() {
  const world = WORLDS.find(w => w.id === envState.worldId);
  const compatibleIds = world ? world.companions : COMPANIONS.map(c => c.id);
  let comp = COMPANIONS.find(c => c.id === envState.companionId && compatibleIds.includes(c.id) && meetsUnlock(c.unlock));
  if (!comp) comp = COMPANIONS.find(c => compatibleIds.includes(c.id) && meetsUnlock(c.unlock));
  return comp || null;
}
function renderCompanions() {
  const layer = document.getElementById('companion-layer');
  if (!layer) return;
  layer.innerHTML = '';
  if (!envState.companionsOn) return;
  const comp = resolveActiveCompanion();
  if (!comp) return;
  const vid = document.createElement('video');
  vid.id = 'active-companion-sprite';
  vid.className = 'companion-sprite pos-' + comp.position.side;
  vid.muted = true; vid.loop = true; vid.autoplay = true; vid.playsInline = true;
  vid.dataset.companionId = comp.id;
  const behavior = COMPANION_BEHAVIORS[comp.id];
  vid.dataset.state = behavior ? behavior.idle : 'idle';
  vid.onerror = () => vid.remove();
  vid.src = comp.file;
  vid.play().catch(() => { });
  layer.appendChild(vid);
}

/* ====================================================================
   NEXUS SANCTUARY — flagship, layer-based, fully customizable world.
   Everything below only ever runs while envState.worldId===SANCTUARY_ID;
   every other world keeps using the simple rendering above untouched.
   ==================================================================== */

/* ---- SANCTUARY: ROOM LAYER ---- */
function sanctuaryRoomFile() {
  let room = SANCTUARY_ROOMS.find(r => r.id === envState.sanctuaryRoomId && meetsUnlock(r.unlock));
  if (!room) room = SANCTUARY_ROOMS.find(r => meetsUnlock(r.unlock)) || SANCTUARY_ROOMS[0];
  return room.file;
}
function buildRoomSelector() {
  const wrap = document.getElementById('room-strip');
  if (!wrap) return;
  wrap.innerHTML = '';
  SANCTUARY_ROOMS.forEach(r => {
    const unlocked = meetsUnlock(r.unlock);
    const el = document.createElement('button');
    el.className = 'world-thumb' + (envState.sanctuaryRoomId === r.id ? ' active' : '') + (unlocked ? '' : ' locked');
    el.title = unlocked ? r.title : (r.title + ' — ' + unlockLabel(r.unlock));
    el.innerHTML = '<span class="world-thumb-bg"><img src="' + r.thumb + '" alt="" onerror="this.style.display=\'none\'"></span><span class="world-thumb-label">' + r.title + '</span>' + (unlocked ? '' : '<span class="world-lock">&#128274;</span>');
    el.addEventListener('click', () => {
      if (!unlocked) { showNotify(r.title + ' — ' + unlockLabel(r.unlock)); return; }
      setRoom(r.id);
    });
    wrap.appendChild(el);
  });
}
function setRoom(id) {
  envState.sanctuaryRoomId = id; envSave(envState);
  buildRoomSelector();
  const world = WORLDS.find(w => w.id === SANCTUARY_ID);
  if (world) loadWorldBackground(world);
  applySanctuaryView();
  renderBottomPanel();
  renderFloatPanels();
  showNotify('Room set.');
}

/* ---- SANCTUARY: WINDOW VIEW LAYER (independent of room — only the outside scenery changes) ---- */
function renderSanctuaryViewChips() {
  const wrap = document.getElementById('sanctuary-view-chips');
  if (!wrap) return;
  wrap.innerHTML = '';
  const noneChip = document.createElement('button');
  noneChip.className = 'bg-chip none-chip' + (!envState.sanctuaryViewId ? ' active' : '');
  noneChip.textContent = 'None';
  noneChip.addEventListener('click', () => setSanctuaryView(null));
  wrap.appendChild(noneChip);
  SANCTUARY_VIEWS.forEach(v => {
    const unlocked = meetsUnlock(v.unlock);
    const c = document.createElement('button');
    c.className = 'bg-chip' + (envState.sanctuaryViewId === v.id ? ' active' : '') + (unlocked ? '' : ' disabled');
    c.textContent = v.title;
    c.title = unlocked ? '' : unlockLabel(v.unlock);
    if (unlocked) c.addEventListener('click', () => setSanctuaryView(v.id));
    wrap.appendChild(c);
  });
}
function setSanctuaryView(id) {
  envState.sanctuaryViewId = id; envSave(envState);
  renderSanctuaryViewChips();
  applySanctuaryView();
  renderBottomPanel();
  renderFloatPanels();
  showNotify(id ? 'Window view set.' : 'Window view cleared.');
}
/* Room/view short codes used in the PNG filenames you're uploading
   (sanctuary/views/<ROOM_CODE>/<ROOM_CODE>-<view-code>.png). Adjust these
   if your actual codes differ — everything else keys off this map. */
const SANCTUARY_ROOM_CODES = { 'modern-study': 'MST', 'fireplace-lounge': 'FPL', 'cozy-library': 'LIB', 'attic': 'ATT', 'minimalistic': 'MIN' };
const SANCTUARY_VIEW_CODES = { 'mountain-sunrise': 'mountain', 'forest': 'forest', 'rainy-city': 'rainy-city', 'ocean-horizon': 'ocean', 'night-sky': 'night-sky', 'aurora-sky': 'auro' };
function sanctuaryViewFile(roomId, viewId) {
  const rc = SANCTUARY_ROOM_CODES[roomId] || roomId;
  const vc = SANCTUARY_VIEW_CODES[viewId] || viewId;
  return 'sanctuary/views/' + rc + '/' + rc + '-' + vc + '.png';
}
function applySanctuaryView() {
  const layer = document.getElementById('window-view-layer');
  const vid = document.getElementById('window-view-video'), img = document.getElementById('window-view-img');
  if (!layer || !vid || !img) return;
  if (envState.worldId !== SANCTUARY_ID || !envState.sanctuaryViewId) { layer.classList.remove('visible'); return; }
  const view = SANCTUARY_VIEWS.find(v => v.id === envState.sanctuaryViewId);
  if (!view) { layer.classList.remove('visible'); return; }
  const roomId = envState.sanctuaryRoomId || 'modern-study';
  const file = sanctuaryViewFile(roomId, view.id);
  vid.style.display = 'none'; img.style.display = 'block';
  img.onerror = () => {
    // specific room+view asset not uploaded yet — fall back to the shared default image
    img.onerror = () => layer.classList.remove('visible');
    img.onload = () => layer.classList.add('visible');
    img.src = SANCTUARY_DEFAULT_VIEW_IMAGE;
  };
  img.onload = () => layer.classList.add('visible');
  img.src = file;
}

/* ---- SANCTUARY: COMPANION BEHAVIOR ENGINE — weighted random states, context-aware, organic timing ---- */
let companionBehaviorTimer = null, companionReturnTimer = null;
function startCompanionBehavior() { stopCompanionBehavior(); scheduleNextCompanionTick(); }
function stopCompanionBehavior() {
  if (companionBehaviorTimer) { clearTimeout(companionBehaviorTimer); companionBehaviorTimer = null; }
  if (companionReturnTimer) { clearTimeout(companionReturnTimer); companionReturnTimer = null; }
}
function scheduleNextCompanionTick() {
  const delay = 9000 + Math.random() * 16000; // ~9–25s, organic and infrequent
  companionBehaviorTimer = setTimeout(triggerCompanionBehaviorTick, delay);
}
function triggerCompanionBehaviorTick() {
  if (envState.worldId !== SANCTUARY_ID || !envState.companionsOn) { scheduleNextCompanionTick(); return; }
  const comp = resolveActiveCompanion();
  const behavior = comp && COMPANION_BEHAVIORS[comp.id];
  if (!behavior) { scheduleNextCompanionTick(); return; }
  const pool = behavior.states.filter(s => s.weight > 0 && (!s.context || s.context(envState.weatherId)));
  if (pool.length) {
    const total = pool.reduce((a, s) => a + s.weight, 0);
    let r = Math.random() * total, chosen = pool[0];
    for (const s of pool) { if (r < s.weight) { chosen = s; break; } r -= s.weight; }
    playCompanionState(comp, behavior, chosen);
  }
  scheduleNextCompanionTick();
}
function playCompanionState(comp, behavior, state) {
  const vid = document.getElementById('active-companion-sprite');
  if (!vid) return;
  vid.style.opacity = '0';
  setTimeout(() => {
    vid.onerror = () => { vid.src = comp.file; };
    vid.src = state.file;
    vid.dataset.state = state.id;
    vid.play().catch(() => { });
    vid.style.opacity = '';
  }, 220);
  if (companionReturnTimer) { clearTimeout(companionReturnTimer); companionReturnTimer = null; }
  const followUp = behavior.states.find(s => s.followsFrom === state.id);
  if (followUp) {
    companionReturnTimer = setTimeout(() => playCompanionState(comp, behavior, followUp), 5000 + Math.random() * 2500);
  } else if (state.id !== behavior.idle) {
    const idleState = behavior.states.find(s => s.id === behavior.idle);
    if (idleState) companionReturnTimer = setTimeout(() => playCompanionState(comp, behavior, idleState), 4000 + Math.random() * 3000);
  }
}

/* ---- SANCTUARY: AMBIENT EVENT LAYER — rare, low-frequency, organic-timed flourishes.
   Pure CSS by default so the layer works before any event-specific media exists. ---- */
let ambientEventTimer = null;
function startAmbientEvents() { stopAmbientEvents(); scheduleNextAmbientEvent(); }
function stopAmbientEvents() { if (ambientEventTimer) { clearTimeout(ambientEventTimer); ambientEventTimer = null; } }
function scheduleNextAmbientEvent() {
  const delay = 50000 + Math.random() * 70000; // ~50–120s — rare and organic, never intrusive
  ambientEventTimer = setTimeout(triggerAmbientEvent, delay);
}
function triggerAmbientEvent() {
  if (envState.worldId !== SANCTUARY_ID) { scheduleNextAmbientEvent(); return; }
  const pool = [];
  if (envState.sanctuaryViewId) AMBIENT_EVENTS.window.forEach(id => pool.push({ cat: 'window', id }));
  AMBIENT_EVENTS.room.forEach(id => pool.push({ cat: 'room', id }));
  if (envState.companionsOn && resolveActiveCompanion()) AMBIENT_EVENTS.companion.forEach(id => pool.push({ cat: 'companion', id }));
  if (pool.length) playAmbientEvent(pool[Math.floor(Math.random() * pool.length)]);
  scheduleNextAmbientEvent();
}
function playAmbientEvent(ev) {
  if (ev.cat === 'window') {
    const layer = document.getElementById('window-view-layer');
    if (!layer) return;
    const flourish = document.createElement('div');
    flourish.className = 'ambient-flourish flourish-' + ev.id;
    layer.appendChild(flourish);
    setTimeout(() => flourish.remove(), 6200);
  } else if (ev.cat === 'room') {
    const room = bgVideoEl.classList.contains('visible') ? bgVideoEl : bgMediaEl;
    room.classList.add('ambient-flicker');
    setTimeout(() => room.classList.remove('ambient-flicker'), 1400);
  } else if (ev.cat === 'companion') {
    const comp = resolveActiveCompanion();
    const behavior = comp && COMPANION_BEHAVIORS[comp.id];
    const state = behavior && behavior.states.find(s => s.id === ev.id);
    if (comp && behavior && state) playCompanionState(comp, behavior, state);
  }
}

/* ---- VISUAL UNLOCKS (calm reveal, no popups) ---- */
function checkForNewUnlocks() {
  let prev = [];
  try { prev = JSON.parse(localStorage.getItem('nsl_unlocked_ids') || '[]'); } catch (_) { prev = []; }
  const all = [
    ...WORLDS.map(w => ({ id: w.id, title: w.title, unlock: w.unlock, cat: 'world' })),
    ...COMPANIONS.map(c => ({ id: c.id, title: c.title, unlock: c.unlock, cat: 'companion' })),
    ...WEATHER_TYPES.map(w => ({ id: w.id, title: w.title, unlock: w.unlock, cat: 'weather effect' }))
  ];
  const nowUnlocked = all.filter(x => meetsUnlock(x.unlock)).map(x => x.id);
  const newly = all.filter(x => nowUnlocked.includes(x.id) && !prev.includes(x.id) && x.unlock && x.unlock.type !== 'always');
  if (newly.length) {
    newly.forEach(item => showNotify('New ' + item.cat + ' unlocked — ' + item.title));
    buildWorldSelector(); buildCompanionPanel(); renderWeatherChips(); renderBottomPanel(); renderFloatPanels();
  }
  try { localStorage.setItem('nsl_unlocked_ids', JSON.stringify(nowUnlocked)); } catch (_) { }
}

/* ---- ENVIRONMENT SETTINGS COLLAPSE TOGGLE ---- */
function envPanelCollapsed() { try { return localStorage.getItem('nsl_env_panel_collapsed') === '1'; } catch (_) { return false; } }
function setEnvPanelCollapsed(collapsed) {
  const group = document.getElementById('env-settings-group'), btn = document.getElementById('env-settings-toggle');
  if (group) group.classList.toggle('collapsed', collapsed);
  if (btn) btn.textContent = collapsed ? 'Show' : 'Hide';
  try { localStorage.setItem('nsl_env_panel_collapsed', collapsed ? '1' : '0'); } catch (_) { }
}
function initEnvPanelToggle() {
  setEnvPanelCollapsed(envPanelCollapsed());
  const btn = document.getElementById('env-settings-toggle');
  if (btn) btn.addEventListener('click', () => setEnvPanelCollapsed(!envPanelCollapsed()));
}

/* ---- INIT ---- */
function initEnvironmentSystems() {
  buildWorldSelector();
  applyWorldVisuals();
  applyProgressionStage();
  checkForNewUnlocks();
  renderBottomPanel();
  renderFloatPanels();
  initEnvPanelToggle();
  renderAllAmbient();
  const wis = document.getElementById('weather-intensity-slider');
  if (wis) { wis.value = envState.weatherIntensity; wis.addEventListener('input', e => { envState.weatherIntensity = +e.target.value; envSave(envState); applyWeather(); }); }
  const ctb = document.getElementById('companion-toggle-btn');
  if (ctb) { ctb.addEventListener('click', () => { envState.companionsOn = !envState.companionsOn; envSave(envState); buildCompanionPanel(); renderCompanions(); showNotify(envState.companionsOn ? 'Companion present.' : 'Companion hidden.'); }); }
}

/* ====== YOUTUBE ====== */
let ytPlayer = null, ytReady = false, ytPlaying = false, ytLoaded = false, ytVolume = 70, ytProgressIv = null, ytPollIv = null, ytLastVid = null;

function buildMusicPanel() {
  const card = document.getElementById('music-card');
  if (IS_DISCORD) {
    card.innerHTML = `
      <div style="padding:10px 13px 6px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div class="track-art" id="lofi-art"><span class="art-fb">&#9835;</span></div>
          <div class="track-info">
            <div class="track-name" id="lofi-track-name">Loading playlist…</div>
            <div class="track-artist" id="lofi-track-artist">—</div>
            <div class="track-artist" id="lofi-track-status" style="opacity:.6">—</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <button class="music-nav-btn" id="lofi-prev">&#9198;</button>
          <button class="music-nav-btn" id="lofi-shuffle" title="Shuffle">&#8635;</button>
          <button id="lofi-play-btn" style="flex:1;padding:7px;border-radius:20px;background:rgba(232,160,96,0.10);border:1px solid rgba(232,160,96,0.30);color:var(--accent);cursor:pointer;font-size:12px;letter-spacing:1px">&#9654; Play</button>
          <button class="music-nav-btn" id="lofi-next">&#9197;</button>
        </div>
        <div style="height:2px;border-radius:2px;background:var(--border);margin-bottom:8px">
          <div id="lofi-progress" style="height:100%;border-radius:2px;background:linear-gradient(90deg,var(--accent),var(--accent2));width:0%;transition:width 1s linear"></div>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap" id="lofi-categories"></div>
        <div style="max-height:130px;overflow-y:auto;display:flex;flex-direction:column;gap:4px" id="lofi-track-list"></div>
        <div class="vol-row" style="margin-top:8px">
          <span class="vol-icon">&#9835;</span>
          <input type="range" min="0" max="100" value="70" id="lofi-vol" style="--pct:70%">
        </div>
      </div>`;
    let tracks = [], lofiAudio = null, lofiIdx = 0, lofiPlaying = false, activeCategory = 'All';
    fetch('music/playlist.json').then(r => r.json()).then(data => { tracks = data; buildCategoryFilter(); buildTrackList('All'); lofiLoad(0); showNotify('Playlist loaded — ' + tracks.length + ' tracks'); }).catch(() => showNotify('Could not load playlist.json'));
    function buildCategoryFilter() { const cats = ['All', ...new Set(tracks.map(t => t.category).filter(Boolean))]; const wrap = document.getElementById('lofi-categories'); if (!wrap) return; wrap.innerHTML = ''; cats.forEach(cat => { const btn = document.createElement('button'); btn.className = 'bg-chip' + (cat === 'All' ? ' active' : ''); btn.textContent = cat; btn.addEventListener('click', () => { activeCategory = cat; wrap.querySelectorAll('.bg-chip').forEach(b => b.classList.toggle('active', b.textContent === cat)); buildTrackList(cat); }); wrap.appendChild(btn); }); }
    function buildTrackList(category) {
      const list = document.getElementById('lofi-track-list'); if (!list) return; list.innerHTML = ''; const filtered = tracks.filter(t => category === 'All' || t.category === category); filtered.forEach(t => {
        const idx = tracks.indexOf(t); const item = document.createElement('div'); item.style.cssText = 'padding:6px 10px;border-radius:8px;font-size:0.72rem;color:var(--muted);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:8px'; item.dataset.idx = idx;

        item.innerHTML = `<span style="font-size:10px;color:var(--muted2)">${String(idx + 1).padStart(2, '0')}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.label}${t.artist ? ' <span style="color:var(--muted2);font-size:0.62rem">— ' + t.artist.split(';')[0].trim() + '</span>' : ''}</span>`;

        item.addEventListener('click', () => { lofiLoad(idx); if (lofiPlaying) { lofiAudio.play(); } else { lofiToggle(); } }); item.addEventListener('mouseenter', () => item.style.background = 'var(--surface)'); item.addEventListener('mouseleave', () => item.style.background = idx === lofiIdx ? 'var(--accent-glow2)' : 'transparent'); list.appendChild(item);
      });
    }
    function lofiLoad(idx) {
      if (lofiAudio) { lofiAudio.pause(); } lofiIdx = idx; const t = tracks[idx]; if (!t) return; lofiAudio = new Audio(t.file); lofiAudio.volume = +document.getElementById('lofi-vol').value / 100; lofiAudio.addEventListener('ended', () => { lofiLoad((lofiIdx + 1) % tracks.length); if (lofiPlaying) lofiAudio.play().catch(() => { }); }); lofiAudio.addEventListener('timeupdate', () => { if (!lofiAudio.duration) return; const pct = (lofiAudio.currentTime / lofiAudio.duration) * 100; const p = document.getElementById('lofi-progress'); if (p) p.style.width = pct + '%'; });

      const tn = document.getElementById('lofi-track-name'); if (tn) tn.textContent = t.label; const ar = document.getElementById('lofi-track-artist'); if (ar) ar.textContent = t.artist ? t.artist.split(';').map(a => a.trim()).join(', ') : ''; const ts = document.getElementById('lofi-track-status'); if (ts) ts.textContent = t.category || '';

      document.querySelectorAll('#lofi-track-list div[data-idx]').forEach(el => { el.style.background = +el.dataset.idx === idx ? 'var(--accent-glow2)' : 'transparent'; el.style.color = +el.dataset.idx === idx ? 'var(--accent)' : 'var(--muted)'; });
    }
    function lofiToggle() { if (!lofiAudio || tracks.length === 0) return; if (lofiPlaying) { lofiAudio.pause(); lofiPlaying = false; const b = document.getElementById('lofi-play-btn'); if (b) b.innerHTML = '&#9654; Play'; const s = document.getElementById('lofi-track-status'); if (s) s.textContent = 'Paused'; } else { lofiAudio.play().catch(() => showNotify('Could not play.')); lofiPlaying = true; const b = document.getElementById('lofi-play-btn'); if (b) b.innerHTML = '&#9646;&#9646; Pause'; const s = document.getElementById('lofi-track-status'); if (s) s.textContent = 'Now playing'; } }
    function lofiShuffle() { if (tracks.length === 0) return; const idx = Math.floor(Math.random() * tracks.length); lofiLoad(idx); if (lofiPlaying) lofiAudio.play(); showNotify('Shuffled ✶'); }
    document.getElementById('lofi-play-btn').addEventListener('click', lofiToggle);
    document.getElementById('lofi-prev').addEventListener('click', () => { lofiLoad((lofiIdx - 1 + tracks.length) % tracks.length); if (lofiPlaying) lofiAudio.play(); });
    document.getElementById('lofi-next').addEventListener('click', () => { lofiLoad((lofiIdx + 1) % tracks.length); if (lofiPlaying) lofiAudio.play(); });
    document.getElementById('lofi-shuffle').addEventListener('click', lofiShuffle);
    document.getElementById('lofi-vol').addEventListener('input', e => { if (lofiAudio) lofiAudio.volume = e.target.value / 100; e.target.style.setProperty('--pct', e.target.value + '%'); });
    return;
  }
  card.innerHTML = `
    <div class="music-url-row">
      <input type="text" id="yt-url-input" placeholder="YouTube playlist or video URL..." autocomplete="off" spellcheck="false">
      <button class="yt-load-btn" id="yt-load-btn">Load</button>
    </div>
    <div class="music-track">
      <div class="track-art" id="track-art"><img id="track-thumb" src="" alt=""><span class="art-fb">&#9835;</span></div>
      <div class="track-info"><div class="track-name" id="track-name">No playlist loaded</div><div class="track-artist" id="track-artist">Paste a URL above</div></div>
      <button id="music-play-btn" disabled>&#9654;</button>
    </div>
    <div class="music-nav-row">
      <button class="music-nav-btn" id="prev-btn" disabled>&#9198;</button>
      <button class="music-nav-btn" id="next-btn" disabled>&#9197;</button>
    </div>
    <div class="yt-progress-wrap"><div class="yt-progress-bar" id="yt-progress-bar"><div class="yt-progress-fill" id="yt-progress-fill"></div></div></div>
    <div class="yt-status-row"><div class="yt-status-dot" id="yt-status-dot"></div><div class="yt-status-txt" id="yt-status-txt">Waiting for playlist</div></div>
    <div class="vol-row"><span class="vol-icon">&#9835;</span><input type="range" min="0" max="100" value="70" id="vol-slider"></div>`;
  const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
  const ytWrap = document.createElement('div'); ytWrap.id = 'yt-player-wrap'; ytWrap.style.cssText = 'position:fixed;left:-500px;bottom:-500px;width:200px;height:112px;z-index:-1;pointer-events:none;overflow:hidden'; ytWrap.innerHTML = '<div id="yt-player"></div>'; document.body.appendChild(ytWrap);
  document.getElementById('yt-load-btn').addEventListener('click', loadYTUrl);
  document.getElementById('yt-url-input').addEventListener('keydown', e => { if (e.key === 'Enter') loadYTUrl(); });
  document.getElementById('music-play-btn').addEventListener('click', ytTogglePlay);
  document.getElementById('prev-btn').addEventListener('click', ytPrev);
  document.getElementById('next-btn').addEventListener('click', ytNext);
  document.getElementById('yt-progress-bar').addEventListener('click', ytSeek);
  document.getElementById('vol-slider').addEventListener('input', e => ytSetVolume(e.target.value));
  document.getElementById('vol-slider').style.setProperty('--pct', '70%');
}
function relocateMusicPanel() {
  const card = document.getElementById('music-card');
  if (!card) return;
  const bpYt = document.getElementById('bp-music-yt'), bpSlot = document.getElementById('bp-music-slot');
  const flCtrl = document.getElementById('fl-music-ctrl'), flSlot = document.getElementById('fl-music-slot');
  const sideSlot = document.getElementById('music-section');
  if (!IS_DISCORD) {
    if (sideSlot && card.parentElement !== sideSlot) sideSlot.appendChild(card);
    if (bpYt) bpYt.style.display = ''; if (bpSlot) bpSlot.style.display = 'none';
    if (flCtrl) flCtrl.style.display = ''; if (flSlot) flSlot.style.display = 'none';
    return;
  }
  if (bpYt) bpYt.style.display = 'none';
  if (flCtrl) flCtrl.style.display = 'none';
  if (document.body.classList.contains('layout-bottom') && bpSlot) {
    bpSlot.style.display = ''; bpSlot.appendChild(card);
    if (flSlot) flSlot.style.display = 'none';
  } else if (document.body.classList.contains('layout-float') && flSlot) {
    flSlot.style.display = ''; flSlot.appendChild(card);
    if (bpSlot) bpSlot.style.display = 'none';
  } else {
    if (sideSlot && card.parentElement !== sideSlot) sideSlot.appendChild(card);
    if (bpSlot) bpSlot.style.display = 'none';
    if (flSlot) flSlot.style.display = 'none';
  }
}
buildMusicPanel();
relocateMusicPanel();

window.onYouTubeIframeAPIReady = function () { ytPlayer = new YT.Player('yt-player', { height: '112', width: '200', playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, iv_load_policy: 3 }, events: { onReady: () => { ytReady = true; ytPlayer.setVolume(ytVolume); }, onStateChange: onYTState, onError: onYTError } }); };
function onYTState(e) { const S = YT.PlayerState; if (e.data === S.PLAYING) { ytPlaying = true; setMusicUI('II', true, 'live', 'Now playing'); startProgress(); pollTrack(); } else if (e.data === S.PAUSED) { ytPlaying = false; setMusicUI('>', false, '', 'Paused'); stopProgress(); } else if (e.data === S.BUFFERING) { setYtStatus('Loading...'); } else if (e.data === S.ENDED) { ytPlaying = false; setMusicUI('>', false, '', 'Ended'); stopProgress(); } else if (e.data === S.CUED || e.data === S.UNSTARTED) { setYtStatus('Ready'); updateTrackMeta(); } }
function onYTError(e) { const m = { 2: 'Invalid URL', 5: 'HTML5 error', 100: 'Not found', 101: 'Embedding disabled', 150: 'Embedding disabled' }; showNotify(m[e.data] || 'YouTube error'); setYtStatusDot('error'); setYtStatus('Error'); }
function setMusicUI(icon, playing, dotCls, txt) { const b = document.getElementById('music-play-btn'); if (b) b.textContent = icon; const a = document.getElementById('track-art'); if (a) a.classList.toggle('playing', playing); setYtStatusDot(dotCls); setYtStatus(txt); }
function setYtStatusDot(c) { const e = document.getElementById('yt-status-dot'); if (e) e.className = 'yt-status-dot' + (c ? ' ' + c : ''); }
function setYtStatus(t) { const e = document.getElementById('yt-status-txt'); if (e) e.textContent = t; }
function parseYTUrl(raw) { raw = raw.trim(); if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw; try { const u = new URL(raw); return { listId: u.searchParams.get('list'), videoId: u.hostname === 'youtu.be' ? u.pathname.slice(1).split('?')[0] : u.searchParams.get('v') }; } catch (_) { return { listId: (raw.match(/[?&]list=([A-Za-z0-9_-]+)/) || [])[1] || null, videoId: (raw.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/) || [])[1] || null }; } }
function loadYTUrl() { if (!ytReady) { showNotify('Player initialising...'); return; } const inp = document.getElementById('yt-url-input'); const val = inp ? inp.value.trim() : ''; if (!val) { showNotify('Paste a YouTube URL first.'); return; } const { listId, videoId } = parseYTUrl(val); if (!listId && !videoId) { showNotify('No video/playlist ID found.'); return; } setYtStatus('Loading...'); setTrackDisplay('Loading...', ''); clearThumb();['music-play-btn', 'prev-btn', 'next-btn'].forEach(id => { const e = document.getElementById(id); if (e) e.disabled = false; }); if (listId) { ytPlayer.loadPlaylist({ listType: 'playlist', list: listId, index: 0, startSeconds: 0 }); showNotify('Playlist loading...'); } else { ytPlayer.loadVideoById(videoId, 0); showNotify('Video loading...'); } ytLoaded = true; ytPlayer.setVolume(ytVolume); }
function ytTogglePlay() { if (!ytReady || !ytLoaded) return; ytPlaying ? ytPlayer.pauseVideo() : ytPlayer.playVideo(); }
function ytNext() { if (ytReady && ytLoaded) ytPlayer.nextVideo(); }
function ytPrev() { if (ytReady && ytLoaded) ytPlayer.previousVideo(); }
function ytSetVolume(v) { ytVolume = +v; const s = document.getElementById('vol-slider'); if (s) s.style.setProperty('--pct', v + '%'); if (ytReady) ytPlayer.setVolume(ytVolume); }
function ytSeek(e) { if (!ytReady || !ytLoaded) return; const b = document.getElementById('yt-progress-bar'); ytPlayer.seekTo((e.offsetX / b.clientWidth) * ytPlayer.getDuration(), true); }
function startProgress() { stopProgress(); ytProgressIv = setInterval(() => { if (!ytReady || !ytPlaying) return; const d = ytPlayer.getDuration(), c = ytPlayer.getCurrentTime(); if (d > 0) { const pf = document.getElementById('yt-progress-fill'); if (pf) pf.style.width = ((c / d) * 100) + '%'; } }, 1000); }
function stopProgress() { if (ytProgressIv) { clearInterval(ytProgressIv); ytProgressIv = null; } }
function pollTrack() { if (ytPollIv) clearInterval(ytPollIv); ytPollIv = setInterval(() => { if (!ytReady) return; try { const d = ytPlayer.getVideoData(); if (d && d.video_id && d.video_id !== ytLastVid) { ytLastVid = d.video_id; updateTrackMeta(); } } catch (_) { } }, 1500); }
function updateTrackMeta() { if (!ytReady) return; try { const d = ytPlayer.getVideoData(); if (!d || !d.title) return; let song = d.title, artist = d.author || ''; const m = song.match(/^(.+?)\s*[-\u2013\u2014]\s*(.+)$/); if (m) { artist = m[1].trim(); song = m[2].trim(); } song = song.replace(/\s*[\(\[][^\)\]]{0,60}[\)\]]/g, '').trim(); artist = artist.replace(/\s*[\(\[][^\)\]]{0,60}[\)\]]/g, '').trim(); if (song.length > 44) song = song.slice(0, 42) + '...'; if (artist.length > 38) artist = artist.slice(0, 36) + '...'; setTrackDisplay(song || d.title, artist); if (d.video_id) loadThumb(d.video_id); } catch (_) { } }
function setTrackDisplay(name, artist) { const tn = document.getElementById('track-name'); if (tn) { tn.classList.add('fade'); setTimeout(() => { tn.textContent = name || '--'; tn.classList.remove('fade'); }, 200); } const ta = document.getElementById('track-artist'); if (ta) ta.textContent = artist || ''; const bn = document.getElementById('bp-track-name'); if (bn) bn.textContent = name || '--'; const ba = document.getElementById('bp-track-artist'); if (ba) ba.textContent = artist || ''; }
function loadThumb(vid) { const img = document.getElementById('track-thumb'), art = document.getElementById('track-art'); if (!img) return; img.onload = () => { img.classList.add('loaded'); art && art.classList.add('has-thumb'); }; img.onerror = () => { img.classList.remove('loaded'); art && art.classList.remove('has-thumb'); }; img.src = 'https://img.youtube.com/vi/' + vid + '/mqdefault.jpg'; const bi = document.getElementById('bp-track-thumb'); if (bi) bi.src = 'https://img.youtube.com/vi/' + vid + '/mqdefault.jpg'; }
function clearThumb() { const img = document.getElementById('track-thumb'), art = document.getElementById('track-art'); if (!img) return; img.src = ''; img.classList.remove('loaded'); art && art.classList.remove('has-thumb'); }

/* ====== AMBIENT ====== */
const AMBIENT_SOUNDS = [
  { file: 'focus/soft-rain-ambient-111154.mp3', label: 'Soft Rain', icon: '🌧' },
  { file: 'focus/sounds-ambience-236734.mp3', label: 'Library', icon: '📖' },
  { file: 'focus/ocean.mp3', label: 'Ocean', icon: '🌊' },
  { file: 'focus/night.mp3', label: 'Night', icon: '🌙' },
  { file: 'focus/fire.mp3', label: 'Fireplace', icon: '🔥' },
  { file: 'focus/chribonn-nature-216798.mp3', label: 'Forest Birds', icon: '🌿' },
  { file: 'focus/rain-with-thunderstorm-420333.mp3', label: 'Rain & Thunder', icon: '⛈️' },
  { file: 'focus/cold-snowfall-ambience-5-minutes-sound-effect-164512.mp3', label: 'Snowstorm', icon: '❄️ ' },
];
let ambFiles = AMBIENT_SOUNDS.map(s => ({ ...s, audio: null, playing: false })), ambVolume = 40, ambActive = null;
function renderAmbient(listId = 'amb-list', volRowId = 'amb-vol-row') {
  const list = document.getElementById(listId); if (!list) return;
  list.innerHTML = '';
  if (!ambFiles.length) { list.innerHTML = '<div style="padding:10px 13px;font-size:.68rem;color:var(--muted);font-style:italic">No ambient files.</div>'; return; }
  ambFiles.forEach((f, i) => { const item = document.createElement('div'); item.className = 'amb-item' + (f.playing ? ' playing' : ''); item.addEventListener('click', () => toggleAmb(i)); item.innerHTML = '<span class="amb-icon">' + f.icon + '</span><span class="amb-name">' + f.label + '</span><span class="amb-stop">' + (f.playing ? '&#9724;' : '') + '</span>'; list.appendChild(item); });
  const vr = document.getElementById(volRowId); if (vr) vr.style.display = 'flex';
}
function renderAllAmbient() {
  renderAmbient('amb-list', 'amb-vol-row');
  renderAmbient('bp-amb-list', 'bp-amb-vol-row');
  const flAmb = document.getElementById('fl-amb-list');
  if (flAmb) {
    flAmb.innerHTML = '';
    ambFiles.forEach((f, i) => {
      const item = document.createElement('div');
      item.className = 'float-amb-item' + (f.playing ? ' playing' : '');
      item.innerHTML = '<span class="float-amb-icon">' + f.icon + '</span><span class="float-amb-name">' + f.label + '</span>' + (f.playing ? '<span class="float-amb-stop">&#9724;</span>' : '');
      item.addEventListener('click', () => toggleAmb(i));
      flAmb.appendChild(item);
    });
    const flVr = document.getElementById('fl-amb-vol-row'); if (flVr) flVr.style.display = 'flex';
  }
}
function toggleAmb(i) { ambFiles[i].playing ? stopAmb(i) : (ambActive !== null && ambActive !== i && stopAmb(ambActive), playAmb(i)); }
function playAmb(i) { const f = ambFiles[i]; if (!f.audio) { f.audio = new Audio(f.file); f.audio.addEventListener('ended', () => { if (f.playing) { f.audio.currentTime = 0; f.audio.play().catch(() => { }) } }); } f.audio.volume = ambVolume / 100; f.audio.play().catch(() => showNotify('Could not play: ' + f.file)); f.playing = true; ambActive = i; renderAllAmbient(); showNotify(f.label + ' playing.'); }
function stopAmb(i) { const f = ambFiles[i]; if (f.audio) { f.audio.pause(); f.audio.currentTime = 0; } f.playing = false; if (ambActive === i) ambActive = null; renderAllAmbient(); }
function setAmbientVolume(v) { ambVolume = +v; document.getElementById('amb-vol-slider').style.setProperty('--apct', v + '%'); ambFiles.forEach(f => { if (f.audio) f.audio.volume = ambVolume / 100; }); }
renderAmbient();

/* ====== TIMER ====== */
const MODES = {
  focus: { label: 'Focus Session', secs: 25 * 60, color: '#5a90e8' },
  break: { label: 'Short Break', secs: 5 * 60, color: '#78c89a' },
  long: { label: 'Long Break', secs: 15 * 60, color: '#c0a0e0' },
  sixty: { label: '60 Min Session', secs: 60 * 60, color: '#f0c060' },
  deep: { label: 'Deep Work', secs: 90 * 60, color: '#a080f0' }
};
const FOCUS_MSGS = ["Breathe. Then begin.", "One thing at a time.", "The work is the practice.", "Quiet mind, clear path.", "Stay. You're doing well.", "Let nothing else exist.", "This moment is enough.", "Presence is the practice.", "Deep work, deep peace.", "Return, gently, always."];
const DEEP_MSGS = ["You are locked in.", "No distractions exist here.", "Depth over breadth, always.", "This is your work. Honor it.", "Silence is the sound of deep work.", "Flow lives here.", "Let the world fall away.", "Only this. Only now."];

let currentMode = 'focus', totalSecs = MODES.focus.secs, remaining = totalSecs, running = false, interval = null, pomodoroInCycle = 0, msgIdx = 0, deepWorkActive = false, deepMode = false, sessionStartTime = null, timerEndsAt = null;

const NSL_CLOCK_KEY = 'nsl_timer_clock';
const C = 2 * Math.PI * 110;
const $timer = document.getElementById('timer-display'), $label = document.getElementById('session-label'), $ring = document.getElementById('ring-fill'), $ringGlw = document.getElementById('ring-glow'), $msg = document.getElementById('focus-msg'), $playBtn = document.getElementById('play-btn');
const fmt = s => String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0') + ':' + String(Math.max(0, s) % 60).padStart(2, '0');

function saveClockState() {
  if (!running) { localStorage.removeItem(NSL_CLOCK_KEY); return; }
  try { localStorage.setItem(NSL_CLOCK_KEY, JSON.stringify({ timerEndsAt, totalSecs, currentMode, sessionStartTime, deepWorkActive, pomodoroInCycle })); } catch (_) { }
}
function restoreClockState() {
  try {
    const raw = localStorage.getItem(NSL_CLOCK_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || !s.timerEndsAt) return false;
    const nowRemaining = Math.floor((s.timerEndsAt - Date.now()) / 1000);
    if (nowRemaining <= 0) {
      localStorage.removeItem(NSL_CLOCK_KEY);
      currentMode = s.currentMode || 'focus'; totalSecs = MODES[currentMode].secs; remaining = 0;
      sessionStartTime = s.sessionStartTime || null; deepWorkActive = s.deepWorkActive || false; pomodoroInCycle = s.pomodoroInCycle || 0;
      return 'ended';
    }
    currentMode = s.currentMode || 'focus'; totalSecs = s.totalSecs || MODES[currentMode].secs; remaining = nowRemaining;
    timerEndsAt = s.timerEndsAt; sessionStartTime = s.sessionStartTime || null; deepWorkActive = s.deepWorkActive || false; pomodoroInCycle = s.pomodoroInCycle || 0;
    return 'running';
  } catch (_) { return false; }
}

function updateRing() {
  const off = C * (1 - remaining / totalSecs);
  $ring.style.strokeDashoffset = $ringGlw.style.strokeDashoffset = off;
  if (!deepWorkActive) {
    const col = getRingColor();
    $ring.style.stroke = $ringGlw.style.stroke = col;
    $ring.style.filter = 'drop-shadow(0 0 12px ' + col + ')';
  }
}
function updateDisplay() { $timer.textContent = fmt(remaining); updateRing(); }

function updateDeepWorkBtn() {
  const btn = document.getElementById('deep-work-btn');
  if (!btn) return;
  const mins = Math.round(MODES[currentMode].secs / 60);
  btn.innerHTML = '&#11041; Deep Focus &mdash; ' + mins + ' min';
}

function switchMode(mode) {
  if (deepWorkActive) return;
  if (running) stopTimer();
  currentMode = mode; totalSecs = MODES[mode].secs; remaining = totalSecs; timerEndsAt = null;
  $label.textContent = MODES[mode].label;
  document.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p.dataset.mode === mode));
  updateDisplay();
  $msg.textContent = (mode === 'focus' || mode === 'sixty') ? 'Begin when you are ready.' : 'Rest well.';
  document.getElementById('duration-mode-val').textContent = MODES[mode].label;
  updateDeepWorkBtn();
}

function toggleTimer() { running ? stopTimer() : startTimer(); }

function startTimer() {
  running = true;
  $playBtn.textContent = 'II'; $playBtn.classList.add('running');
  sessionStartTime = sessionStartTime || Date.now();
  timerEndsAt = Date.now() + (remaining * 1000);
  saveClockState(); broadcastTimerState(); updateHubBtn();
  deepWorkActive ? showMsg(DEEP_MSGS) : showMsg(FOCUS_MSGS);
  if (!IS_DISCORD && ytLoaded && ytReady && !ytPlaying) { try { ytPlayer.playVideo(); } catch (_) { } }
  interval = setInterval(() => {
    const nowRemaining = Math.floor((timerEndsAt - Date.now()) / 1000);
    if (nowRemaining <= 0) {
      remaining = 0; updateDisplay(); clearInterval(interval); running = false; timerEndsAt = null;
      localStorage.removeItem(NSL_CLOCK_KEY); broadcastTimerState(); onSessionEnd(); return;
    }
    remaining = nowRemaining; updateDisplay(); broadcastTimerState(); saveClockState();
  }, 1000);
}

function stopTimer() {
  running = false; clearInterval(interval); timerEndsAt = null;
  $playBtn.textContent = '▶'; $playBtn.classList.remove('running');
  if (sessionStartTime && ['focus', 'sixty', 'deep'].includes(currentMode)) {
    const el = Math.floor((Date.now() - sessionStartTime) / 60000);
    if (el >= 1) { const xp = nslRecordSession(el, MODES[currentMode].label + ' (partial)', sessionStartTime); if (xp) flashXP(xp); }
  }
  sessionStartTime = null; localStorage.removeItem(NSL_CLOCK_KEY); broadcastTimerState(); updateHubBtn();
}

function resetTimer() {
  if (deepWorkActive) return;
  if (running) stopTimer();
  remaining = totalSecs; timerEndsAt = null; updateDisplay();
  $msg.textContent = 'Begin when you are ready.'; sessionStartTime = null;
  localStorage.removeItem(NSL_CLOCK_KEY); clearTimerBroadcast(); updateHubBtn();
}
function playSkipSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [880, 659.25]; // A5 then E5 — quick, light, downward
    notes.forEach((freq, i) => {
      const delay = i * 0.09;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.001, ctx.currentTime + delay);
      g.gain.linearRampToValueAtTime(0.14, ctx.currentTime + delay + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.35);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 0.4);
    });
  } catch (_) { }
}
function skipSession() {
  if (deepWorkActive) return;
  playSkipSound();
  if (running) { running = false; clearInterval(interval); }
  timerEndsAt = null; sessionStartTime = null;
  localStorage.removeItem(NSL_CLOCK_KEY); clearTimerBroadcast(); updateHubBtn(); broadcastTimerState();
  $playBtn.textContent = '▶'; $playBtn.classList.remove('running');
  if (currentMode === 'focus' || currentMode === 'sixty') {
    showNotify('Session skipped — no credit given.');
    switchMode('break');
  } else if (currentMode === 'break' || currentMode === 'long') {
    showNotify('Break skipped.'); switchMode('focus');
  } else {
    switchMode('focus');
  }
}

function onSessionEnd() {
  $playBtn.textContent = '▶'; $playBtn.classList.remove('running'); playBell();
  const elMins = sessionStartTime ? Math.max(1, Math.round((Date.now() - sessionStartTime) / 60000)) : Math.round(totalSecs / 60);
  const sessStart = sessionStartTime;
  sessionStartTime = null; timerEndsAt = null;
  localStorage.removeItem(NSL_CLOCK_KEY); clearTimerBroadcast();
  if (deepWorkActive) {
    const xp = nslRecordSession(elMins, MODES[currentMode].label + ' (Deep Focus)', sessStart);
    if (xp) flashXP(xp); exitDeepWork(); showNotify('Deep Focus complete. Remarkable.'); return;
  }
  if (currentMode === 'focus' || currentMode === 'sixty') {
    const xp = nslRecordSession(elMins, MODES[currentMode].label, sessStart);
    if (xp) flashXP(xp); pomodoroInCycle++; updateDots();
    if (pomodoroInCycle >= 4) { pomodoroInCycle = 0; showNotify('4 sessions done. Long break earned.'); switchMode('long'); }
    else { showNotify('Done! +' + xp + ' XP. Short break.'); switchMode('break'); }
  } else if (currentMode === 'break' || currentMode === 'long') {
    showNotify('Break over. Return to the work.'); switchMode('focus');
  } else {
    showNotify('Session complete.'); switchMode('focus');
  }
}

function flashXP(amount) { const el = document.getElementById('xp-flash'); if (!el) return; el.textContent = '+' + amount + ' XP'; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2000); }
function showMsg(pool) { $msg.style.opacity = '0'; setTimeout(() => { $msg.textContent = pool[msgIdx % pool.length]; $msg.style.opacity = '1'; msgIdx++; }, 400); setTimeout(() => { if (running) showMsg(pool); }, deepWorkActive ? 120000 : 180000); }
function updateDots() { for (let i = 0; i < 4; i++)document.getElementById('d' + i).classList.toggle('done', i < pomodoroInCycle); }

/* ====== DEEP WORK — works for ANY timer mode ====== */
function enterDeepWork() {
  if (deepWorkActive) return;
  if (running) stopTimer();
  sessionStartTime = null;
  deepWorkActive = true;

  // Use whatever timer mode is currently selected — no forced 90 min
  // totalSecs and currentMode are already set correctly
  remaining = totalSecs;
  timerEndsAt = null;

  // Step 1: fade out nav & stats bar
  document.getElementById('main-nav').classList.add('deep-hide');
  document.getElementById('stats-bar').classList.add('deep-hide');

  // Step 2: 200ms later, activate deep-work body class (spotlight, ring expansion, bg pulse)
  setTimeout(() => {
    document.body.classList.add('deep-work-active', 'deep-mode');
  }, 200);

  // Step 3: slide panel away
  setTimeout(() => {
    document.getElementById('main-grid').classList.add('panel-hidden');
    document.getElementById('side-panel').classList.add('deep-hidden');
  }, 280);

  // Step 4: show locked badge, auto-start timer
  setTimeout(() => {
    document.getElementById('deep-work-btn').classList.add('hidden');
    document.getElementById('deep-work-status').classList.add('visible');
    updateDisplay();
    showNotify('Deep Focus. Everything else fades.');
    startTimer();
  }, 500);
}

function exitDeepWork() {
  stopTimer();
  deepWorkActive = false;

  // Reverse all deep work UI changes
  document.body.classList.remove('deep-work-active', 'deep-mode');
  ['main-nav', 'stats-bar'].forEach(id => document.getElementById(id).classList.remove('deep-hide'));
  document.getElementById('main-grid').classList.remove('panel-hidden');
  document.getElementById('side-panel').classList.remove('deep-hidden');
  document.getElementById('deep-work-btn').classList.remove('hidden');
  document.getElementById('deep-work-status').classList.remove('visible');

  updateStatsBar();
  switchMode('focus');
  showNotify('Deep Focus ended. Welcome back.');
}

// Light visual immersion mode (no timer lock)
function toggleDeep() {
  if (deepWorkActive) return;
  deepMode = !deepMode;
  document.body.classList.toggle('deep-mode', deepMode);
  ['main-nav', 'stats-bar'].forEach(id => document.getElementById(id).classList.toggle('deep-hide', deepMode));
  ['session-pills', 'session-dots'].forEach(id => document.getElementById(id).classList.toggle('fade-out', deepMode));
  document.getElementById('side-panel').classList.toggle('deep-hidden', deepMode);
  document.getElementById('deep-exit-btn').classList.toggle('visible', deepMode);
  showNotify(deepMode ? 'Immersion mode. Everything else fades.' : 'Returning to the light.');
}

/* ====== BELL ====== */
function playBell() { try { const ctx = new (window.AudioContext || window.webkitAudioContext)();[0, .3, .6].forEach((delay, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = [523.25, 659.25, 783.99][i]; o.type = 'sine'; g.gain.setValueAtTime(.28, ctx.currentTime + delay); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + delay + 2.2); o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 2.5); }); } catch (_) { } }



/* ====== NOTIFY ====== */
let ntTimer = null;
function showNotify(msg) { const el = document.getElementById('notify'); el.textContent = msg; el.classList.add('show'); if (ntTimer) clearTimeout(ntTimer); ntTimer = setTimeout(() => el.classList.remove('show'), 3500); }

/* ====== LAYOUT ====== */
const LAYOUTS = ['layout-side', 'layout-bottom', 'layout-float', 'layout-hidden'];
const LAYOUT_ICONS = ['&#8863;', '&#8864;', '&#9783;', '&#8865;'];
const LAYOUT_TIPS = ['Switch to bottom bar', 'Float cards', 'Hide panel', 'Show side panel'];
let layoutIdx = 1;
function cycleLayout() {
  if (deepMode || deepWorkActive) return;
  document.body.classList.remove(LAYOUTS[layoutIdx]);
  layoutIdx = (layoutIdx + 1) % LAYOUTS.length;
  document.body.classList.add(LAYOUTS[layoutIdx]);
  document.getElementById('layout-icon').innerHTML = LAYOUT_ICONS[layoutIdx];
  document.getElementById('layout-tip').textContent = LAYOUT_TIPS[layoutIdx];
  if (LAYOUTS[layoutIdx] === 'layout-bottom') renderBottomPanel();
  if (LAYOUTS[layoutIdx] === 'layout-float') renderFloatPanels();
  relocateMusicPanel();
  const msgs = ['Side panel.', 'Bottom bar.', 'Float cards.', 'Panel hidden.'];
  showNotify(msgs[layoutIdx]);
}
function renderBottomPanel() {
  // Stats
  const bpStats = document.getElementById('bp-stats-mini');
  if (bpStats) { const data = nslLoad(), today = new Date().toDateString(), ts = data.sessions.filter(s => s.date === today), tm = ts.reduce((a, s) => a + (s.duration || 0), 0), td = tm >= 60 ? Math.floor(tm / 60) + 'h' + (tm % 60) + 'm' : tm + 'm'; bpStats.innerHTML = `<div style="text-align:center"><div style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;color:#78c89a;line-height:1">${data.streak.current}</div><div style="font-size:0.46rem;letter-spacing:1px;text-transform:uppercase;color:var(--muted2);margin-top:2px">🔥</div></div><div style="text-align:center"><div style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;color:var(--accent);line-height:1">${td}</div><div style="font-size:0.46rem;letter-spacing:1px;text-transform:uppercase;color:var(--muted2);margin-top:2px">Today</div></div><div style="text-align:center"><div style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;color:var(--accent);line-height:1">${data.xp.today}</div><div style="font-size:0.46rem;letter-spacing:1px;text-transform:uppercase;color:var(--muted2);margin-top:2px">XP</div></div>`; }
  const bpDur = document.getElementById('bp-duration-val'); if (bpDur) { const d = nslLoad(), today = new Date().toDateString(), tm = d.sessions.filter(s => s.date === today).reduce((a, s) => a + (s.duration || 0), 0); bpDur.textContent = tm; }
  const bpMode = document.getElementById('bp-mode-val'); if (bpMode) bpMode.textContent = MODES[currentMode] ? MODES[currentMode].label : 'Focus Session';
  // Ambient
  renderAmbient('bp-amb-list', 'bp-amb-vol-row');
  const bpAmbVol = document.getElementById('bp-amb-vol-slider');
  if (bpAmbVol) { bpAmbVol.value = ambVolume; bpAmbVol.style.background = `linear-gradient(to right,var(--ring-break) ${ambVolume}%,var(--border) ${ambVolume}%)`; bpAmbVol.oninput = e => { setAmbientVolume(e.target.value); e.target.style.background = `linear-gradient(to right,var(--ring-break) ${e.target.value}%,var(--border) ${e.target.value}%)`; }; }
  // World strip
  const bpWS = document.getElementById('bp-world-strip');
  if (bpWS) { bpWS.innerHTML = ''; const nEl = document.createElement('button'); nEl.className = 'world-thumb' + (envState.worldId === 'none' ? ' active' : ''); nEl.dataset.world = 'none'; nEl.innerHTML = '<span class="world-thumb-bg"><img src="worlds/open-sky.jpg" alt="" onerror="this.style.display=\'none\'"></span><span class="world-thumb-label">Open Sky</span>'; nEl.addEventListener('click', () => setWorld('none')); bpWS.appendChild(nEl); WORLDS.forEach(w => bpWS.appendChild(buildWorldThumb(w))); }
  const bpWInfo = document.getElementById('bp-world-info-desc'); if (bpWInfo) { const world = WORLDS.find(w => w.id === envState.worldId); bpWInfo.textContent = world ? world.description : ''; }
  // Sanctuary room + view
  const isSanc = envState.worldId === SANCTUARY_ID;
  const bpRoomSec = document.getElementById('bp-room-section'); if (bpRoomSec) bpRoomSec.style.display = isSanc ? 'flex' : 'none';
  const bpViewSec = document.getElementById('bp-view-section'); if (bpViewSec) bpViewSec.style.display = isSanc ? 'flex' : 'none';
  if (isSanc) {
    const bpRS = document.getElementById('bp-room-strip');
    if (bpRS) { bpRS.innerHTML = ''; SANCTUARY_ROOMS.forEach(r => { const u = meetsUnlock(r.unlock); const el = document.createElement('button'); el.className = 'world-thumb' + (envState.sanctuaryRoomId === r.id ? ' active' : '') + (u ? '' : ' locked'); el.title = u ? r.title : (r.title + ' — ' + unlockLabel(r.unlock)); el.innerHTML = '<span class="world-thumb-bg"><img src="' + r.thumb + '" alt="" onerror="this.style.display=\'none\'"></span><span class="world-thumb-label">' + r.title + '</span>' + (u ? '' : '<span class="world-lock">&#128274;</span>'); el.addEventListener('click', () => { if (!u) { showNotify(r.title + ' — ' + unlockLabel(r.unlock)); return; } setRoom(r.id); }); bpRS.appendChild(el); }); }
    const bpVC = document.getElementById('bp-view-chips');
    if (bpVC) { bpVC.innerHTML = ''; const nc = document.createElement('button'); nc.className = 'bg-chip none-chip' + (!envState.sanctuaryViewId ? ' active' : ''); nc.textContent = 'None'; nc.addEventListener('click', () => setSanctuaryView(null)); bpVC.appendChild(nc); SANCTUARY_VIEWS.forEach(v => { const u = meetsUnlock(v.unlock); const c = document.createElement('button'); c.className = 'bg-chip' + (envState.sanctuaryViewId === v.id ? ' active' : '') + (u ? '' : ' disabled'); c.textContent = v.title; if (u) c.addEventListener('click', () => setSanctuaryView(v.id)); bpVC.appendChild(c); }); }
  }
  // Weather
  const bpWC = document.getElementById('bp-weather-chips');
  if (bpWC) { bpWC.innerHTML = ''; const world = WORLDS.find(w => w.id === envState.worldId); WEATHER_TYPES.forEach(wt => { const compatible = !world || world.weather.includes(wt.id); const unlocked = meetsUnlock(wt.unlock); const ok = compatible && unlocked; const btn = document.createElement('button'); btn.className = 'bg-chip' + (envState.weatherId === wt.id ? ' active' : '') + (ok ? '' : ' disabled'); btn.textContent = wt.icon + ' ' + wt.title; if (ok) btn.addEventListener('click', () => { envState.weatherId = wt.id; envSave(envState); renderWeatherChips(); renderBottomPanel(); applyWeather(); }); bpWC.appendChild(btn); }); }
  const bpWI = document.getElementById('bp-weather-intensity');
  if (bpWI) { bpWI.value = envState.weatherIntensity; bpWI.style.background = `linear-gradient(to right,var(--accent) ${envState.weatherIntensity}%,var(--border) ${envState.weatherIntensity}%)`; bpWI.oninput = e => { envState.weatherIntensity = +e.target.value; envSave(envState); applyWeather(); e.target.style.background = `linear-gradient(to right,var(--accent) ${e.target.value}%,var(--border) ${e.target.value}%)`; }; }
  // Companion
  const bpCT = document.getElementById('bp-companion-toggle-btn');
  if (bpCT) { bpCT.classList.toggle('active', envState.companionsOn); bpCT.textContent = 'Companion: ' + (envState.companionsOn ? 'On' : 'Off'); bpCT.onclick = () => { envState.companionsOn = !envState.companionsOn; envSave(envState); buildCompanionPanel(); renderCompanions(); renderBottomPanel(); showNotify(envState.companionsOn ? 'Companion present.' : 'Companion hidden.'); }; }
  const bpCC = document.getElementById('bp-companion-chips');
  if (bpCC) { bpCC.innerHTML = ''; const world = WORLDS.find(w => w.id === envState.worldId); const compatIds = world ? world.companions : COMPANIONS.map(c => c.id); COMPANIONS.filter(c => compatIds.includes(c.id)).forEach(c => { const u = meetsUnlock(c.unlock); const chip = document.createElement('button'); chip.className = 'bg-chip' + (envState.companionId === c.id ? ' active' : '') + (u ? '' : ' disabled'); chip.textContent = c.title; if (u) chip.addEventListener('click', () => { envState.companionId = c.id; envSave(envState); buildCompanionPanel(); renderCompanions(); renderBottomPanel(); }); bpCC.appendChild(chip); }); }
}

function renderFloatPanels() {
  if (!document.body.classList.contains('layout-float')) return;
  // Stats
  const flStats = document.getElementById('fl-stats');
  if (flStats) { const data = nslLoad(), today = new Date().toDateString(), ts = data.sessions.filter(s => s.date === today), tm = ts.reduce((a, s) => a + (s.duration || 0), 0), td = tm >= 60 ? Math.floor(tm / 60) + 'h' + (tm % 60) + 'm' : tm + 'm'; flStats.innerHTML = `<div style="text-align:center"><div style="font-family:'Cormorant Garamond',serif;font-size:1.4rem;color:#78c89a;line-height:1">${data.streak.current}</div><div style="font-size:0.48rem;letter-spacing:1px;text-transform:uppercase;color:var(--muted2);margin-top:3px">🔥 Streak</div></div><div style="text-align:center"><div style="font-family:'Cormorant Garamond',serif;font-size:1.4rem;color:var(--accent);line-height:1">${td}</div><div style="font-size:0.48rem;letter-spacing:1px;text-transform:uppercase;color:var(--muted2);margin-top:3px">Today</div></div><div style="text-align:center"><div style="font-family:'Cormorant Garamond',serif;font-size:1.4rem;color:var(--accent);line-height:1">${data.xp.today}</div><div style="font-size:0.48rem;letter-spacing:1px;text-transform:uppercase;color:var(--muted2);margin-top:3px">XP</div></div>`; }
  // Music compact
  const flM = document.getElementById('fl-music-ctrl');
  if (flM && !IS_DISCORD) { const tn = document.getElementById('track-name'); const ta = document.getElementById('track-artist'); flM.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><div style="width:30px;height:30px;border-radius:7px;flex-shrink:0;background:linear-gradient(135deg,#1a1208,#120c04);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:11px;overflow:hidden;position:relative"><img id="fl-track-thumb" src="${document.getElementById('track-thumb')?.src || ''}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:${document.getElementById('track-thumb')?.classList.contains('loaded') ? 1 : 0};transition:opacity .4s"><span style="position:relative;z-index:1">&#9835;</span></div><div style="flex:1;min-width:0"><div style="font-size:0.7rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tn?.textContent || 'No playlist'}</div><div style="font-size:0.58rem;color:var(--muted)">${ta?.textContent || ''}</div></div></div><div style="display:flex;align-items:center;gap:5px;margin-bottom:7px"><button class="music-nav-btn" onclick="ytPrev()">&#9198;</button><button onclick="ytTogglePlay()" style="flex:1;padding:5px;border-radius:16px;background:rgba(232,160,96,.10);border:1px solid rgba(232,160,96,.30);color:var(--accent);cursor:pointer;font-size:11px;font-family:inherit">&#9654; / &#9646;&#9646;</button><button class="music-nav-btn" onclick="ytNext()">&#9197;</button></div><div style="height:2px;border-radius:2px;background:var(--border);cursor:pointer" onclick="ytSeek(event)"><div id="fl-progress-fill" style="height:100%;border-radius:2px;background:linear-gradient(90deg,var(--accent),var(--accent2));width:${document.getElementById('yt-progress-fill')?.style.width || '0%'};transition:width 1s linear;pointer-events:none"></div></div>`; }
  // Ambient
  renderAllAmbient();
  const flAmbVol = document.getElementById('fl-amb-vol-slider');
  if (flAmbVol) { flAmbVol.value = ambVolume; flAmbVol.style.background = `linear-gradient(to right,var(--ring-break) ${ambVolume}%,var(--border) ${ambVolume}%)`; flAmbVol.oninput = e => { setAmbientVolume(e.target.value); e.target.style.background = `linear-gradient(to right,var(--ring-break) ${e.target.value}%,var(--border) ${e.target.value}%)`; }; }
  // World strip
  const flWS = document.getElementById('fl-world-strip');
  if (flWS) { flWS.innerHTML = ''; const nEl = document.createElement('button'); nEl.className = 'world-thumb' + (envState.worldId === 'none' ? ' active' : ''); nEl.dataset.world = 'none'; nEl.innerHTML = '<span class="world-thumb-bg"><img src="worlds/open-sky.jpg" alt="" onerror="this.style.display=\'none\'"></span><span class="world-thumb-label">Open Sky</span>'; nEl.addEventListener('click', () => setWorld('none')); flWS.appendChild(nEl); WORLDS.forEach(w => flWS.appendChild(buildWorldThumb(w))); }
  const flWInfo = document.getElementById('fl-world-info'); if (flWInfo) { const world = WORLDS.find(w => w.id === envState.worldId); flWInfo.textContent = world ? world.description : ''; }
  // Sanctuary
  const isSanc = envState.worldId === SANCTUARY_ID;
  const flRC = document.getElementById('fl-room-card'); if (flRC) flRC.style.display = isSanc ? '' : 'none';
  const flVC = document.getElementById('fl-view-card'); if (flVC) flVC.style.display = isSanc ? '' : 'none';
  if (isSanc) {
    const flRS = document.getElementById('fl-room-strip');
    if (flRS) { flRS.innerHTML = ''; SANCTUARY_ROOMS.forEach(r => { const u = meetsUnlock(r.unlock); const el = document.createElement('button'); el.className = 'world-thumb' + (envState.sanctuaryRoomId === r.id ? ' active' : '') + (u ? '' : ' locked'); el.title = u ? r.title : (r.title + ' — ' + unlockLabel(r.unlock)); el.innerHTML = '<span class="world-thumb-bg"><img src="' + r.thumb + '" alt="" onerror="this.style.display=\'none\'"></span><span class="world-thumb-label">' + r.title + '</span>' + (u ? '' : '<span class="world-lock">&#128274;</span>'); el.addEventListener('click', () => { if (!u) { showNotify(r.title + ' — ' + unlockLabel(r.unlock)); return; } setRoom(r.id); }); flRS.appendChild(el); }); }
    const flVChips = document.getElementById('fl-view-chips');
    if (flVChips) { flVChips.innerHTML = ''; const nc = document.createElement('button'); nc.className = 'bg-chip none-chip' + (!envState.sanctuaryViewId ? ' active' : ''); nc.textContent = 'None'; nc.addEventListener('click', () => setSanctuaryView(null)); flVChips.appendChild(nc); SANCTUARY_VIEWS.forEach(v => { const u = meetsUnlock(v.unlock); const c = document.createElement('button'); c.className = 'bg-chip' + (envState.sanctuaryViewId === v.id ? ' active' : '') + (u ? '' : ' disabled'); c.textContent = v.title; if (u) c.addEventListener('click', () => setSanctuaryView(v.id)); flVChips.appendChild(c); }); }
  }
  // Weather
  const flWC = document.getElementById('fl-weather-chips');
  if (flWC) { flWC.innerHTML = ''; const world = WORLDS.find(w => w.id === envState.worldId); WEATHER_TYPES.forEach(wt => { const compatible = !world || world.weather.includes(wt.id); const unlocked = meetsUnlock(wt.unlock); const ok = compatible && unlocked; const btn = document.createElement('button'); btn.className = 'bg-chip' + (envState.weatherId === wt.id ? ' active' : '') + (ok ? '' : ' disabled'); btn.textContent = wt.icon + ' ' + wt.title; if (ok) btn.addEventListener('click', () => { envState.weatherId = wt.id; envSave(envState); renderWeatherChips(); renderFloatPanels(); applyWeather(); }); flWC.appendChild(btn); }); }
  const flWI = document.getElementById('fl-weather-intensity');
  if (flWI) { flWI.value = envState.weatherIntensity; flWI.style.background = `linear-gradient(to right,var(--accent) ${envState.weatherIntensity}%,var(--border) ${envState.weatherIntensity}%)`; flWI.oninput = e => { envState.weatherIntensity = +e.target.value; envSave(envState); applyWeather(); e.target.style.background = `linear-gradient(to right,var(--accent) ${e.target.value}%,var(--border) ${e.target.value}%)`; }; }
  // Companion
  const flCT = document.getElementById('fl-companion-toggle-btn');
  if (flCT) { flCT.classList.toggle('active', envState.companionsOn); flCT.textContent = 'Companion: ' + (envState.companionsOn ? 'On' : 'Off'); flCT.onclick = () => { envState.companionsOn = !envState.companionsOn; envSave(envState); buildCompanionPanel(); renderCompanions(); renderFloatPanels(); showNotify(envState.companionsOn ? 'Companion present.' : 'Companion hidden.'); }; }
  const flCC = document.getElementById('fl-companion-chips');
  if (flCC) { flCC.innerHTML = ''; const world = WORLDS.find(w => w.id === envState.worldId); const compatIds = world ? world.companions : COMPANIONS.map(c => c.id); COMPANIONS.filter(c => compatIds.includes(c.id)).forEach(c => { const u = meetsUnlock(c.unlock); const chip = document.createElement('button'); chip.className = 'bg-chip' + (envState.companionId === c.id ? ' active' : '') + (u ? '' : ' disabled'); chip.textContent = c.title; if (u) chip.addEventListener('click', () => { envState.companionId = c.id; envSave(envState); buildCompanionPanel(); renderCompanions(); renderFloatPanels(); }); flCC.appendChild(chip); }); }
}

/* ====== STUDY HUB NAVIGATION ====== */
function openStudyHub() {
  saveClockState(); broadcastTimerState();
  nslShowView('hub');
}

/* ====== EVENT LISTENERS ====== */
document.getElementById('play-btn').addEventListener('click', toggleTimer);
document.getElementById('reset-btn').addEventListener('click', resetTimer);
document.getElementById('skip-btn').addEventListener('click', skipSession);
document.getElementById('layout-btn').addEventListener('click', cycleLayout);
document.getElementById('hub-btn').addEventListener('click', openStudyHub);
document.getElementById('nav-brand-link').addEventListener('click', function (e) { e.preventDefault(); openStudyHub(); });
// document.getElementById('deep-work-btn').addEventListener('click', enterDeepWork);
document.getElementById('dw-exit-btn').addEventListener('click', exitDeepWork);
document.getElementById('deep-exit-btn').addEventListener('click', toggleDeep);
document.getElementById('amb-vol-slider').addEventListener('input', e => setAmbientVolume(e.target.value));
document.querySelectorAll('.pill').forEach(pill => {
  pill.addEventListener('click', () => switchMode(pill.dataset.mode));
});
document.getElementById('bp-load-btn').addEventListener('click', () => {
  const v = document.getElementById('bp-yt-url').value.trim();
  const inp = document.getElementById('yt-url-input'); if (inp) inp.value = v;
  loadYTUrl();
});
document.getElementById('bp-music-play-btn').addEventListener('click', ytTogglePlay);
document.getElementById('bp-prev-btn').addEventListener('click', ytPrev);
document.getElementById('bp-next-btn').addEventListener('click', ytNext);
document.getElementById('bp-progress-bar').addEventListener('click', ytSeek);
document.getElementById('bp-vol-slider').addEventListener('input', e => ytSetVolume(e.target.value));

window.addEventListener('beforeunload', () => { saveClockState(); if (!running) clearTimerBroadcast(); });

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && running && timerEndsAt) {
    remaining = Math.max(0, Math.floor((timerEndsAt - Date.now()) / 1000));
    updateDisplay(); broadcastTimerState();
  }
});

/* ====== INIT ====== */
document.addEventListener('DOMContentLoaded', () => {
  const restored = restoreClockState();

  if (restored === 'running') {
    $label.textContent = MODES[currentMode].label;
    if (deepWorkActive) {
      document.body.classList.add('deep-work-active', 'deep-mode');
      ['main-nav', 'stats-bar'].forEach(id => document.getElementById(id).classList.add('deep-hide'));
      document.getElementById('deep-work-btn').classList.add('hidden');
      document.getElementById('main-grid').classList.add('panel-hidden');
      document.getElementById('side-panel').classList.add('deep-hidden');
      document.getElementById('deep-work-status').classList.add('visible');
    }
    document.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p.dataset.mode === currentMode));
    document.getElementById('duration-mode-val').textContent = MODES[currentMode].label;
    updateDots(); updateDisplay();
    running = true; $playBtn.textContent = 'II'; $playBtn.classList.add('running');
    showNotify('Timer restored — ' + fmt(remaining) + ' remaining.');
    interval = setInterval(() => {
      const nowRemaining = Math.floor((timerEndsAt - Date.now()) / 1000);
      if (nowRemaining <= 0) {
        remaining = 0; updateDisplay(); clearInterval(interval); running = false; timerEndsAt = null;
        localStorage.removeItem(NSL_CLOCK_KEY); broadcastTimerState(); onSessionEnd(); return;
      }
      remaining = nowRemaining; updateDisplay(); broadcastTimerState(); saveClockState();
    }, 1000);
    broadcastTimerState();
  } else if (restored === 'ended') {
    showNotify('Session ended while away.'); onSessionEnd();
  } else {
    updateDisplay();
  }

  updateStatsBar();
  updateHubBtn();
  updateDeepWorkBtn();
  initEnvironmentSystems();
  setInterval(updateStatsBar, 10000);
});