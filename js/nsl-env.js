const startupParams = new URLSearchParams(window.location.search);

const DISCORD_INSTANCE_ID = startupParams.get("frame_id") || startupParams.get("instance_id");
/* IS_DISCORD is already declared by nsl-data-core.js (loaded before this file)
   — that's the single source of truth, so we reuse it here instead of redeclaring it. */

console.log(
  "[NSL] frame_id:",
  startupParams.get("frame_id")
);

console.log(
  "[NSL] instance_id:",
  startupParams.get("instance_id")
);

function nslIsPhoneDevice() {
  var ua = navigator.userAgent || navigator.vendor || window.opera || "";

  var phoneUA = /iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|IEMobile|Opera Mini/i;
  if (phoneUA.test(ua)) return true;

  if (/Discord-Android|Discord-iOS/i.test(ua)) return true;

  var smallestSide = Math.min(window.innerWidth, window.innerHeight);
  var hasCoarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (hasCoarsePointer && smallestSide <= 500) return true;

  return false;
}

function nslShowDeviceBlocked() {
  var el = document.getElementById("device-blocked");
  if (el) el.classList.add("active");
}

if (nslIsPhoneDevice()) {
  nslShowDeviceBlocked();
  throw new Error("[NSL] Blocked — phone device detected (Discord mobile or mobile web). Please open on a PC.");
}

if (
  window.location.hostname.includes("discordsays.com") &&
  !DISCORD_INSTANCE_ID
) {
  document.getElementById("discord-gate").classList.add("active");

  throw new Error(
    "[NSL] Waiting for Discord instance_id..."
  );
}