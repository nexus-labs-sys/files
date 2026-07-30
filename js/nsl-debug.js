/* ═════════════════════════════════════════════════════════════
   nsl-sdk-debug.js — TEMPORARY diagnostic script.

   Load this ONE script, by itself, right after discord-sdk.js and
   BEFORE nsl-data-core.js, nsl-discord-invite.js, and
   nsl-streaks-extra.js. Example:

     <script src="js/discord-sdk.js"></script>
     <script src="js/nsl-sdk-debug.js"></script>   <-- add this line
     <script src="js/firebase-bundle.js"></script>
     <script src="js/nsl-data-core.js"></script>
     ...

   It does NOT touch any of your real logic — it only logs. Every
   line is prefixed "[NSL-DEBUG]" so you can filter the console.
   Remove this script once we've found the issue.
═══════════════════════════════════════════════════════════════ */

(function () {
  const t0 = performance.now();
  const log = (...args) => console.log('[NSL-DEBUG]', '+' + Math.round(performance.now() - t0) + 'ms', ...args);
  const err = (...args) => console.error('[NSL-DEBUG]', '+' + Math.round(performance.now() - t0) + 'ms', ...args);

  log('script loaded, starting checks');

  /* ---- 1. Environment / URL params ---- */
  const params = new URLSearchParams(window.location.search);
  log('location.href =', window.location.href);
  log('location.hostname =', window.location.hostname);
  log('window.self !== window.top =', window.self !== window.top);
  log('url has frame_id =', params.has('frame_id'), '| frame_id =', params.get('frame_id'));
  log('url has instance_id =', params.has('instance_id'), '| instance_id =', params.get('instance_id'));

  const computedIsDiscord = (
    window.location.hostname.includes('discordsays.com') ||
    window.location.hostname.includes('discord.com') ||
    window.self !== window.top ||
    params.has('frame_id')
  );
  log('computed IS_DISCORD would be =', computedIsDiscord);

  /* ---- 2. Is the SDK library present yet, right now? ---- */
  log('window.DiscordSDKLib present at this point?', !!window.DiscordSDKLib);
  if (window.DiscordSDKLib) {
    log('DiscordSDKLib keys =', Object.keys(window.DiscordSDKLib));
    log('typeof DiscordSDKLib.DiscordSDK =', typeof window.DiscordSDKLib.DiscordSDK);
  }

  /* Poll for it in case it loads asynchronously after this script runs */
  let pollCount = 0;
  const poll = setInterval(() => {
    pollCount++;
    if (window.DiscordSDKLib) {
      log('DiscordSDKLib became available after', pollCount * 250, 'ms of polling');
      clearInterval(poll);
      runSdkTest();
    } else if (pollCount > 40) { // 10s
      err('DiscordSDKLib NEVER became available after 10s of polling. discord-sdk.js likely failed to load or is not a UMD/global build — check Network tab for a failed/blocked request to that file.');
      clearInterval(poll);
    }
  }, 250);

  if (window.DiscordSDKLib) runSdkTest();

  /* ---- 3. Try constructing + ready()-ing our OWN isolated test instance ----
     This is separate from your real __nslDiscordSdk, so it won't
     interfere with anything — it's purely to observe behavior. */
  function runSdkTest() {
    if (window.__nslDebugRan) return; // only run once even if both triggers fire
    window.__nslDebugRan = true;

    log('--- attempting isolated test SDK construction ---');
    const APP_ID = '1498497573365747853';
    const instanceId = params.get('instance_id') || params.get('frame_id') || null;
    log('instanceId that will be used =', instanceId);

    if (!instanceId) {
      err('instanceId is null/undefined. If you are actually inside a Discord Activity, frame_id/instance_id should be in the URL. A null instanceId is a strong candidate for why ready() hangs — the SDK may be waiting on a handshake keyed to an id it never receives from the Discord client.');
    }

    let testSdk;
    try {
      testSdk = new window.DiscordSDKLib.DiscordSDK(APP_ID, { instanceId });
      log('test SDK constructed OK:', testSdk);
    } catch (e) {
      err('test SDK construction THREW:', e);
      return;
    }

    log('calling test SDK .ready() now...');
    const readyStart = performance.now();

    const timeoutHandles = [2000, 5000, 8000, 15000].map(ms =>
      setTimeout(() => {
        err(`test SDK ready() still NOT resolved after ${ms}ms`);
      }, ms)
    );

    testSdk.ready()
      .then((res) => {
        timeoutHandles.forEach(clearTimeout);
        log('test SDK ready() RESOLVED after', Math.round(performance.now() - readyStart), 'ms. result =', res);
        log('testSdk.commands available?', !!testSdk.commands, 'openExternalLink type =', typeof (testSdk.commands && testSdk.commands.openExternalLink));
      })
      .catch((e) => {
        timeoutHandles.forEach(clearTimeout);
        err('test SDK ready() REJECTED after', Math.round(performance.now() - readyStart), 'ms. error =', e);
      });
  }

  /* ---- 4. Watch for postMessage traffic to/from the parent frame.
     Discord's SDK communicates with the client via postMessage. If
     nothing ever comes back from the parent, that points to a
     handshake-level problem (wrong origin, not actually embedded, etc). ---- */
  let messageCount = 0;
  window.addEventListener('message', (event) => {
    messageCount++;
    if (messageCount <= 20) { // cap logging so it doesn't flood
      log('postMessage #' + messageCount, 'from origin', event.origin, 'data =', event.data);
    }
  });
  setTimeout(() => {
    log('total postMessage events received in first 10s =', messageCount);
    if (messageCount === 0) {
      err('ZERO postMessage events received from anywhere in 10s. If you are testing this inside an actual Discord Activity, the parent client should be sending handshake messages. Zero messages strongly suggests this page is not actually running inside the Discord iframe context you think it is (e.g. testing directly in a normal browser tab, or the activity URL/mapping is misconfigured).');
    }
  }, 10000);

  log('all checks scheduled — watch console for the next ~10-15 seconds');
})();