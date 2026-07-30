/* ═════════════════════════════════════════════════════════════
   nsl-app-debug.js — TEMPORARY diagnostic script for app.html.

   Add this ONE line near the very top of <body>, right after the
   opening <body ...> tag (before everything else, so it catches
   events from the earliest possible moment):

     <script src="js/nsl-app-debug.js"></script>

   It only logs — it doesn't change any behavior. Every line is
   prefixed "[APP-DEBUG]". Remove once we've found the issue.
═══════════════════════════════════════════════════════════════ */

(function () {
  const t0 = performance.now();
  const log = (...a) => console.log('[APP-DEBUG]', '+' + Math.round(performance.now() - t0) + 'ms', ...a);
  const err = (...a) => console.error('[APP-DEBUG]', '+' + Math.round(performance.now() - t0) + 'ms', ...a);

  log('debug script loaded. location =', window.location.href);
  log('IS_DISCORD at load =', typeof IS_DISCORD !== 'undefined' ? IS_DISCORD : 'undefined');

  /* ---- 1. Detect a REAL navigation/reload happening (as opposed
     to pushState). If this fires after you click a view-switch
     button, the page is doing a hard navigation, not an in-page
     swap — that alone would explain everything. ---- */
  window.addEventListener('beforeunload', () => {
    err('*** REAL NAVIGATION/RELOAD IS HAPPENING *** (beforeunload fired) — this document is being torn down right now.');
  });
  window.addEventListener('pagehide', (e) => {
    err('*** pagehide event *** persisted =', e.persisted, '— if persisted is false, the document is being destroyed.');
  });

  /* ---- 2. Wrap history.pushState so we see every cosmetic
     URL-only update nslShowView makes. ---- */
  const origPushState = history.pushState.bind(history);
  history.pushState = function (...args) {
    log('history.pushState called with:', args);
    return origPushState(...args);
  };

  /* ---- 3. Wrap nslShowView (if/when it exists) so every call is
     logged with before/after state. Poll briefly since script load
     order might put us before it's defined. ---- */
  function wrapShowView() {
    if (typeof window.nslShowView !== 'function' || window.__nslShowViewWrapped) return false;
    const orig = window.nslShowView;
    window.nslShowView = function (view) {
      log('nslShowView called with view =', view, '| location before =', window.location.href);
      const result = orig(view);
      log('nslShowView finished for view =', view, '| location after =', window.location.href,
        '| #view-focus display =', document.getElementById('view-focus') && document.getElementById('view-focus').style.display,
        '| #view-hub display =', document.getElementById('view-hub') && document.getElementById('view-hub').style.display);
      return result;
    };
    window.__nslShowViewWrapped = true;
    log('nslShowView successfully wrapped for logging');
    return true;
  }
  if (!wrapShowView()) {
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (wrapShowView() || tries > 40) clearInterval(iv);
      if (tries > 40) err('nslShowView was NEVER defined after 10s of polling — it may not exist on this page at all.');
    }, 250);
  }

  /* ---- 4. Confirm the two view containers actually exist. ---- */
  function checkContainers() {
    const f = document.getElementById('view-focus');
    const h = document.getElementById('view-hub');
    log('#view-focus exists?', !!f, '| #view-hub exists?', !!h);
    if (!f || !h) {
      err('One or both view containers are MISSING from this document. This page is likely NOT the merged app.html — check what is actually deployed.');
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkContainers);
  } else {
    checkContainers();
  }

  /* ---- 5. Log SDK state on demand + auto-log once ready resolves. ---- */
  function logSdkState(label) {
    log(label, '| window.__nslDiscordSdk exists?', !!window.__nslDiscordSdk,
      '| readyPromise exists?', !!window.__nslDiscordSdkReadyPromise);
  }
  logSdkState('initial SDK check');
  if (window.__nslDiscordSdkReadyPromise) {
    Promise.resolve(window.__nslDiscordSdkReadyPromise).then((r) => {
      log('shared SDK readyPromise RESOLVED as:', r);
    }).catch((e) => {
      err('shared SDK readyPromise REJECTED:', e);
    });
  } else {
    // it might be assigned slightly later by nsl-data-core.js — poll briefly
    let tries2 = 0;
    const iv2 = setInterval(() => {
      tries2++;
      if (window.__nslDiscordSdkReadyPromise) {
        clearInterval(iv2);
        logSdkState('SDK readyPromise appeared after polling');
        Promise.resolve(window.__nslDiscordSdkReadyPromise).then((r) => log('shared SDK readyPromise RESOLVED as:', r))
          .catch((e) => err('shared SDK readyPromise REJECTED:', e));
      } else if (tries2 > 40) {
        clearInterval(iv2);
        err('window.__nslDiscordSdkReadyPromise NEVER appeared after 10s — nsl-data-core.js may not be running / may not be the patched version.');
      }
    }, 250);
  }

  /* ---- 6. Capture-phase click listener on the two settings links
     (and the invite button, if present) so we see EXACTLY what
     happens at the moment of the click, before any other handler
     can stop propagation or preventDefault. ---- */
  document.addEventListener('click', function (e) {
    const a = e.target.closest && e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.includes('discord.gg') || href.includes('quietplace.space')) {
      log('--- LINK CLICKED (capture phase) ---');
      log('href =', href);
      log('IS_DISCORD right now =', typeof IS_DISCORD !== 'undefined' ? IS_DISCORD : 'undefined');
      log('defaultPrevented before any handler runs? (should be false here) =', e.defaultPrevented);
      logSdkState('SDK state at click time');
      // check again just after this tick, once other listeners (capture+bubble) have run
      setTimeout(() => {
        log('defaultPrevented AFTER all handlers ran =', e.defaultPrevented,
          '(if false, nothing called preventDefault — the browser will try its own default <a> behavior, which is what gets blocked by the sandbox)');
      }, 0);
    }
  }, true); // capture phase — runs before the page's own bubble-phase listeners

  log('all hooks installed');
})();