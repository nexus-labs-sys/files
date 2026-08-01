console.log("BUILD_TEST_2026_06_18_v1");

/* ══════════════════════════════════════════════════════════════════
   TEMPORARY DIAGNOSTIC FLAG
   When true: after the Discord handshake (sdk.ready()) succeeds, we
   stop BEFORE authorize/authenticate/Firebase and just show a button
   that calls sdk.commands.openExternalLink(). This isolates whether
   external-link opening works at all, independent of auth/payment
   plumbing. Flip back to false (or delete this block) once confirmed.
   ══════════════════════════════════════════════════════════════════ */
const NSL_TEST_MODE = true;
const NSL_TEST_URL = "https://quietplace.space"; // swap for your real payment link once ready() is confirmed working

const DISCORD_APP_ID = "1532256337990389880";

/* WORKER_PREFIX is already declared by nsl-data-core.js (loaded before this file)
   with the same value/logic — reuse it instead of redeclaring it. */
const DISCORD_REDIRECT_URI = "https://nexus-labs-sys.github.io/files/";

function nslBuildNavUrl(targetUrl) {
  const qs = window.location.search;
  if (!qs) return targetUrl;
  const sep = targetUrl.includes('?') ? '&' : '?';
  return targetUrl + sep + qs.slice(1);
}

/* Defined here, above the IS_DISCORD branch, because both the Discord
   Activity auth flow and the normal web login flow need to call these. */
function nslEnterApp() {
  document.getElementById('login-gate').style.display = 'none';
  document.getElementById('app-content').style.display = '';
  window.dispatchEvent(new CustomEvent('nsl-authed'));
}
window.nslEnterApp = nslEnterApp;

/* Reverse of nslEnterApp — used by logout and by the "no cached session"
   fallback in nsl-data-core.js. Single-page app now, so this is just a
   visibility swap, never a real navigation. */
function nslShowLoginGate() {
  document.getElementById('app-content').style.display = 'none';
  document.getElementById('login-gate').style.display = '';
  window.dispatchEvent(new CustomEvent('nsl-loggedout'));
}
window.nslShowLoginGate = nslShowLoginGate;

if (IS_DISCORD) {

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
          { prefix: "/worker", target: "aged-cloud-bfd5.priyan-node.workers.dev" },
          { prefix: "/firebase-auth", target: "identitytoolkit.googleapis.com" },
          { prefix: "/firebase-token", target: "securetoken.googleapis.com" },
        ], { patchFetch: true, patchXhr: true, patchWebSocket: false, patchSrcAttributes: false });
      }
    } catch (err) {
      console.warn("[NSL] URL mapping warning:", err);
    }

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
        /* Reload rather than re-run runDiscordAuth() with a fresh `new
           DiscordSDK(...)`: a second instance in the same page session
           can leave the first instance's in-flight handshake orphaned,
           which is what produced the "Unrecognized frame ID" errors. */
        window.location.reload();
      };
    }

    return;
  }

  try {
    setGateStatus("Connecting to Discord...");

    console.log("[NSL] before sdk.ready()");

    /* sdk.ready() is awaited directly — never raced against a timeout that
       abandons it. That's what caused "Unrecognized frame ID" errors: the
       real handshake was still in flight when we gave up on it, and its
       late response arrived with nobody listening for it anymore.

       These two timers are UI-only. They never touch/reject the real
       promise — they just update what the person sees while it's pending,
       and clear themselves the moment ready() actually resolves. */
    let handshakeSettled = false;

    const slowHandshakeNotice = setTimeout(() => {
      if (handshakeSettled) return;
      setGateStatus("Still connecting to Discord… this can take a bit on first load.");
    }, 8000);

    const stuckHandshakeNotice = setTimeout(() => {
      if (handshakeSettled) return;
      setGateError(
        "This is taking much longer than usual. You can keep waiting, or reload and try again."
      );
      const retryBtn = document.getElementById("btn-retry");
      if (retryBtn) {
        retryBtn.classList.add("visible");
        retryBtn.onclick = () => window.location.reload();
      }
    }, 25000);

    try {
      await sdk.ready();
    } finally {
      handshakeSettled = true;
      clearTimeout(slowHandshakeNotice);
      clearTimeout(stuckHandshakeNotice);
    }

    console.log("[NSL] after sdk.ready()");

    /* ── TEST MODE: stop right here, before authorize/auth/Firebase.
       Show a button that calls openExternalLink so we can confirm,
       in isolation, whether link-opening works inside this Activity. ── */
    if (NSL_TEST_MODE) {
      setGateStatus("Handshake OK ✶ Ready to test external link.");
      showTestLinkButton(sdk);
      return;
    }

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
      WORKER_PREFIX + "/discord-token",
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
      nslEnterApp();
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
        /* Same reasoning as the constructor-error retry above: reload
           instead of creating a second DiscordSDK instance mid-session. */
        window.location.reload();
      };
    }
  }
}

function showTestLinkButton(sdk) {
  const btn = document.getElementById("btn-test-link");
  const resultEl = document.getElementById("test-link-result");
  if (!btn) return;

  btn.classList.add("visible");
  resultEl.textContent = "";

  btn.onclick = async () => {
    btn.disabled = true;
    resultEl.textContent = "Calling openExternalLink(" + NSL_TEST_URL + ")…";
    try {
      const res = await sdk.commands.openExternalLink({ url: NSL_TEST_URL });
      console.log("[NSL] openExternalLink result:", res);
      resultEl.textContent = "Result: " + JSON.stringify(res) +
        " — if a browser tab/prompt opened, links work. If 'opened' is false/null, check the app's URL Mappings / external link allowlist in the Discord Dev Portal.";
    } catch (err) {
      console.error("[NSL] openExternalLink failed:", err);
      resultEl.textContent = "Error: " + String(err.message || err);
    } finally {
      btn.disabled = false;
    }
  };
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



if (!IS_DISCORD) {

  document.getElementById('normal-login').style.display = 'flex';

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
  /* NSL_BOOT_PARAMS / NSL_FRAME_ID / NSL_INSTANCE_ID / NSL_LEGACY_KEY / NSL_KEY_PREFIX /
     NSL_TIMER_KEY / NSL_UID_KEY / NSL_FIRESTORE_DEBOUNCE_MS / nslPreserveDiscordParams
     are already declared by nsl-data-core.js (loaded before this file) — reused here
     instead of redeclared. */

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
      var res = await fetch(WORKER_PREFIX + '/discord-auth', {
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



/* ─────────────────────────────────────────────────────────────
   If the person already has a saved session (web only — Discord
   always re-runs its own handshake/auth flow above), skip the
   login screen and go straight into the app.
───────────────────────────────────────────────────────────────*/
if (!IS_DISCORD && localStorage.getItem('nsl_user')) {
  nslEnterApp();
}