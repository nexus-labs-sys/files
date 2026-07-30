/* ===================================================================
   PIXEL PET — CAT
   Self-contained. Draws a pixel-art cat on <canvas>, walks it around
   the bottom of the screen, and periodically climbs to the nav bar
   and back down. No external image assets required.
   =================================================================== */
(function () {
  'use strict';

  const CONFIG = {
    scale: 1.8,        // on-screen pixel size multiplier (~50px tall)
    pixelW: 30,        // sprite grid width  (26 body + 4 tail cols)
    pixelH: 24,        // sprite grid height
    groundOffset: 2,   // px gap from bottom of viewport
    walkSpeed: 1.4,    // px per 16ms tick
    climbSpeed: 1.6
  };

  const mirror = (s) => s + s.split('').reverse().join('');

  /* ---- Left-half body rows (13 cols each). Mirrored automatically. ----
     . transparent  B outline/eyes/nose/mouth  T tan fur  W white fur  P pink */
  const BODY = [
    "....B.......T", "...BTB.....TT", "..BTPTB...TTT", "..BTPTB..TTTT",
    "BTTTWWWWWTTTT", "BTTWWWWWWTTTT", "BTWWWWWWWWTTT", "BTWWWWWBWWTTT",
    "BTWWWPWBWWTTT", "BTWWWWWWWWTTB", "BTWWWWWWWWTBW", "BTWWWWWWWWTTT",
    "BTTWWWWWWTTTT", "BTTTWWWWWTTTT", "BTTWWWWWWTTTT", "BTWWWWWWWWTTT",
    "BTWWWWWWWWTTT", "BTWWWWWWWWTTT", "BTWWWWWWWWTTT", "BTWWWWWWWWTTB",
    "BTWWWWWWWB...", "BTWWWWWWWB...", "BTTWWWWWWWB..", ".....SSSSS..."
  ];
  const BODY_WALK2 = BODY.slice();
  BODY_WALK2[22] = ".TTWWWWWWWB.."; // paw-lift variant for a subtle walk bob

  /* ---- Curled tail overlay (4 extra cols, right side only) ---- */
  const TAIL = {
    10: "...B", 11: "..BT", 12: ".BTT", 13: "BTTB", 14: "BTT.",
    15: "BTT.", 16: ".BT.", 17: ".BT.", 18: "..B."
  };
  const tailRow = (i) => TAIL[i] || "....";

  const buildFrame = (bodyRows) =>
    bodyRows.map((row, i) => mirror(row) + tailRow(i));

  const SIT = buildFrame(BODY);
  const WALK1 = SIT;
  const WALK2 = buildFrame(BODY_WALK2);

  /* ---- Sleeping cat: curled blob, drawn low in the same-size canvas ---- */
  const SLEEP_LEFT = Array(16).fill("............."); // top: transparent
  SLEEP_LEFT.push(
    ".....TTT.....", "...TTTTTTT...", "..TWWWWWWWT..", ".TWWWWWWWWWT.",
    ".TWWWWWWWWWT.", ".TWBWWWWWWWT.", "..TWWWWWWWT..", "...TTTTTTT..."
  );
  const SLEEP = SLEEP_LEFT.map((row) => mirror(row) + "....");

  const FRAMES = { sit: SIT, walk1: WALK1, walk2: WALK2, climb1: WALK1, climb2: WALK2, sleep: SLEEP };

  let wrap, canvas, ctx;
  function createDom() {
    wrap = document.createElement('div');
    wrap.id = 'pixel-pet-cat';
    wrap.style.cssText =
      `position:fixed;left:0;top:0;width:${CONFIG.pixelW * CONFIG.scale}px;` +
      `height:${CONFIG.pixelH * CONFIG.scale}px;z-index:50;pointer-events:none;` +
      `filter:drop-shadow(0 4px 6px rgba(0,0,0,.4));`;
    canvas = document.createElement('canvas');
    canvas.width = CONFIG.pixelW;
    canvas.height = CONFIG.pixelH;
    canvas.style.cssText = 'width:100%;height:100%;image-rendering:pixelated;';
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    wrap.appendChild(canvas);
    document.body.appendChild(wrap);
  }

  const COLORS = {
    B: '#14100d',
    T: '#cf9767',
    W: '#fbf8f2',
    P: '#f6c9d6',
    S: 'rgba(20,15,10,0.28)'
  };

  function drawFrame(key) {
    const frame = FRAMES[key] || SIT;
    ctx.clearRect(0, 0, CONFIG.pixelW, CONFIG.pixelH);
    for (let y = 0; y < frame.length; y++) {
      const row = frame[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        ctx.fillStyle = COLORS[ch] || '#fff';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  const pet = {
    x: 40, y: 0, dir: 1, mode: 'ground', state: 'sit',
    animFrame: 0, animTimer: null, targetX: null, behaviorTimer: null
  };

  const spriteH = () => CONFIG.pixelH * CONFIG.scale;
  const spriteW = () => CONFIG.pixelW * CONFIG.scale;
  const groundY = () => window.innerHeight - spriteH() - CONFIG.groundOffset;
  const headerY = () => (document.getElementById('main-nav')?.offsetHeight || 60) - spriteH() + 10;

  function paint() {
    let key = 'sit';
    if (pet.state === 'walk') key = pet.animFrame ? 'walk2' : 'walk1';
    else if (pet.state === 'climb') key = pet.animFrame ? 'climb2' : 'climb1';
    else if (pet.state === 'sleep') key = 'sleep';
    drawFrame(key);
    canvas.style.transform = pet.dir < 0 ? 'scaleX(-1)' : 'none';
    const bob = (pet.state === 'walk' && pet.animFrame) ? -2 : 0;
    wrap.style.transform = `translate(${pet.x}px, ${pet.y + bob}px)`;
  }

  function setState(s) {
    pet.state = s;
    clearInterval(pet.animTimer);
    if (s === 'walk' || s === 'climb') {
      pet.animTimer = setInterval(() => { pet.animFrame = 1 - pet.animFrame; paint(); }, 230);
    } else {
      pet.animFrame = 0;
    }
    paint();
  }

  function walkTo(x) {
    pet.dir = x >= pet.x ? 1 : -1;
    pet.targetX = x;
    setState('walk');
  }

  function scheduleBehavior(delay) {
    clearTimeout(pet.behaviorTimer);
    pet.behaviorTimer = setTimeout(decideNextAction, delay != null ? delay : (6000 + Math.random() * 12000));
  }

  function decideNextAction() {
    if (document.hidden) { scheduleBehavior(3000); return; }

    if (pet.mode === 'on-header') {
      if (Math.random() < 0.5) {
        const maxX = window.innerWidth - spriteW() - 10;
        walkTo(10 + Math.random() * maxX);
      } else {
        pet.mode = 'climbing-down';
        setState('climb');
      }
      return;
    }

    const r = Math.random();
    if (r < 0.55) {
      const maxX = window.innerWidth - spriteW() - 10;
      walkTo(10 + Math.random() * maxX);
    } else if (r < 0.8) {
      pet.mode = 'climbing-up';
      setState('climb');
    } else if (r < 0.92) {
      setState('sleep');
      scheduleBehavior(60000 + Math.random() * 90000);
    } else {
      setState('sit');
      scheduleBehavior();
    }
  }

  let lastTs = null;
  function tick(ts) {
    if (lastTs == null) lastTs = ts;
    const dt = Math.min(48, ts - lastTs);
    lastTs = ts;

    if (pet.mode === 'ground' && pet.state === 'walk' && pet.targetX != null) {
      const step = CONFIG.walkSpeed * (dt / 16);
      if (Math.abs(pet.targetX - pet.x) <= step) {
        pet.x = pet.targetX; pet.targetX = null;
        const r = Math.random();
        setState(r < 0.7 ? 'sit' : 'sleep');
        scheduleBehavior(r < 0.7 ? undefined : (60000 + Math.random() * 60000));
      } else {
        pet.x += step * pet.dir;
      }
      paint();
    } else if (pet.mode === 'climbing-up') {
      const step = CONFIG.climbSpeed * (dt / 16);
      const target = headerY();
      if (pet.y - target <= step) {
        pet.y = target; pet.mode = 'on-header';
        setState('sit'); scheduleBehavior(4000 + Math.random() * 6000);
      } else {
        pet.y -= step; paint();
      }
    } else if (pet.mode === 'climbing-down') {
      const step = CONFIG.climbSpeed * (dt / 16);
      const target = groundY();
      if (target - pet.y <= step) {
        pet.y = target; pet.mode = 'ground';
        setState('sit'); scheduleBehavior();
      } else {
        pet.y += step; paint();
      }
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', () => { if (pet.mode === 'ground') pet.y = groundY(); });

  function init() {
    createDom();
    pet.x = 40;
    pet.y = groundY();
    setState('sit');
    scheduleBehavior(3000);
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.pixelPetCat = {
    hide: () => wrap && (wrap.style.display = 'none'),
    show: () => wrap && (wrap.style.display = 'block')
  };
})();