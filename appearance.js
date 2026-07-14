// LJM Church — Appearance panel: pick a light-mode accent, a dark-mode accent,
// and the light/dark/system mode, from one place. Live-previews instantly and
// (when signed in) syncs the choice to the member's account so it follows them
// across devices. Device-local (localStorage, via window.LJMTheme) is the
// instant/offline fallback and works for signed-out visitors too.
//
// Depends on window.LJMTheme (theme.js) for the palette catalog + apply/persist.
// Exposes window.LJMAppearance = { open, close }. header.js wires the entry points.
(function () {
    if (!window.LJMTheme) return; // theme.js must load first

    var THEME_KEY = "ljmTheme"; // matches theme.js; null = follow system

    function storedThemePref() {
        try {
            var v = localStorage.getItem(THEME_KEY);
            return v === "light" || v === "dark" ? v : "system";
        } catch (_) { return "system"; }
    }

    // ---- identity / server sync ----
    function idToken() {
        try {
            var t = sessionStorage.getItem("ljmUserIdToken");
            return t && t.split(".").length === 3 ? t : null;
        } catch (_) { return null; }
    }
    function isSignedIn() { return !!idToken(); }

    // Push both accents to the account (best-effort; localStorage already holds
    // the source of truth so a failed sync never blocks the UI).
    var saveTimer = null;
    function scheduleServerSave() {
        var token = idToken();
        if (!token) return;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            fetch("/api/appearance", {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify({
                    accent_light: window.LJMTheme.getAccent("light"),
                    accent_dark: window.LJMTheme.getAccent("dark")
                })
            }).catch(function () { /* offline / transient — device-local value stands */ });
        }, 400);
    }

    // On load (and right after sign-in), pull the account's saved accents and let
    // them win over the local cache, giving cross-device sync. Seeds silently so
    // it doesn't echo back to the server.
    var pulled = false;
    function pullFromServer() {
        var token = idToken();
        if (!token || pulled) return;
        pulled = true;
        fetch("/api/appearance", { headers: { "Authorization": "Bearer " + token } })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (!d || !d.success) return;
                var changed = false;
                if (d.accent_light && d.accent_light !== window.LJMTheme.getAccent("light")) {
                    window.LJMTheme.setAccent("light", d.accent_light, { silent: true }); changed = true;
                }
                if (d.accent_dark && d.accent_dark !== window.LJMTheme.getAccent("dark")) {
                    window.LJMTheme.setAccent("dark", d.accent_dark, { silent: true }); changed = true;
                }
                if (changed && panel && !overlay.hidden) render();
            })
            .catch(function () {});
    }

    // ---- DOM ----
    var overlay, panel;
    var PALETTE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-3.9-4-6.5-9-6.5Z"/><circle cx="7.5" cy="11.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.5" cy="11.5" r="1.1" fill="currentColor" stroke="none"/></svg>';

    var MODE_ICONS = {
        light: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/></svg>',
        dark: '<svg viewBox="0 0 24 24"><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.3 7 7 0 0 0 20.5 14.5Z"/></svg>',
        system: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 20h8M12 17v3"/></svg>'
    };

    function effectiveMode() { return window.LJMTheme.get() === "dark" ? "dark" : "light"; }

    function build() {
        overlay = document.createElement("div");
        overlay.id = "ljmAppearOverlay";
        overlay.hidden = true;
        overlay.innerHTML =
            '<div class="ljm-appear-backdrop"></div>' +
            '<div class="ljm-appear-panel" role="dialog" aria-modal="true" aria-label="Appearance">' +
                '<div class="ljm-appear-grip"></div>' +
                '<div class="ljm-appear-head">' +
                    '<div class="ljm-appear-title">Appearance</div>' +
                    '<button type="button" class="ljm-appear-close" aria-label="Close">&times;</button>' +
                '</div>' +
                '<div class="ljm-appear-section">' +
                    '<div class="ljm-appear-label">Mode</div>' +
                    '<div class="ljm-appear-modes" role="group" aria-label="Color mode"></div>' +
                '</div>' +
                '<div class="ljm-appear-section">' +
                    '<div class="ljm-appear-label">Accent color <span class="ljm-appear-modehint"></span></div>' +
                    '<div class="ljm-appear-swatches"></div>' +
                '</div>' +
                '<div class="ljm-appear-preview">' +
                    '<div class="ljm-appear-preview-card">' +
                        '<span class="ljm-appear-preview-badge">Preview</span>' +
                        '<div class="ljm-appear-preview-title">Together we build</div>' +
                        '<div class="ljm-appear-preview-row">' +
                            '<button type="button" class="ljm-appear-preview-btn">Contribute</button>' +
                            '<a class="ljm-appear-preview-link">Learn more &rsaquo;</a>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="ljm-appear-foot">' +
                    '<button type="button" class="ljm-appear-reset">Reset to default</button>' +
                    '<span class="ljm-appear-sync"></span>' +
                '</div>' +
            "</div>";
        document.body.appendChild(overlay);
        panel = overlay.querySelector(".ljm-appear-panel");

        overlay.querySelector(".ljm-appear-backdrop").addEventListener("click", close);
        overlay.querySelector(".ljm-appear-close").addEventListener("click", close);
        document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !overlay.hidden) close(); });

        // Mode segmented control
        overlay.querySelector(".ljm-appear-modes").addEventListener("click", function (e) {
            var btn = e.target.closest("[data-mode]");
            if (!btn) return;
            var m = btn.getAttribute("data-mode");
            if (m === "system") window.LJMTheme.resetToSystem();
            else window.LJMTheme.set(m);
            render();
        });

        // Swatch grid
        overlay.querySelector(".ljm-appear-swatches").addEventListener("click", function (e) {
            var sw = e.target.closest("[data-accent]");
            if (!sw) return;
            window.LJMTheme.setAccent(effectiveMode(), sw.getAttribute("data-accent"));
            scheduleServerSave();
            render();
        });

        overlay.querySelector(".ljm-appear-reset").addEventListener("click", function () {
            window.LJMTheme.resetAccent();
            scheduleServerSave();
            render();
        });

        // Keep the panel in sync if the theme is toggled elsewhere (header button)
        // while it's open.
        window.addEventListener("ljm:appearancechange", function () {
            if (overlay && !overlay.hidden) render();
        });
    }

    function render() {
        if (!panel) return;
        var mode = effectiveMode();
        var pref = storedThemePref();
        var palettes = window.LJMTheme.getPalettes();

        // Modes
        var modes = ["light", "dark", "system"];
        panel.querySelector(".ljm-appear-modes").innerHTML = modes.map(function (m) {
            var label = m.charAt(0).toUpperCase() + m.slice(1);
            return '<button type="button" data-mode="' + m + '" class="ljm-appear-mode' + (pref === m ? " active" : "") +
                '" aria-pressed="' + (pref === m) + '">' + MODE_ICONS[m] + "<span>" + label + "</span></button>";
        }).join("");

        // Mode hint + swatches (colors shown for the active mode)
        panel.querySelector(".ljm-appear-modehint").textContent = "for " + mode + " mode";
        var current = window.LJMTheme.getAccent(mode);
        var ids = Object.keys(palettes);
        panel.querySelector(".ljm-appear-swatches").innerHTML = ids.map(function (id) {
            var p = palettes[id][mode];
            var sel = id === current;
            return '<button type="button" class="ljm-appear-swatch' + (sel ? " selected" : "") +
                '" data-accent="' + id + '" title="' + palettes[id].name + '" aria-pressed="' + sel + '">' +
                '<span class="ljm-appear-chip" style="background:' + p.a + ';box-shadow:0 0 0 3px ' + p.s + ';">' +
                    (sel ? '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>' : "") +
                "</span>" +
                '<span class="ljm-appear-swatch-name">' + palettes[id].name + "</span>" +
                "</button>";
        }).join("");

        // Sync status
        panel.querySelector(".ljm-appear-sync").textContent = isSignedIn()
            ? "Synced to your account"
            : "Saved on this device";
    }

    function open() {
        if (!panel) build();
        pullFromServer();
        render();
        overlay.hidden = false;
        requestAnimationFrame(function () { overlay.classList.add("open"); });
    }
    function close() {
        if (!overlay) return;
        overlay.classList.remove("open");
        setTimeout(function () { overlay.hidden = true; }, 220);
    }

    window.LJMAppearance = { open: open, close: close, paletteIcon: PALETTE_ICON };

    document.addEventListener("DOMContentLoaded", function () {
        build();
        // Rehydrate from the account on load so a choice made on another device
        // is reflected without opening the panel.
        pullFromServer();
    });
})();
