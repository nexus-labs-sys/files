/* ═════════════════════════════════════════════════════════════
   nslShowView — in-page view switcher (Focus <-> Study Hub).

   Replaces the old window.location.href navigation between
   app.html and streak.html. A real navigation tears down the
   Discord Activity SDK's RPC handshake (it only survives on the
   first document ever loaded into the Activity iframe), so
   switching "pages" now just toggles which view container is
   visible in this same document. No navigation, no dead handshake.
═══════════════════════════════════════════════════════════════ */

function nslShowView(view) {
  const focusEl = document.getElementById('view-focus');
  const hubEl = document.getElementById('view-hub');
  if (!focusEl || !hubEl) return;
  const showingHub = view === 'hub';

  focusEl.style.display = showingHub ? 'none' : '';
  hubEl.style.display = showingHub ? '' : 'none';

  /* No pushState here anymore — everything lives in this one app.html now,
     so faking the URL to say streak.html/app.html only causes a 404 if the
     person refreshes on it. */

  // Refresh whichever view just became visible, in case data changed
  // while it was hidden (elapsed timer, new sessions logged, etc.)
  if (showingHub) {
    if (typeof refreshAllData === 'function') { try { refreshAllData(); } catch (_) { } }
    if (typeof refreshStreakUI === 'function') { try { refreshStreakUI(); } catch (_) { } }
    if (typeof refreshDashboardStats === 'function') { try { refreshDashboardStats(); } catch (_) { } }
  } else {
    if (typeof updateStatsBar === 'function') { try { updateStatsBar(); } catch (_) { } }
  }

  window.dispatchEvent(new CustomEvent('nsl-view-changed', { detail: { view: showingHub ? 'hub' : 'focus' } }));
}
window.nslShowView = nslShowView;