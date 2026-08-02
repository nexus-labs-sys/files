// #------------------------------------
/* ═════════════════════════════════════════════════════════════
   nsl-streak-extras.js
   Purely additive streak features. Read-only against nslLoad();
   never calls nslSave() or touches the core data shape.
   Safe to include on any page that already loads
   nsl-data-core.js + data-fire.js (needs nslLoad, showToast,
   nslOnReady to exist globally).
═══════════════════════════════════════════════════════════════ */

(function () {
  const MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];

  /* Use a separate, dedicated localStorage key — never touches
     nsl_data_<uid>, so it can't affect sync/merge logic at all. */
  function _extrasKey() {
    const uid = (typeof nslActiveUid === 'function') ? nslActiveUid() : null;
    return uid ? ('nsl_streak_extras_' + uid) : 'nsl_streak_extras_guest';
  }

  function _loadExtras() {
    try {
      const raw = localStorage.getItem(_extrasKey());
      return raw ? JSON.parse(raw) : { celebrated: [], lastRiskNudge: null };
    } catch (_) {
      return { celebrated: [], lastRiskNudge: null };
    }
  }

  function _saveExtras(state) {
    try { localStorage.setItem(_extrasKey(), JSON.stringify(state)); } catch (_) { }
  }

  /* ---- Milestone celebration ---- */
  function checkStreakMilestone() {
    const data = nslLoad();
    const current = data.streak ? data.streak.current : 0;
    if (!current) return;

    const state = _loadExtras();
    if (!Array.isArray(state.celebrated)) state.celebrated = [];

    const hit = MILESTONES.find(m => m === current && !state.celebrated.includes(m));
    if (!hit) return;

    state.celebrated.push(hit);
    _saveExtras(state);

    showToast('🎉', hit + '-day streak! You\'re on fire.');
  }

  /* ---- Streak-at-risk evening nudge ---- */
  function checkStreakRisk() {
    const data = nslLoad();
    const current = data.streak ? data.streak.current : 0;
    if (!current) return; // no streak to protect yet

    const today = new Date().toDateString();
    const studiedToday = data.streak.lastStudyDate === today;
    if (studiedToday) return;

    const hour = new Date().getHours();
    if (hour < 20) return; // only nudge from 8pm onward

    const state = _loadExtras();
    if (state.lastRiskNudge === today) return; // already nudged today

    state.lastRiskNudge = today;
    _saveExtras(state);

    showToast('⏳', 'Your ' + current + '-day streak is still waiting on you today!');
  }

  function runStreakChecks() {
    checkStreakMilestone();
    checkStreakRisk();
  }

  /* Run once data/auth is ready, then periodically. */
  if (typeof nslOnReady === 'function') {
    nslOnReady(() => {
      runStreakChecks();
      setInterval(runStreakChecks, 60000); // check every minute
    });
  } else {
    // Fallback if nslOnReady isn't available for some reason
    setInterval(runStreakChecks, 60000);
  }
})();
/* ═════════════════════════════════════════════════════════════
   BACKGROUND PICKER
   Purely additive UI. Selection is stored in the SAME dedicated
   extras key as the streak nudges above (nsl_streak_extras_<uid>)
   — never in nsl_data_<uid>, so it can't touch core sync/merge.

   Edit the `src` values below once your images are ready
   (e.g. '/images/bg1.jpg'). Leave a src as null to disable that
   slot — it just won't render a preview image, the button still
   works and shows its label.
═══════════════════════════════════════════════════════════════ */
(function () {
  const NSL_BACKGROUNDS = [
    { id: 'none', label: 'Default', src: null },
    { id: 'bg1', label: 'Background 1', src: 'backgrounds/bg1.jpg' },
    { id: 'bg2', label: 'Background 2', src: 'backgrounds/bg2.jpg' },
    { id: 'bg3', label: 'Background 3', src: 'backgrounds/bg5.jpg' },
    { id: 'bg4', label: 'Background 4', src: 'backgrounds/bg6.jpg' },
    { id: 'bg5', label: 'Background 5', src: 'backgrounds/bg7.jpg' },
    { id: 'bg6', label: 'Background 6', src: 'backgrounds/none.jpg' },
    { id: 'bg7', label: 'Background 7', src: 'backgrounds/g3.jpg' },
    { id: 'bg8', label: 'Background 8', src: 'backgrounds/g4.jpg' }
  ];

  function _extrasKey() {
    const uid = (typeof nslActiveUid === 'function') ? nslActiveUid() : null;
    return uid ? ('nsl_streak_extras_' + uid) : 'nsl_streak_extras_guest';
  }
  function _loadExtras() {
    try {
      const raw = localStorage.getItem(_extrasKey());
      return raw ? JSON.parse(raw) : {};
    } catch (_) { return {}; }
  }
  function _saveExtras(state) {
    try { localStorage.setItem(_extrasKey(), JSON.stringify(state)); } catch (_) { }
  }

  function _injectStyle() {
    if (document.getElementById('nsl-bg-style')) return;
    const style = document.createElement('style');
    style.id = 'nsl-bg-style';
    style.textContent = `
      #nsl-bg-photo{position:fixed;inset:0;z-index:0;background-size:cover;background-position:center;background-repeat:no-repeat;transition:opacity .6s ease;opacity:0;pointer-events:none}
      body.nsl-bg-active #nsl-bg-photo{opacity:1}
      body.nsl-bg-active #bg-layer{display:none}
      body.nsl-bg-active #particles-wrap{display:none}
      .nsl-bg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:4px}
      .nsl-bg-swatch{aspect-ratio:1.4;border-radius:12px;border:1px solid var(--border);background-color:rgba(255,255,255,0.04);background-size:cover;background-position:center;cursor:pointer;display:flex;align-items:flex-end;justify-content:center;padding:6px;transition:var(--transition);position:relative;overflow:hidden;-webkit-tap-highlight-color:transparent}
      .nsl-bg-swatch span{font-size:9.5px;color:var(--text-dim);background:rgba(0,0,0,0.45);padding:2px 7px;border-radius:50px}
      .nsl-bg-swatch:hover{border-color:var(--border-glow)}
      .nsl-bg-swatch.selected{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
      @media(max-width:640px){.nsl-bg-grid{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(style);
  }

  function applyBackground(id) {
    const bg = NSL_BACKGROUNDS.find(b => b.id === id) || NSL_BACKGROUNDS[0];
    const photo = document.getElementById('nsl-bg-photo');
    if (!photo) return;
    if (!bg.src) {
      document.body.classList.remove('nsl-bg-active');
      photo.style.backgroundImage = '';
    } else {
      photo.style.backgroundImage = `url('${bg.src}')`;
      document.body.classList.add('nsl-bg-active');
    }
    document.querySelectorAll('.nsl-bg-swatch').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === bg.id);
    });
  }

  function setBackground(id) {
    const state = _loadExtras();
    state.backgroundId = id;
    _saveExtras(state);
    applyBackground(id);
  }
  window.nslSetBackground = setBackground; // handy for a quick console override too

  function buildSettingsUI() {
    const grid = document.querySelector('#view-settings .grid');
    if (!grid || document.getElementById('nsl-bg-card')) return;

    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'nsl-bg-card';
    card.innerHTML = '<div class="card-title">🖼 Background</div><div class="nsl-bg-grid" id="nsl-bg-grid"></div>';
    grid.appendChild(card);

    const bgGrid = card.querySelector('#nsl-bg-grid');
    NSL_BACKGROUNDS.forEach(bg => {
      const sw = document.createElement('div');
      sw.className = 'nsl-bg-swatch';
      sw.dataset.id = bg.id;
      if (bg.src) sw.style.backgroundImage = `url('${bg.src}')`;
      sw.innerHTML = `<span>${bg.label}</span>`;
      sw.addEventListener('click', () => setBackground(bg.id));
      bgGrid.appendChild(sw);
    });
  }

  function init() {
    if (!document.getElementById('nsl-bg-photo')) {
      const photo = document.createElement('div');
      photo.id = 'nsl-bg-photo';
      // In the merged app.html, scope this inside #view-hub so it's hidden
      // along with the rest of the hub when the Focus view is active.
      // On standalone streak.html, #view-hub won't exist, so fall back to body.
      const hubRoot = document.getElementById('view-hub');
      if (hubRoot) hubRoot.insertBefore(photo, hubRoot.firstChild);
      else document.body.insertBefore(photo, document.body.firstChild);
    }
    _injectStyle();
    buildSettingsUI();
    applyBackground(_loadExtras().backgroundId || 'none');
  }

  if (typeof nslOnReady === 'function') nslOnReady(init);
  else document.addEventListener('DOMContentLoaded', init);
})();

/* ═════════════════════════════════════════════════════════════
   ANNOUNCEMENT BANNER
   For "hey, an update is happening from X to Y" type messages.
   Add an entry to NSL_ANNOUNCEMENTS (below) any time you need to
   broadcast something — it only shows while `now` is between
   start and end, and disappears on its own once `end` passes.
   Dismissing it hides it for that user for good (tracked by id
   in the extras key) — give a NEW id if you want it to show again
   for people who already dismissed an older one.

   start/end are local time, ISO format, no timezone suffix, e.g.
   '2026-08-01T21:00:00'.
═══════════════════════════════════════════════════════════════ */
(function () {
  const NSL_ANNOUNCEMENTS = [
    {
      id: 'maint-2026-08-01',
      message: 'Scheduled update tonight — some features may be briefly unavailable.',
      start: '2026-06-06T00:00:00',
      end: '2026-12-31T00:00:00',
      link: null // optional: { label: 'Details', url: 'https://...' }
    }
  ];

  function _extrasKey() {
    const uid = (typeof nslActiveUid === 'function') ? nslActiveUid() : null;
    return uid ? ('nsl_streak_extras_' + uid) : 'nsl_streak_extras_guest';
  }
  function _loadExtras() {
    try {
      const raw = localStorage.getItem(_extrasKey());
      return raw ? JSON.parse(raw) : {};
    } catch (_) { return {}; }
  }
  function _saveExtras(state) {
    try { localStorage.setItem(_extrasKey(), JSON.stringify(state)); } catch (_) { }
  }

  function _injectStyle() {
    if (document.getElementById('nsl-announce-style')) return;
    const style = document.createElement('style');
    style.id = 'nsl-announce-style';
    style.textContent = `
      #nsl-announce-banner{position:fixed;top:0;left:0;right:0;z-index:9500;display:flex;align-items:center;gap:14px;justify-content:center;padding:10px 44px 10px 16px;font-size:12.5px;color:var(--cream);background:linear-gradient(90deg,rgba(232,149,42,0.24),rgba(232,149,42,0.12));border-bottom:1px solid var(--border-glow);backdrop-filter:blur(14px);transform:translateY(-100%);transition:transform .4s cubic-bezier(0.4,0,0.2,1);text-align:center}
      #nsl-announce-banner.show{transform:none}
      #nsl-announce-banner .nsl-announce-close{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-dim);font-size:16px;cursor:pointer;padding:4px 8px;line-height:1}
      #nsl-announce-banner .nsl-announce-close:hover{color:var(--cream)}
      body.nsl-announce-open .sidebar{top:38px}
      body.nsl-announce-open .main{padding-top:64px}
      @media(max-width:640px){
        #nsl-announce-banner{font-size:11.5px;padding:9px 38px 9px 12px}
        body.nsl-announce-open .main{padding-top:54px}
      }
    `;
    document.head.appendChild(style);
  }

  function activeAnnouncement() {
    const now = Date.now();
    const dismissed = _loadExtras().dismissedAnnouncements || [];
    return NSL_ANNOUNCEMENTS.find(a => {
      const s = new Date(a.start).getTime(), e = new Date(a.end).getTime();
      return now >= s && now <= e && !dismissed.includes(a.id);
    }) || null;
  }

  function dismiss(id) {
    const state = _loadExtras();
    if (!Array.isArray(state.dismissedAnnouncements)) state.dismissedAnnouncements = [];
    if (!state.dismissedAnnouncements.includes(id)) state.dismissedAnnouncements.push(id);
    _saveExtras(state);
    render();
  }

  function render() {
    const a = activeAnnouncement();
    let el = document.getElementById('nsl-announce-banner');
    if (!a) {
      if (el) { el.classList.remove('show'); document.body.classList.remove('nsl-announce-open'); }
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'nsl-announce-banner';
      document.body.appendChild(el);
    }
    const linkHtml = a.link
      ? ' <a href="' + a.link.url + '" class="nsl-announce-link" rel="noopener" style="color:var(--accent);text-decoration:underline;margin-left:6px">' + a.link.label + '</a>'
      : '';
    el.innerHTML = '<span>📢 ' + a.message + linkHtml + '</span><button class="nsl-announce-close" title="Dismiss">×</button>';
    el.querySelector('.nsl-announce-close').onclick = () => dismiss(a.id);
    const linkEl = el.querySelector('.nsl-announce-link');
    if (linkEl) {
      // Same reasoning as the essential links below — target="_blank"
      // gets blocked in the sandboxed Discord Activity iframe.
      linkEl.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof window.nslOpenExternalLink === 'function') window.nslOpenExternalLink(a.link.url);
        else window.open(a.link.url, '_blank', 'noopener');
      });
    }
    requestAnimationFrame(() => {
      el.classList.add('show');
      document.body.classList.add('nsl-announce-open');
    });
  }

  function init() {
    _injectStyle();
    render();
    setInterval(render, 60000);
  }

  if (typeof nslOnReady === 'function') nslOnReady(init);
  else document.addEventListener('DOMContentLoaded', init);
})();

/* ═════════════════════════════════════════════════════════════
   ESSENTIAL / BRAND LINKS
   Add entries to NSL_ESSENTIAL_LINKS to show a row of link pills
   in Settings (Discord invite, website, GitHub, etc). Leave the
   array empty and this section just won't render anything.
═══════════════════════════════════════════════════════════════ */
(function () {
  const NSL_ESSENTIAL_LINKS = [
    { label: 'Discord', url: 'https://discord.gg/9pBJs3w9RU', icon: '💬' },
    { label: 'Website', url: 'https://quietplace.space', icon: '🌐' },
  ];

  function _injectStyle() {
    if (document.getElementById('nsl-links-style')) return;
    const style = document.createElement('style');
    style.id = 'nsl-links-style';
    style.textContent = `
      .nsl-links-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
      .nsl-link-pill{display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:50px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-dim);font-size:12px;text-decoration:none;transition:var(--transition)}
      .nsl-link-pill:hover{border-color:var(--border-glow);color:var(--accent);background:var(--accent-dim)}
    `;
    document.head.appendChild(style);
  }

  function buildUI() {
    if (!NSL_ESSENTIAL_LINKS.length) return;
    const grid = document.querySelector('#view-settings .grid');
    if (!grid || document.getElementById('nsl-links-card')) return;

    _injectStyle();
    const card = document.createElement('div');
    card.className = 'card col-span-2';
    card.id = 'nsl-links-card';
    card.innerHTML = '<div class="card-title">🔗 Links</div><div class="nsl-links-row" id="nsl-links-row"></div>';
    grid.appendChild(card);
    const row = card.querySelector('#nsl-links-row');
    NSL_ESSENTIAL_LINKS.forEach(l => {
      const a = document.createElement('a');
      a.className = 'nsl-link-pill';
      a.href = l.url;
      a.rel = 'noopener';
      a.innerHTML = '<span>' + (l.icon || '🔗') + '</span><span>' + l.label + '</span>';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof window.nslOpenExternalLink === 'function') window.nslOpenExternalLink(l.url);
        else window.open(l.url, '_blank', 'noopener');
      });
      row.appendChild(a);
    });
  }

  if (typeof nslOnReady === 'function') nslOnReady(buildUI);
  else document.addEventListener('DOMContentLoaded', buildUI);
})();

(function () {
  function applyHubTheme(mode) {
    const hub = document.getElementById('view-hub');
    if (!hub) return;
    let night;
    if (mode === 'night') night = true;
    else if (mode === 'day') night = false;
    else { const h = new Date().getHours(); night = (h < 6 || h >= 18); }
    hub.classList.toggle('night', night);
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === mode));
    try { localStorage.setItem('nsl_hub_theme', mode); } catch (_) { }
  }
  window.nslApplyHubTheme = applyHubTheme;

  function init() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => applyHubTheme(btn.dataset.theme));
    });
    let saved = 'auto';
    try { saved = localStorage.getItem('nsl_hub_theme') || 'auto'; } catch (_) { }
    applyHubTheme(saved);
  }

  if (typeof nslOnReady === 'function') nslOnReady(init);
  else document.addEventListener('DOMContentLoaded', init);
})();