/* ═════════════════════════════════════════════════════════════
   nsl-session-report.js

   Implements the "send completed sessions to the backend" half of
   the Activity upgrade spec, WITHOUT removing the existing local
   XP/streak calculation yet (that stays wired up until the backend's
   session-ingestion endpoint is ready to be the source of truth —
   see nslRecordSession() in nsl-main.js and onTimerComplete() in
   data-fire.js, which now call window.nslReportSession() in addition
   to their existing local nslSave() calls).

   This file does NOT calculate XP, streaks, levels, or anything else.
   It only assembles the session event described in Activity.md and
   POSTs it. If the backend endpoint isn't live yet, failures are
   caught and logged — they never interrupt the local flow, since the
   local calc is still the source of truth for now.

   LOAD ORDER: after nsl-data-core.js / nsl-app.js (needs IS_DISCORD,
   WORKER_PREFIX, nslActiveUid, window.__nslDiscordSdk /
   window.__nslDiscordSdkReadyPromise), before nsl-main.js / data-fire.js.
═══════════════════════════════════════════════════════════════ */

/**
 * Resolves { source: 'SERVER'|'DM', guildId: string|null } for the
 * current session, per Activity.md's launch-context rules:
 *   - Discord Activity launched inside a server -> SERVER, guildId set
 *   - Discord Activity launched inside a DM     -> DM, guildId null
 *   - Plain web (not in Discord at all)         -> DM, guildId null
 *     (no server concept outside Discord, so it behaves like a DM:
 *     personal XP only, per the XP Rules section of the spec)
 */
async function nslGetLaunchContext() {
  if (!IS_DISCORD) {
    return { source: 'DM', guildId: null };
  }
  try {
    // Guard against reading .guildId before the shared SDK instance's
    // ready() handshake has actually resolved (see nsl-data-core.js —
    // window.__nslDiscordSdkReadyPromise never rejects, it resolves
    // to false on failure, so this is always safe to await).
    await window.__nslDiscordSdkReadyPromise;
    const sdk = window.__nslDiscordSdk;
    const guildId = (sdk && sdk.guildId) ? sdk.guildId : null;
    return { source: guildId ? 'SERVER' : 'DM', guildId };
  } catch (e) {
    console.warn('[NSL] Could not resolve launch context, defaulting to DM:', e);
    return { source: 'DM', guildId: null };
  }
}

/**
 * Best-effort resolution of who to attribute this session to, from
 * whatever nsl_user already has cached (set by nsl-login.js /
 * nsl-app.js during sign-in). Never throws — falls back to nulls
 * rather than blocking the report.
 */
function nslGetReportingUser() {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem('nsl_user') || '{}'); } catch (_) { }
  const uid = (typeof nslActiveUid === 'function') ? nslActiveUid() : (stored.uid || null);
  return {
    userId: uid || null,
    username: stored.name || stored.discord_user || 'Scholar',
    avatar: stored.photo || null,
  };
}

/**
 * Reports one completed study session to the backend. Fire-and-forget:
 * callers should NOT await this in a way that blocks UI, and it never
 * throws — failures are logged only.
 *
 * @param {Object} session
 * @param {number} session.durationMinutes - completed focus minutes (>= 1)
 * @param {string} [session.label]
 * @param {number} [session.startTimeMs] - ms epoch; derived from
 *   durationMinutes if omitted
 * @param {number} [session.endTimeMs] - ms epoch; defaults to now
 */
async function nslReportSession(session) {
  try {
    const durationMinutes = Math.max(0, Math.round(session.durationMinutes || 0));
    if (durationMinutes < 1) return; // nothing worth reporting

    const endTimeMs = session.endTimeMs || Date.now();
    const startTimeMs = session.startTimeMs || (endTimeMs - durationMinutes * 60000);

    const { userId, username, avatar } = nslGetReportingUser();
    if (!userId) {
      console.warn('[NSL] nslReportSession: no user id available, skipping report.');
      return;
    }

    const { source, guildId } = await nslGetLaunchContext();

    const event = {
      userId,
      username,
      avatar,
      guildId,                       // nullable — null for DM/web
      duration: durationMinutes * 60, // seconds, per the spec's example payload
      startTime: new Date(startTimeMs).toISOString(),
      endTime: new Date(endTimeMs).toISOString(),
      platform: IS_DISCORD ? 'discord_activity' : 'web',
      source,                        // 'SERVER' | 'DM'
      completed: true,
    };

    const res = await fetch(WORKER_PREFIX + '/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });

    if (!res.ok) {
      console.warn('[NSL] Session report rejected by backend:', res.status, await res.text().catch(() => ''));
    }
  } catch (e) {
    // Never let a reporting failure affect the local session flow.
    console.warn('[NSL] Session report failed (backend may not be live yet):', e);
  }
}

window.nslReportSession = nslReportSession;
window.nslGetLaunchContext = nslGetLaunchContext;
