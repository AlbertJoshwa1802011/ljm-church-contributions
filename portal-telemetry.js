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

    // ── 2. Forced-login gate (phased, controlled from admin Settings) ──
    if (location.protocol === "file:") return; // dev preview: never block

    fetch("/api/settings").then(function (r) { return r.json(); }).then(function (d) {
        var forced = d && d.settings && d.settings.force_login === "true";
        if (!forced) return;
        if (getToken()) return; // already signed in
        try { if (sessionStorage.getItem("ljmAdminSession")) return; } catch (_) {} // admins pass

        showGate();
    }).catch(function () { /* fail open — never lock members out on API errors */ });

    function showGate() {
        var overlay = document.createElement("div");
        overlay.id = "ljmLoginGate";
        overlay.setAttribute("style",
            "position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;" +
            "gap:14px;padding:24px;text-align:center;background:rgba(12,12,24,0.92);backdrop-filter:blur(10px);color:#fff;" +
            "font-family:Inter,-apple-system,sans-serif;");
        overlay.innerHTML =
            '<div style="font-size:40px;">⛪</div>' +
            '<div style="font-size:22px;font-weight:700;">Members Portal</div>' +
            '<div style="font-size:14px;opacity:0.8;max-width:340px;">Please sign in with Google to view contribution data. This keeps our records transparent and secure.</div>' +
            '<div id="ljmGateBtn" style="min-height:44px;"></div>' +
            '<div id="ljmGateErr" style="font-size:12px;color:#ff9c8a;min-height:16px;"></div>';
        (document.body || document.documentElement).appendChild(overlay);
        document.documentElement.style.overflow = "hidden";

        function onCredential(response) {
            try { sessionStorage.setItem(USER_TOKEN_KEY, response.credential); } catch (_) {}
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
