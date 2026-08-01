
function nslEnterApp() {
  document.getElementById('login-gate').style.display = 'none';
  document.getElementById('app-content').style.display = '';
  window.dispatchEvent(new CustomEvent('nsl-authed'));
}

console.log("BUILD_TEST_2026_06_18_v1");
const startupParams = new URLSearchParams(window.location.search);

const DISCORD_INSTANCE_ID = startupParams.get("frame_id") || startupParams.get("instance_id");
const NSL_IS_DISCORD =
  window.location.hostname.includes("discordsays.com") ||
  window.self !== window.top ||
  !!DISCORD_INSTANCE_ID;

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

const DISCORD_APP_ID = "1532256337990389880";

const L_WORKER_PREFIX = NSL_IS_DISCORD
  ? "/worker"
  : "https://aged-cloud-bfd5.priyan-node.workers.dev/";
const DISCORD_REDIRECT_URI = "https://nexus-labs-sys.github.io/files/";

function nslBuildNavUrl(targetUrl) {
  const qs = window.location.search;
  if (!qs) return targetUrl;
  const sep = targetUrl.includes('?') ? '&' : '?';
  return targetUrl + sep + qs.slice(1);
}

if (NSL_IS_DISCORD) {

  document
    .getElementById("discord-gate")
    .classList.add("active");

  if (
    !window.DiscordSDKLib ||
    typeof window.DiscordSDKLib.DiscordSDK !== "function"
  ) {
    setGateError(
      "Discord SDK bundle not loaded."
    );
  } else {

    const DiscordSDK =
      window.DiscordSDKLib.DiscordSDK;

    const patchUrlMappings = window.DiscordSDKLib.patchUrlMappings;
    try {
      if (typeof patchUrlMappings === "function") {
        patchUrlMappings([
          { prefix: "/worker", target: "green-thunder-d974.priyan-node.workers.dev" },
          { prefix: "/firebase-auth", target: "identitytoolkit.googleapis.com" },
          { prefix: "/firebase-token", target: "securetoken.googleapis.com" },
        ], { patchFetch: true, patchXhr: true, patchWebSocket: false, patchSrcAttributes: false });
      }
    } catch (err) {
      console.warn("[NSL] URL mapping warning:", err);
    }

    console.log(
      "[NSL] URL mapping disabled for test"
    );
    runDiscordAuth(DiscordSDK);
  }
}

async function runDiscordAuth(DiscordSDK) {
  console.log("[NSL] instanceId:", DISCORD_INSTANCE_ID);

  if (!DISCORD_INSTANCE_ID) {
    setGateError("No Discord instance ID found.");
    return;
  }

  console.log("[NSL] DiscordSDK type:", typeof DiscordSDK);

  let sdk;

  try {
    sdk = new DiscordSDK(DISCORD_APP_ID, {
      instanceId: DISCORD_INSTANCE_ID,
    });

    console.log(
      "[NSL] sdk created with instanceId:",
      DISCORD_INSTANCE_ID
    );
  } catch (ctorErr) {
    console.error("[NSL] DiscordSDK constructor threw:", ctorErr);

    setGateError(
      "SDK init failed: " + String(ctorErr.message || ctorErr)
    );

    const retryBtn = document.getElementById("btn-retry");

    if (retryBtn) {
      retryBtn.classList.add("visible");
      retryBtn.onclick = () => {
        retryBtn.classList.remove("visible");
        runDiscordAuth(DiscordSDK);
      };
    }

    return;
  }

  try {
    setGateStatus("Connecting to Discord...");

    console.log("[NSL] before sdk.ready()");

    await Promise.race([
      sdk.ready(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("sdk.ready timeout")),
          10000
        )
      ),
    ]);

    console.log("[NSL] after sdk.ready()");

    setGateStatus("Requesting access...");

    const authResult = await sdk.commands.authorize({
      client_id: DISCORD_APP_ID,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify"],
    });

    const code = authResult.code;

    console.log("[NSL] got code:", !!code);

    if (!code) {
      throw new Error("No authorization code");
    }

    setGateStatus("Verifying identity...");

    const tokenRes = await fetch(
      L_WORKER_PREFIX + "/discord-token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
        }),
      }
    );

    console.log("[NSL] worker status:", tokenRes.status);

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(
        `Worker ${tokenRes.status}: ${errText}`
      );
    }

    const tokenData = await tokenRes.json();

    const access_token = tokenData.access_token;
    const firebaseCustomToken =
      tokenData.firebaseCustomToken;

    if (!access_token) {
      throw new Error("No access token returned");
    }

    if (!firebaseCustomToken) {
      throw new Error(
        "No Firebase custom token returned from worker"
      );
    }

    setGateStatus("Authenticating with Discord...");

    const auth = await sdk.commands.authenticate({
      access_token,
    });

    const discordUser = auth.user;

    console.log(
      "[NSL] discord-authenticated:",
      discordUser.username
    );

    setGateStatus("Signing into your account...");

    if (!window.FirebaseBundle) {
      throw new Error("Firebase bundle not loaded");
    }

    const FB = window.FirebaseBundle;

    const fbApp = FB.initializeApp({
      apiKey: "AIzaSyAmrYGmTuoHP_sY4pG_MFan2CKZPlirbAk",
      authDomain: "nexus-study-lab.firebaseapp.com",
      projectId: "nexus-study-lab",
      storageBucket: "nexus-study-lab.firebasestorage.app",
      messagingSenderId: "610669979476",
      appId: "1:610669979476:web:de9af7a8da3cb71f720ac1",
    });

    const fbAuth = FB.getAuth(fbApp);

    const fbResult = await FB.signInWithCustomToken(
      fbAuth,
      firebaseCustomToken
    );

    const fbUser = fbResult.user;

    console.log(
      "[NSL] firebase-authenticated:",
      fbUser.uid
    );

    localStorage.setItem(
      "nsl_user",
      JSON.stringify({
        uid: fbUser.uid,
        name:
          discordUser.global_name ||
          discordUser.username,
        email: "",
        guest: false,
        discord_id: discordUser.id,
        discord_user: discordUser.username,
      })
    );

    localStorage.setItem(
      "nsl_active_uid",
      fbUser.uid
    );

    setGateStatus(
      "Welcome " +
      (discordUser.global_name ||
        discordUser.username)
    );

    setTimeout(() => {
      window.location.href = nslBuildNavUrl("app.html");
    }, 500);

  } catch (err) {
    console.error(
      "[NSL] Authentication failed:",
      err
    );

    setGateError(
      String(err.message || err)
    );

    const retryBtn =
      document.getElementById("btn-retry");

    if (retryBtn) {
      retryBtn.classList.add("visible");

      retryBtn.onclick = () => {
        retryBtn.classList.remove("visible");
        runDiscordAuth(DiscordSDK);
      };
    }
  }
}

function setGateStatus(text) {
  document.getElementById("gate-status").textContent = text;
  document.getElementById("gate-spinner").classList.remove("hidden");
}

function setGateError(html) {
  document.getElementById("gate-status").innerHTML = html;
  document.getElementById("gate-spinner").classList.add("hidden");
}

function sanitize(str) {
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

if (!NSL_IS_DISCORD) {

  document.getElementById('app-content').style.display = 'flex';

  if (typeof window.FirebaseBundle === 'undefined') {
    document.getElementById('bundle-error').style.display = 'block';
    ['btn-google', 'btn-discord', 'main-btn', 'guest-btn'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.disabled = true;
    });
  }

  var auth = null;
  var FB = null;

  var suppressAuthListener = false;

  if (window.FirebaseBundle) {
    FB = window.FirebaseBundle;
    console.log('FirebaseBundle:', FB);
    console.log('Keys:', Object.keys(FB));
    console.log('signInWithCustomToken:', typeof FB.signInWithCustomToken);
    FB.initializeApp({
      apiKey: 'AIzaSyAmrYGmTuoHP_sY4pG_MFan2CKZPlirbAk',
      authDomain: 'nexus-study-lab.firebaseapp.com',
      projectId: 'nexus-study-lab',
      storageBucket: 'nexus-study-lab.firebasestorage.app',
      messagingSenderId: '610669979476',
      appId: '1:610669979476:web:de9af7a8da3cb71f720ac1',
    });

    auth = FB.getAuth();

    FB.getRedirectResult(auth).then(function (result) {
      if (result && result.user) {
        saveUser(result.user);
        nslEnterApp();
      }
    }).catch(function (err) {
      if (err.code !== 'auth/no-auth-event') setMsg(friendlyError(err.code), 'error');
    });

    FB.onAuthStateChanged(auth, function (user) {
      if (suppressAuthListener) return;
      if (!user) return;

      var isPasswordAccount = user.providerData.length > 0 &&
        user.providerData.some(function (p) { return p.providerId === 'password'; });

      if (isPasswordAccount && !user.emailVerified) {
        FB.signOut(auth);
        return;
      }

      saveUser(user);
      nslEnterApp();
    });

    handleDiscordCallback();
  }

  function saveUser(user, nameOverride) {
    localStorage.setItem('nsl_user', JSON.stringify({
      uid: user.uid,
      email: user.email || '',
      name: nameOverride || user.displayName || (user.email ? user.email.split('@')[0] : 'Scholar'),
      photo: user.photoURL || null,
      guest: false,
    }));
  }



  function setMsg(text, type) {
    var el = document.getElementById('msg');
    el.textContent = text;
    el.className = 'msg' + (type ? ' ' + type : '');
  }

  function setMsgHTML(html, type) {
    var el = document.getElementById('msg');
    el.innerHTML = html;
    el.className = 'msg' + (type ? ' ' + type : '');
  }

  function clearMsg() { setMsg('', ''); }

  function setLoading(on) {
    var btn = document.getElementById('main-btn');
    btn.disabled = on;
    btn.innerHTML = on
      ? '<span class="spinner"></span>One moment…'
      : (currentTab === 'register' ? 'Create Account' : 'Enter the Lab');
  }

  function showOverlay(text) {
    document.getElementById('social-loading-text').textContent = text || 'Connecting…';
    document.getElementById('social-loading').classList.add('show');
  }
  function hideOverlay() {
    document.getElementById('social-loading').classList.remove('show');
  }

  function friendlyError(code) {
    var map = {
      'auth/invalid-email': "That email address doesn't look right.",
      'auth/user-not-found': 'No account found with that email.',
      'auth/wrong-password': 'Wrong password — try again.',
      'auth/invalid-credential': 'Email or password is incorrect.',
      'auth/email-already-in-use': 'An account with that email already exists.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/too-many-requests': 'Too many attempts — please wait a moment.',
      'auth/network-request-failed': 'Network error — check your connection.',
      'auth/popup-closed-by-user': 'Sign-in window was closed. Try again.',
      'auth/popup-blocked': 'Popup was blocked — trying redirect…',
      'auth/cancelled-popup-request': 'Sign-in was cancelled.',
      'auth/operation-not-allowed': 'This sign-in method is not currently enabled.',
    };
    return map[code] || 'Something went wrong. Please try again.';
  }
  const NSL_BOOT_PARAMS = new URLSearchParams(window.location.search);
  const NSL_FRAME_ID = NSL_BOOT_PARAMS.get('frame_id') || null;
  const NSL_INSTANCE_ID = NSL_BOOT_PARAMS.get('instance_id') || NSL_FRAME_ID || null;

  function nslPreserveDiscordParams(targetUrl) {
    if (!NSL_FRAME_ID && !NSL_INSTANCE_ID) return targetUrl;
    const qs = window.location.search;
    if (!qs) return targetUrl;
    const sep = targetUrl.includes('?') ? '&' : '?';
    return targetUrl + sep + qs.slice(1);
  }

  window.nslPreserveDiscordParams = nslPreserveDiscordParams;
  window.NSL_FRAME_ID = NSL_FRAME_ID;
  window.NSL_INSTANCE_ID = NSL_INSTANCE_ID;
  const NSL_LEGACY_KEY = 'nsl_data';
  const NSL_KEY_PREFIX = 'nsl_data_';
  const NSL_TIMER_KEY = 'nsl_timer_state';
  const NSL_UID_KEY = 'nsl_active_uid';
  const NSL_FIRESTORE_DEBOUNCE_MS = 1500;

  var currentTab = 'login';

  function switchTab(tab) {
    currentTab = tab;
    var isReg = (tab === 'register');
    document.getElementById('tab-login').classList.toggle('active', !isReg);
    document.getElementById('tab-login').setAttribute('aria-selected', String(!isReg));
    document.getElementById('tab-register').classList.toggle('active', isReg);
    document.getElementById('tab-register').setAttribute('aria-selected', String(isReg));
    document.getElementById('register-name-field').style.display = isReg ? 'flex' : 'none';
    document.getElementById('forgot-row').style.display = isReg ? 'none' : 'block';
    var pwd = document.getElementById('login-password');
    var btn = document.getElementById('main-btn');
    if (isReg) {
      btn.textContent = 'Create Account';
      pwd.setAttribute('autocomplete', 'new-password');
      pwd.setAttribute('placeholder', 'Choose a password');
    } else {
      btn.textContent = 'Enter the Lab';
      pwd.setAttribute('autocomplete', 'current-password');
      pwd.setAttribute('placeholder', '••••••••');
    }
    clearMsg();
  }

  function handleGoogleLogin() {
    if (!auth || !FB) return;
    clearMsg();
    document.getElementById('btn-google').disabled = true;
    showOverlay('Connecting to Google…');
    var provider = new FB.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    FB.signInWithPopup(auth, provider).then(function (result) {
      saveUser(result.user);
      hideOverlay();
      nslEnterApp();
    }).catch(function (err) {
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
        setMsg(friendlyError(err.code), 'error');
        FB.signInWithRedirect(auth, provider).catch(function (e2) {
          hideOverlay();
          document.getElementById('btn-google').disabled = false;
          setMsg(friendlyError(e2.code), 'error');
        });
      } else {
        hideOverlay();
        document.getElementById('btn-google').disabled = false;
        setMsg(friendlyError(err.code), 'error');
      }
    });
  }

  function handleDiscordWebLogin() {
    clearMsg();
    showOverlay('Redirecting to Discord…');
    var state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('discord_oauth_state', state);
    var params = new URLSearchParams({
      client_id: DISCORD_APP_ID,
      redirect_uri: DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: 'identify email',
      state: state,
    });
    window.location.href = 'https://discord.com/api/oauth2/authorize?' + params.toString();
  }

  async function handleDiscordCallback() {
    var urlParams = new URLSearchParams(window.location.search);
    var code = urlParams.get('code');
    var state = urlParams.get('state');
    if (!code) return;

    history.replaceState({}, '', window.location.pathname);

    var savedState = sessionStorage.getItem('discord_oauth_state');
    sessionStorage.removeItem('discord_oauth_state');
    if (state !== savedState) {
      setMsg('Discord sign-in failed — security check failed. Try again.', 'error');
      return;
    }

    showOverlay('Finishing Discord sign-in…');
    try {
      var res = await fetch(L_WORKER_PREFIX + '/discord-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, redirect_uri: DISCORD_REDIRECT_URI }),
      });
      if (!res.ok) throw new Error('Worker responded with ' + res.status);
      var data = await res.json();
      var firebaseToken = data.firebaseToken;
      var discordUser = data.discordUser;
      var result = await FB.signInWithCustomToken(auth, firebaseToken);
      saveUser(result.user, discordUser && discordUser.username);
      hideOverlay();
      nslEnterApp();
    } catch (err) {
      hideOverlay();
      setMsg('Discord sign-in failed — ' + (err.message || 'unknown error'), 'error');
    }
  }

  function handleEmailSubmit() {
    if (!auth || !FB) return;
    var email = document.getElementById('login-email').value.trim();
    var pass = document.getElementById('login-password').value;
    clearMsg();
    if (!email || !pass) { setMsg('Please fill in all fields.', 'error'); return; }
    if (!email.includes('@')) { setMsg('Enter a valid email address.', 'error'); return; }
    if (pass.length < 6) { setMsg('Password must be at least 6 characters.', 'error'); return; }
    if (currentTab === 'register') {
      var name = document.getElementById('reg-name').value.trim();
      if (!name) { setMsg('Please enter your name.', 'error'); return; }
      doRegister(name, email, pass);
    } else {
      doLogin(email, pass);
    }
  }

  function doLogin(email, pass) {
    setLoading(true);
    suppressAuthListener = true;
    FB.signInWithEmailAndPassword(auth, email, pass).then(function (cred) {

      if (!cred.user.emailVerified) {
        FB.signOut(auth).then(function () {
          suppressAuthListener = false;
          setLoading(false);
          showUnverifiedMessage(email);
        });
        return;
      }

      suppressAuthListener = false;
      saveUser(cred.user);
      setMsg('Welcome back ✶', 'success');
      setTimeout(nslEnterApp, 500);
    }).catch(function (err) {
      suppressAuthListener = false;
      setMsg(friendlyError(err.code), 'error');
      setLoading(false);
    });
  }

  function doRegister(name, email, pass) {
    setLoading(true);
    suppressAuthListener = true;

    FB.createUserWithEmailAndPassword(auth, email, pass).then(function (cred) {
      var user = cred.user;

      return FB.updateProfile(user, { displayName: name }).catch(function (err) {
        console.warn('[NSL] updateProfile failed (non-fatal):', err);
      }).then(function () {
        return FB.sendEmailVerification(user).catch(function (err) {
          console.warn('[NSL] sendEmailVerification failed:', err);
          err._nslAccountCreated = true;
          err._nslStage = 'verification-email';
          throw err;
        });
      }).then(function () {
        return FB.signOut(auth);
      });
    }).then(function () {
      suppressAuthListener = false;
      setLoading(false);
      setMsgHTML(
        'Account created — check <strong>' + sanitize(email) + '</strong> for a verification link, then sign in.',
        'success'
      );
      switchTab('login');
      document.getElementById('login-email').value = email;
    }).catch(function (err) {
      suppressAuthListener = false;
      setLoading(false);

      if (err && err._nslAccountCreated) {
        FB.signOut(auth).catch(function () { });
        setMsgHTML(
          'Account created, but the verification email failed to send. ' +
          'Switch to Sign In and use "Resend verification email" after entering your password.',
          'error'
        );
        switchTab('login');
        document.getElementById('login-email').value = email;
        return;
      }

      setMsg(friendlyError(err.code), 'error');
    });
  }

  function showUnverifiedMessage(email) {
    setMsgHTML(
      'Please verify <strong>' + sanitize(email) + '</strong> before signing in. ' +
      '<button type="button" class="msg-inline-btn" id="resend-verify-btn">Resend verification email</button>',
      'error'
    );
    var btn = document.getElementById('resend-verify-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        var pass = document.getElementById('login-password').value;
        resendVerification(email, pass);
      });
    }
  }

  function resendVerification(email, pass) {
    if (!pass) {
      setMsg('Enter your password above, then tap "Resend verification email" again.', 'error');
      return;
    }
    suppressAuthListener = true;
    FB.signInWithEmailAndPassword(auth, email, pass).then(function (cred) {
      return FB.sendEmailVerification(cred.user).then(function () {
        return FB.signOut(auth);
      });
    }).then(function () {
      suppressAuthListener = false;
      setMsg('Verification email resent — check your inbox (and spam folder).', 'success');
    }).catch(function (err) {
      suppressAuthListener = false;
      setMsg(friendlyError(err.code), 'error');
    });
  }

  function doForgotPassword() {
    if (!auth || !FB) return;
    var email = document.getElementById('login-email').value.trim();
    if (!email) { setMsg('Enter your email address above first.', 'error'); return; }
    if (!email.includes('@')) { setMsg('Enter a valid email address.', 'error'); return; }
    FB.sendPasswordResetEmail(auth, email).then(function () {
      setMsg('Reset email sent — check your inbox (and spam folder).', 'success');
    }).catch(function (err) {
      setMsg(friendlyError(err.code), 'error');
    });
  }

  function enterAsGuest() {
    localStorage.setItem('nsl_user', JSON.stringify({ guest: true }));
    nslEnterApp();
  }

  /* ── Email toggle: reveal tabs/form on demand ── */
  function toggleEmailForm() {
    var wrap = document.getElementById('email-form-wrap');
    var btn = document.getElementById('email-toggle-btn');
    var isHidden = wrap.style.display === 'none';
    wrap.style.display = isHidden ? 'block' : 'none';
    btn.setAttribute('aria-expanded', String(isHidden));
    btn.textContent = isHidden ? 'Hide email sign-in' : 'Use email instead';
  }

  document.getElementById('btn-google').addEventListener('click', handleGoogleLogin);
  document.getElementById('btn-discord').addEventListener('click', handleDiscordWebLogin);
  document.getElementById('main-btn').addEventListener('click', handleEmailSubmit);
  document.getElementById('guest-btn').addEventListener('click', enterAsGuest);
  document.getElementById('forgot-btn').addEventListener('click', doForgotPassword);
  document.getElementById('back-btn').addEventListener('click', nslEnterApp);
  document.getElementById('email-toggle-btn').addEventListener('click', toggleEmailForm);
  document.getElementById('tab-login').addEventListener('click', function () { switchTab('login'); });
  document.getElementById('tab-register').addEventListener('click', function () { switchTab('register'); });
  document.getElementById('reg-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('login-email').focus(); });
  document.getElementById('login-email').addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('login-password').focus(); });
  document.getElementById('login-password').addEventListener('keydown', function (e) { if (e.key === 'Enter') handleEmailSubmit(); });

} /* END !IS_DISCORD */


(function initParticles() {
  var canvas = document.getElementById('particle-canvas-2');
  var ctx = canvas.getContext('2d');
  var pts = [];
  var W, H;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (var i = 0; i < 55; i++) {
    pts.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.1 + 0.28,
      dx: (Math.random() - 0.5) * 0.14,
      dy: (Math.random() - 0.5) * 0.14,
      tw: Math.random() * Math.PI * 2,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (var p, i = 0; i < pts.length; i++) {
      p = pts[i];
      p.x += p.dx; p.y += p.dy; p.tw += 0.015;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      var a = 0.13 + 0.18 * Math.sin(p.tw);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(232,160,96,' + a + ')';
      ctx.shadowColor = 'rgba(232,160,96,0.45)';
      ctx.shadowBlur = 5;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    requestAnimationFrame(draw);
  }
  draw();
})();
