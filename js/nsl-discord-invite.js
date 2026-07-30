/* ═════════════════════════════════════════════════════════════
   nsl-discord-invite.js

   Handles the Discord server-invite button ("discord-invite-btn")
   across every NSL page. Discord's Activity iframe is sandboxed
   without 'allow-popups', so a normal <a target="_blank"> or
   window.open() gets silently blocked by the browser with:

     "Blocked opening '...' in a new window because the request
      was made in a sandboxed frame whose 'allow-popups'
      permission is not set."

   The only reliable way to open an external link from inside a
   Discord Activity is the SDK's own openExternalLink command.
   On the normal web (outside Discord), this script does nothing
   and the button's native <a href target="_blank"> behavior is
   left completely untouched.

   SAFE TO INCLUDE ON ANY PAGE:
   - If the page has no #discord-invite-btn element, this script
     simply does nothing (no errors, no crashes).
   - If IS_DISCORD / DiscordSDKLib / NSL_INSTANCE_ID aren't ready
     yet, this script quietly no-ops rather than throwing.
   - Works whether loaded before or after the DOM is ready.

   LOAD ORDER REQUIREMENT:
   Must load AFTER js/discord-sdk.js and AFTER js/nsl-data-core.js
   (or any script that sets window.NSL_INSTANCE_ID / NSL_FRAME_ID),
   since it depends on IS_DISCORD, window.DiscordSDKLib, and those
   two globals already being defined.

   Example tag order:
     <script src="js/discord-sdk.js"></script>
     <script src="js/firebase-bundle.js"></script>
     <script src="js/nsl-data-core.js"></script>
     <script src="js/nsl-discord-invite.js"></script>
     <script src="data-fire.js"></script>   <!-- or focus.html's inline script -->
═══════════════════════════════════════════════════════════════ */

(function () {
  const NSL_DISCORD_APP_ID = '1532256337990389880';
  const NSL_DISCORD_INVITE_URL = 'https://discord.gg/SNhzuKCvhw';
  console.log('[NSL] nsl-discord-invite.js loaded. IS_DISCORD =', typeof IS_DISCORD !== 'undefined' ? IS_DISCORD : 'undefined');

  /* ---- Reuse the ONE shared SDK instance created in nsl-data-core.js.
     Do not create a second DiscordSDK instance here — that was causing
     ready() to hang (two instances racing for the same instanceId). ---- */
  function nslOpenDiscordInvite(e) {
    console.log('[NSL] invite button clicked. IS_DISCORD:', IS_DISCORD, 'shared sdk:', window.__nslDiscordSdk);
    if (typeof IS_DISCORD === 'undefined' || !IS_DISCORD) {
      // Not inside Discord — do nothing, let the normal
      // <a href target="_blank"> behavior handle the click.
      return;
    }

    e.preventDefault();

    Promise.resolve(window.__nslDiscordSdkReadyPromise).then((isReady) => {
      const sdk = window.__nslDiscordSdk;
      if (isReady && sdk && sdk.commands && typeof sdk.commands.openExternalLink === 'function') {
        sdk.commands.openExternalLink({ url: NSL_DISCORD_INVITE_URL })
          .then(res => console.log('[NSL] openExternalLink resolved:', res))
          .catch(err => console.error('[NSL] openExternalLink rejected:', err));
      } else {
        console.warn('[NSL] Discord SDK not ready yet — try again in a moment.');
      }
    });
  }

  function nslWireInviteButton() {
    const btn = document.getElementById('discord-invite-btn');
    console.log('[NSL] discord-invite-btn found?', !!btn);
    if (!btn) return;
    btn.addEventListener('click', nslOpenDiscordInvite);
  }

  function nslInit() {
    nslWireInviteButton();
  }

  /* Run once the DOM is ready, regardless of whether this script is
     loaded in the <head>, mid-body, or at the very bottom of <body>. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', nslInit);
  } else {
    // DOM is already ready (script loaded at bottom of body, after
    // the button markup already exists) — run immediately.
    nslInit();
  }
})();