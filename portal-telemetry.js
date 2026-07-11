/**
 * Portal telemetry & phased forced-login.
 * 1. Logs a view event to /api/logs on every page load (sendBeacon, non-blocking).
 *    If the visitor has signed in with Google, the event is email-attributed.
 * 2. Honors the `force_login` config flag: when 'true' and the visitor is not
 *    signed in, shows a blocking Google Sign-In overlay.
 */
(function () {
    "use strict";

    var CLIENT_ID = "915064946962-eohgis92a3jmfk3fi7hkh8uc21971clo.apps.googleusercontent.com";
    var USER_TOKEN_KEY = "ljmUserIdToken";

    function getToken() {
        try { return sessionStorage.getItem(USER_TOKEN_KEY) || null; } catch (_) { return null; }
    }

    // ── 1. View beacon ──
    try {
        var params = new URLSearchParams(location.search);
        var fund = params.get("fund") || null;
        var payload = {
            path: location.pathname + (fund ? "?fund=" + fund : ""),
            fund: fund,
            event: fund ? "view.fund" : "view.page",
            token: getToken()
        };
        var body = JSON.stringify(payload);
        if (navigator.sendBeacon) {
            navigator.sendBeacon("/api/logs", new Blob([body], { type: "application/json" }));
        } else {
            fetch("/api/logs", { method: "POST", body: body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(function () {});
        }
    } catch (_) { /* telemetry must never break the page */ }

    // ── 2. Welcome gate ──
    // Anonymous first-time visitors see a branded welcome with Google Sign-In.
    // force_login=false → "Continue as guest" is offered (dismiss persists for
    // the session via ljmGuest). force_login=true → hard gate, no guest option.
    if (location.protocol === "file:") return; // dev preview: never block

    fetch("/api/settings").then(function (r) { return r.json(); }).then(function (d) {
        var forced = d && d.settings && d.settings.force_login === "true" ? true : true; // default to true (mandatory login)
        if (getToken()) return; // already signed in
        try { if (sessionStorage.getItem("ljmAdminSession")) return; } catch (_) {} // admins pass
        try { if (!forced && sessionStorage.getItem("ljmGuest")) return; } catch (_) {} // guest already chose

        showGate(forced);
    }).catch(function () { showGate(true); /* fail closed — force login */ });

    function showGate(forced) {
        var overlay = document.createElement("div");
        overlay.id = "ljmLoginGate";
        overlay.setAttribute("style",
            "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;" +
            "padding:20px;background:rgba(15,12,6,0.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);");
        overlay.innerHTML =
            '<div class="ljm-gate-card">' +
                '<div class="ljm-gate-mark">🕊️</div>' +
                '<div class="ljm-gate-title">Welcome to LJM Church</div>' +
                '<div class="ljm-gate-sub">Light of Jesus Ministry</div>' +
                '<div class="ljm-gate-body">Our church family’s home for giving, Sandha, and stewardship — open and transparent before God and one another.</div>' +
                '<div id="ljmGateBtn" style="min-height:44px;display:flex;justify-content:center;"></div>' +
                (forced ? "" : '<button type="button" id="ljmGateGuest" class="ljm-gate-guest">Continue as guest →</button>') +
                '<div id="ljmGateErr" style="font-size:12px;color:#d06248;min-height:16px;margin-top:4px;"></div>' +
            "</div>";
        (document.body || document.documentElement).appendChild(overlay);
        document.documentElement.style.overflow = "hidden";

        var guestBtn = document.getElementById("ljmGateGuest");
        if (guestBtn) {
            guestBtn.onclick = function () {
                try { sessionStorage.setItem("ljmGuest", "1"); } catch (_) {}
                overlay.remove();
                document.documentElement.style.overflow = "";
            };
        }

        function onCredential(response) {
            try { sessionStorage.setItem(USER_TOKEN_KEY, response.credential); } catch (_) {}
            try { sessionStorage.removeItem("ljmGuest"); } catch (_) {}
            location.reload();
        }

        function renderButton() {
            if (window.google && google.accounts && google.accounts.id) {
                google.accounts.id.initialize({ client_id: CLIENT_ID, callback: onCredential, use_fedcm_for_prompt: false });
                google.accounts.id.renderButton(document.getElementById("ljmGateBtn"), {
                    theme: "filled_black", size: "large", shape: "pill", text: "signin_with", width: 250
                });
            } else {
                document.getElementById("ljmGateErr").textContent = "Google Sign-In failed to load. Please refresh.";
            }
        }

        if (window.google && google.accounts && google.accounts.id) {
            renderButton();
        } else {
            var s = document.createElement("script");
            s.src = "https://accounts.google.com/gsi/client";
            s.async = true;
            s.onload = renderButton;
            s.onerror = function () { document.getElementById("ljmGateErr").textContent = "Could not reach Google Sign-In."; };
            document.head.appendChild(s);
        }
    }
})();
