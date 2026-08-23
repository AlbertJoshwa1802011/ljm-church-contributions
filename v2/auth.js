// Shared real sign-in script for every /v2 page — Home, Our Giving, Events,
// My Giving, Give Flow all include this identically.
//
// Reuses the EXACT same contract the real (old-flow) index.html already
// uses — sessionStorage.ljmUserIdToken (raw Google ID token) and
// sessionStorage.ljmAuthProfile ({ email, name, isAdmin, permissions,
// member }) populated via the same real /api/auth handshake — so a session
// started on the old flow carries over here, and vice versa. This is NOT a
// new auth mechanism; it's the same one, called from new markup.
//
// See docs/milestone-v2/11-v2-flow-implementation.md.

(function () {
  var GOOGLE_CLIENT_ID = "915064946962-eohgis92a3jmfk3fi7hkh8uc21971clo.apps.googleusercontent.com";

  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function initials(name) {
    return (name || "?").trim().split(/\s+/).map(function (w) { return w.charAt(0); }).join("").substring(0, 2).toUpperCase();
  }

  // Other page-specific scripts (e.g. my-giving.html, which needs to know
  // WHO is signed in to filter their real contributions) listen for this
  // instead of duplicating auth logic.
  function dispatchAuthEvent(profile) {
    window.dispatchEvent(new CustomEvent("ljm-auth-ready", { detail: profile }));
  }

  function closeMenu(chip) {
    chip.classList.remove("menu-open");
    var trigger = chip.querySelector(".user-chip-trigger");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }

  function closeAllMenus() {
    $all(".user-chip.menu-open").forEach(closeMenu);
  }

  function setSignedOutUI() {
    $all(".signin-btn-slot").forEach(function (el) { el.style.display = ""; });
    $all(".user-chip").forEach(function (el) {
      el.classList.remove("on");
      closeMenu(el);
      var avatar = el.querySelector(".user-avatar");
      if (avatar) avatar.textContent = "··";
    });
    dispatchAuthEvent(null);
  }

  function setSignedInUI(profile) {
    $all(".signin-btn-slot").forEach(function (el) { el.style.display = "none"; });
    var displayName = profile.member || profile.name || profile.email || "";
    $all(".user-chip").forEach(function (el) {
      el.classList.add("on");
      var avatar = el.querySelector(".user-avatar");
      var name = el.querySelector(".nm");
      var menuName = el.querySelector(".user-menu-name");
      var menuEmail = el.querySelector(".user-menu-email");
      var adminLink = el.querySelector(".admin-link");
      if (avatar) {
        if (profile.picture) {
          avatar.innerHTML = "";
          var img = document.createElement("img");
          img.src = profile.picture;
          img.alt = "";
          img.referrerPolicy = "no-referrer";
          avatar.appendChild(img);
        } else {
          avatar.textContent = initials(displayName);
        }
      }
      if (name) name.textContent = displayName;
      if (menuName) menuName.textContent = displayName;
      if (menuEmail) menuEmail.textContent = profile.email || "";
      if (adminLink) adminLink.classList.toggle("on", !!profile.isAdmin);
    });
    dispatchAuthEvent(profile);
  }

  function currentProfile() {
    try {
      var raw = sessionStorage.getItem("ljmAuthProfile");
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function signOut() {
    try {
      sessionStorage.removeItem("ljmUserIdToken");
      sessionStorage.removeItem("ljmAuthProfile");
    } catch (_) {}
    setSignedOutUI();
  }

  async function runAuthHandshake(token) {
    try {
      var res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token })
      });
      if (!res.ok) return;
      var data = await res.json();
      var profile = {
        email: data.user && data.user.email,
        name: data.user && data.user.name,
        picture: data.user && data.user.picture,
        isAdmin: !!data.isAdmin,
        permissions: data.permissions || [],
        member: data.member ? data.member.name : null
      };
      try { sessionStorage.setItem("ljmAuthProfile", JSON.stringify(profile)); } catch (_) {}
      setSignedInUI(profile);
    } catch (_) {}
  }

  window.handleCredentialResponse = function (response) {
    try {
      sessionStorage.setItem("ljmUserIdToken", response.credential);
    } catch (_) {}
    var payload = JSON.parse(atob(response.credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    setSignedInUI({ name: payload.name, email: payload.email, picture: payload.picture });
    runAuthHandshake(response.credential);
  };

  document.addEventListener("DOMContentLoaded", function () {
    // Wrap each real sign-in container so it can be hidden as a unit once
    // signed in (the GIS-rendered button itself has no easy show/hide hook).
    $all("#signinBtn, #signinBtnDrawer").forEach(function (el) { el.classList.add("signin-btn-slot"); });

    $all(".user-chip-trigger").forEach(function (trigger) {
      trigger.addEventListener("click", function (e) {
        e.stopPropagation();
        var chip = trigger.closest(".user-chip");
        if (!chip || !chip.classList.contains("on")) return;
        var wasOpen = chip.classList.contains("menu-open");
        closeAllMenus();
        if (!wasOpen) {
          chip.classList.add("menu-open");
          trigger.setAttribute("aria-expanded", "true");
        }
      });
    });

    $all(".user-menu-signout").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        signOut();
      });
    });

    document.addEventListener("click", function (e) {
      $all(".user-chip.menu-open").forEach(function (chip) {
        if (!chip.contains(e.target)) closeMenu(chip);
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAllMenus();
    });

    // Resume an existing session (started here or on the old flow) without
    // requiring a fresh sign-in click.
    try {
      var existingToken = sessionStorage.getItem("ljmUserIdToken");
      var cached = currentProfile();
      if (existingToken && cached) {
        setSignedInUI(cached);
      } else if (existingToken) {
        var payload = JSON.parse(atob(existingToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        setSignedInUI({ name: payload.name, email: payload.email, picture: payload.picture });
        runAuthHandshake(existingToken);
      } else {
        dispatchAuthEvent(null);
      }
    } catch (_) {
      dispatchAuthEvent(null);
    }

    var tries = 0;
    (function waitGis() {
      if (window.google && google.accounts && google.accounts.id) {
        try {
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: window.handleCredentialResponse,
            use_fedcm_for_prompt: false
          });
          $all("#signinBtn").forEach(function (el) {
            google.accounts.id.renderButton(el, { theme: "outline", size: "medium", shape: "pill", text: "signin", width: 140 });
          });
          $all("#signinBtnDrawer").forEach(function (el) {
            google.accounts.id.renderButton(el, { theme: "outline", size: "large", shape: "pill", text: "signin_with", width: 240 });
          });
        } catch (e) { console.error("GIS init/render failed:", e); }
      } else if (tries++ < 40) {
        setTimeout(waitGis, 250);
      }
    })();
  });
})();
