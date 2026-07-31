/* ═════════════════════════════════════════════════════════════
   nsl-debug-suite.js — reusable diagnostic tool for Discord
   Activity issues (SDK handshake, view switching, external links,
   stale deploys, unhandled errors).

   USAGE:
     <script src="js/nsl-debug-suite.js"></script>
   Place it as early as possible in <body> — right after the
   opening <body ...> tag, before your other scripts — so it
   catches everything from the first moment.

   Everything logs with prefix "[NSL-DBG]". All logged events are
   also kept in memory, so even if you scroll past something or
   the console gets noisy, you can always retrieve the full
   history on demand:

     NSLDebug.dump()        → prints a clean summary to console
     NSLDebug.getLogs()     → returns the raw array of log entries
     NSLDebug.copyReport()  → copies a full text report to your
                              clipboard, ready to paste anywhere

   Safe to leave in permanently — it only observes, never changes
   app behavior. Remove the <script> tag whenever you're done.
═══════════════════════════════════════════════════════════════ */

(function () {
  const t0 = performance.now();
  const buffer = [];
  const MAX_BUFFER = 500;

  function record(level, args) {
    const entry = {
      t: Math.round(performance.now() - t0),
      level,
      msg: args.map(a => {
        try { return typeof a === 'string' ? a : JSON.stringify(a); }
        catch (_) { return String(a); }
      }).join(' ')
    };
    buffer.push(entry);
    if (buffer.length > MAX_BUFFER) buffer.shift();
    const tag = '[NSL-DBG] +' + entry.t + 'ms';
    if (level === 'error') console.error(tag, ...args);
    else if (level === 'warn') console.warn(tag, ...args);
    else console.log(tag, ...args);
  }
  const log = (...a) => record('log', a);
  const warn = (...a) => record('warn', a);
  const err = (...a) => record('error', a);

  log('nsl-debug-suite loaded. location =', window.location.href);

  /* ═══════════════════════════════════════════════════════════
     SECTION 1 — Global error / rejection capture
     Catches errors other scripts swallow or never surface,
     including the exact file/line and stack where available.
  ═══════════════════════════════════════════════════════════ */
  window.addEventListener('error', (e) => {
    err('UNCAUGHT ERROR:', e.message, '| file:', e.filename, '| line:', e.lineno + ':' + e.colno,
      '| stack:', e.error && e.error.stack ? e.error.stack : '(no stack available)');
  });
  window.addEventListener('unhandledrejection', (e) => {
    err('UNHANDLED PROMISE REJECTION:', e.reason && e.reason.message ? e.reason.message : e.reason,
      '| stack:', e.reason && e.reason.stack ? e.reason.stack : '(no stack available)');
  });

  /* ═══════════════════════════════════════════════════════════
     SECTION 2 — Environment / Discord detection
  ═══════════════════════════════════════════════════════════ */
  const params = new URLSearchParams(window.location.search);
  log('hostname =', window.location.hostname, '| self!==top =', window.self !== window.top);
  log('frame_id =', params.get('frame_id'), '| instance_id =', params.get('instance_id'),
    '| discord_proxy_ticket =', params.get('discord_proxy_ticket'));

  function checkIsDiscord() {
    log('IS_DISCORD =', typeof IS_DISCORD !== 'undefined' ? IS_DISCORD : 'NOT YET DEFINED');
  }
  checkIsDiscord();
  setTimeout(checkIsDiscord, 2000);

  /* ═══════════════════════════════════════════════════════════
     SECTION 3 — SDK instance / ready-state tracking
     Warns if MORE THAN ONE DiscordSDK gets constructed (the
     single most common cause of ready() hanging forever), and
     tracks whether the shared instance/promise ever resolves.
  ═══════════════════════════════════════════════════════════ */
  let sdkInstanceCount = 0;
  if (window.DiscordSDKLib && window.DiscordSDKLib.DiscordSDK) {
    const OrigSDK = window.DiscordSDKLib.DiscordSDK;
    window.DiscordSDKLib.DiscordSDK = function (...args) {
      sdkInstanceCount++;
      log('DiscordSDK CONSTRUCTED — instance #' + sdkInstanceCount, '| args:', args);
      if (sdkInstanceCount > 1) {
        err('*** MULTIPLE SDK INSTANCES DETECTED (#' + sdkInstanceCount + ') ***',
          'This is the #1 known cause of ready() hanging forever — Discord only sends the READY payload once per session. Check for duplicate SDK construction across your scripts.');
      }
      const instance = new OrigSDK(...args);
      const origReady = instance.ready.bind(instance);
      instance.ready = function () {
        const readyStart = performance.now();
        log('ready() called on instance #' + sdkInstanceCount);
        const p = origReady();
        p.then((r) => log('ready() RESOLVED for instance #' + sdkInstanceCount, 'after', Math.round(performance.now() - readyStart), 'ms'))
          .catch((e2) => err('ready() REJECTED for instance #' + sdkInstanceCount, e2));
        [3000, 8000, 15000].forEach(ms => {
          setTimeout(() => {
            p.then(() => { }, () => { }); // already logged above if settled
          }, ms);
        });
        return p;
      };
      return instance;
    };
    log('DiscordSDK constructor wrapped for instance-count tracking');
  } else {
    warn('window.DiscordSDKLib.DiscordSDK not available yet at debug-suite load time — will not be able to count instances created before this point.');
  }

  function pollSharedSdkState() {
    log('window.__nslDiscordSdk exists?', !!window.__nslDiscordSdk,
      '| window.__nslDiscordSdkReadyPromise exists?', !!window.__nslDiscordSdkReadyPromise);
    if (window.__nslDiscordSdkReadyPromise) {
      Promise.resolve(window.__nslDiscordSdkReadyPromise)
        .then(r => log('shared readyPromise resolved as:', r))
        .catch(e2 => err('shared readyPromise rejected:', e2));
    }
  }
  setTimeout(pollSharedSdkState, 1500);
  setTimeout(pollSharedSdkState, 8000);

  /* ═══════════════════════════════════════════════════════════
     SECTION 4 — Real navigation vs in-page view switch
  ═══════════════════════════════════════════════════════════ */
  window.addEventListener('beforeunload', () => {
    err('*** REAL NAVIGATION/RELOAD *** — this document is being torn down. If this happens after a view-switch click, the SPA merge is not actually working (still doing a hard navigation).');
  });
  const origPushState = history.pushState.bind(history);
  history.pushState = function (...args) {
    log('history.pushState:', args[2] || args);
    return origPushState(...args);
  };

  /* ═══════════════════════════════════════════════════════════
     SECTION 5 — Script load / version verification
     Detects duplicate loads of core scripts (another common
     cause of multiple-SDK-instance bugs) and missing files.
  ═══════════════════════════════════════════════════════════ */
  function checkScripts() {
    const srcs = Array.from(document.querySelectorAll('script[src]')).map(s => s.getAttribute('src'));
    log('all <script src> tags on page:', srcs);
    const counts = {};
    srcs.forEach(s => {
      const base = s.split('/').pop();
      counts[base] = (counts[base] || 0) + 1;
    });
    Object.entries(counts).forEach(([name, n]) => {
      if (n > 1) err('DUPLICATE SCRIPT TAG:', name, 'appears', n, 'times — this can cause double-initialization bugs (e.g. a second competing SDK instance).');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', checkScripts);
  else checkScripts();

  /* ═══════════════════════════════════════════════════════════
     SECTION 6 — External link click tracing
     Traces every click on an <a> pointing at an external domain:
     whether it got intercepted, SDK state at click time, and the
     actual resolved/rejected outcome of openExternalLink.
  ═══════════════════════════════════════════════════════════ */
  document.addEventListener('click', function (e) {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    let url;
    try { url = new URL(a.href, window.location.href); } catch (_) { return; }
    if (url.hostname === window.location.hostname) return; // internal link, not interesting

    log('--- EXTERNAL LINK CLICKED ---', 'href =', a.href);
    log('IS_DISCORD =', typeof IS_DISCORD !== 'undefined' ? IS_DISCORD : 'undefined',
      '| sdk exists =', !!window.__nslDiscordSdk);

    setTimeout(() => {
      log('defaultPrevented after handlers =', e.defaultPrevented,
        e.defaultPrevented
          ? '(intercepted — should route through openExternalLink)'
          : '(NOT intercepted — browser will try native behavior, which the sandbox will block)');
    }, 0);

    if (window.__nslDiscordSdk && window.__nslDiscordSdk.commands && window.__nslDiscordSdkReadyPromise) {
      Promise.resolve(window.__nslDiscordSdkReadyPromise).then((isReady) => {
        log('SDK ready state at click resolution time:', isReady);
      });
    }
  }, true);

  /* ═══════════════════════════════════════════════════════════
     SECTION 7 — Public API for pulling a full report on demand
  ═══════════════════════════════════════════════════════════ */
  window.NSLDebug = {
    getLogs: () => buffer.slice(),
    dump: () => {
      console.log('%c=== NSL DEBUG SUITE REPORT ===', 'font-weight:bold;font-size:14px');
      buffer.forEach(en => {
        const fn = en.level === 'error' ? console.error : en.level === 'warn' ? console.warn : console.log;
        fn('+' + en.t + 'ms', en.msg);
      });
    },
    copyReport: () => {
      const text = buffer.map(en => `+${en.t}ms [${en.level}] ${en.msg}`).join('\n');
      const full = `NSL Debug Report — ${new Date().toISOString()}\nURL: ${window.location.href}\n\n${text}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(full).then(
          () => console.log('%cReport copied to clipboard.', 'color:green'),
          () => console.log('Clipboard write failed — printing instead:\n' + full)
        );
      } else {
        console.log(full);
      }
      return full;
    }
  };

  log('nsl-debug-suite fully installed. Run NSLDebug.dump() or NSLDebug.copyReport() anytime to get the full history.');
})();