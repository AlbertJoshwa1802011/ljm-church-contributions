// Shared theme (light/dark) + mobile bottom-nav icon upgrade for all public pages.
// Loaded synchronously (no defer) right after theme.css so the correct theme is
// applied before first paint — avoids a flash of the wrong theme.
(function () {
    // ---- Global API Redirect for Local Preview to Live Production ----
    var isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (isLocalhost) {
        var originalFetch = window.fetch;
        window.fetch = function (input, init) {
            var url = typeof input === "string" ? input : (input instanceof Request ? input.url : "");
            if (url && url.startsWith("/api/")) {
                url = "https://light-of-jesus-ministry-contributions.pages.dev" + url;
            }
            return originalFetch.call(this, url, init);
        };
    }

    var STORAGE_KEY = "ljmTheme"; // "light" | "dark" — absent = follow system

    // ---- Accent palettes (user-selectable "themes") ----
    // Each palette carries a WCAG-AA-validated triplet for BOTH light and dark
    // mode (a = --accent, d = --accent-deep, s = --accent-soft). Because the
    // whole app derives from these three tokens (and the --google-* aliases in
    // theme.css point at them), overriding them inline on <html> re-themes
    // everything. The selection is stored PER MODE — a member can run one accent
    // in light mode and a different one in dark mode.
    // A curated "English heritage" collection — muted, sophisticated tones
    // (think Farrow & Ball) rather than bright primaries. Every triplet is
    // WCAG-AA validated for both modes against the real bg/surface colors.
    var PALETTES = {
        wedgwood: { name: "Wedgwood", light: { a: "#3D6079", d: "#2E4A5E", s: "#E8ECEF" }, dark: { a: "#5E90AB", d: "#A9C7DB", s: "rgba(94,144,171,0.16)" } },
        sage: { name: "Sage", light: { a: "#4F6A57", d: "#3D5344", s: "#EAEDEB" }, dark: { a: "#699680", d: "#B4CDBC", s: "rgba(105,150,128,0.16)" } },
        heather: { name: "Heather", light: { a: "#6E5A8C", d: "#574571", s: "#EEEBF1" }, dark: { a: "#9280BA", d: "#C6B6DE", s: "rgba(146,128,186,0.16)" } },
        aubergine: { name: "Aubergine", light: { a: "#6D4266", d: "#542F4F", s: "#EDE8ED" }, dark: { a: "#B07FA6", d: "#C9A3C1", s: "rgba(176,127,166,0.16)" } },
        claret: { name: "Claret", light: { a: "#8A3B44", d: "#6E2C34", s: "#F1E7E9" }, dark: { a: "#C77680", d: "#DBA0A7", s: "rgba(199,118,128,0.16)" } },
        terracotta: { name: "Terracotta", light: { a: "#A65A3F", d: "#85422C", s: "#F4EBE8" }, dark: { a: "#C27753", d: "#E0AE95", s: "rgba(194,119,83,0.16)" } },
        ochre: { name: "Ochre", light: { a: "#8A6A2A", d: "#6E531E", s: "#F1EDE5" }, dark: { a: "#A8863C", d: "#DBC084", s: "rgba(168,134,60,0.16)" } },
        teal: { name: "Teal", light: { a: "#2C6E6A", d: "#1F5450", s: "#E6EEED" }, dark: { a: "#4C948E", d: "#9CCBC6", s: "rgba(76,148,142,0.16)" } },
        slate: { name: "Slate", light: { a: "#4A5A73", d: "#37455B", s: "#E9EBEE" }, dark: { a: "#7789A8", d: "#B4C0D3", s: "rgba(119,137,168,0.16)" } }
    };
    var DEFAULT_ACCENT = "wedgwood"; // matches the theme.css baseline tokens
    var ACCENT_KEYS = { light: "ljmAccentLight", dark: "ljmAccentDark" };

    function systemPrefersDark() {
        return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    function getStoredTheme() {
        try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; }
    }

    function effectiveTheme() {
        var stored = getStoredTheme();
        if (stored === "light" || stored === "dark") return stored;
        return systemPrefersDark() ? "dark" : "light";
    }

    // Stored palette id for a given mode ("light"|"dark"), defaulting to indigo.
    function getAccentId(mode) {
        try {
            var id = localStorage.getItem(ACCENT_KEYS[mode]);
            if (id && PALETTES[id]) return id;
        } catch (_) {}
        return DEFAULT_ACCENT;
    }

    // Write the three --accent* tokens for `mode`'s chosen palette as inline
    // styles on <html>. Inline styles win over both the :root and
    // [data-theme="dark"] blocks in theme.css, so this is what actually recolors
    // the app. `data-accent` is set so a MutationObserver (e.g. the progress
    // ring in script.js) can react to accent-only changes.
    function applyAccent() {
        var mode = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
        var id = getAccentId(mode);
        var p = (PALETTES[id] || PALETTES[DEFAULT_ACCENT])[mode];
        var root = document.documentElement;
        root.style.setProperty("--accent", p.a);
        root.style.setProperty("--accent-deep", p.d);
        root.style.setProperty("--accent-soft", p.s);
        root.setAttribute("data-accent", id);
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        // The chosen accent differs per mode, so re-apply whenever the mode changes.
        applyAccent();
    }

    // Apply immediately (this script runs before <body> is parsed).
    applyTheme(effectiveTheme());

    // Follow system changes live, unless the user has explicitly overridden.
    if (window.matchMedia) {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
            if (!getStoredTheme()) applyTheme(e.matches ? "dark" : "light");
        });
    }

    function emitChange() {
        try {
            window.dispatchEvent(new CustomEvent("ljm:appearancechange", {
                detail: { theme: effectiveTheme(), accentLight: getAccentId("light"), accentDark: getAccentId("dark") }
            }));
        } catch (_) {}
    }

    window.LJMTheme = {
        get: effectiveTheme,
        set: function (theme) {
            try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
            applyTheme(theme);
            emitChange();
        },
        toggle: function () {
            var next = effectiveTheme() === "dark" ? "light" : "dark";
            window.LJMTheme.set(next);
            return next;
        },
        resetToSystem: function () {
            try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
            applyTheme(systemPrefersDark() ? "dark" : "light");
            emitChange();
        },
        // ---- Accent (theme color) API ----
        getPalettes: function () { return PALETTES; },
        // Returns the stored palette id for a mode ("light"|"dark").
        getAccent: function (mode) { return getAccentId(mode === "dark" ? "dark" : "light"); },
        // Persist + (if it affects the active mode) live-apply an accent choice.
        // `opts.silent` skips the change event (used when seeding from the server).
        setAccent: function (mode, id, opts) {
            mode = mode === "dark" ? "dark" : "light";
            if (!PALETTES[id]) return false;
            try { localStorage.setItem(ACCENT_KEYS[mode], id); } catch (_) {}
            if (effectiveTheme() === mode) applyAccent();
            if (!(opts && opts.silent)) emitChange();
            return true;
        },
        resetAccent: function () {
            try {
                localStorage.removeItem(ACCENT_KEYS.light);
                localStorage.removeItem(ACCENT_KEYS.dark);
            } catch (_) {}
            applyAccent();
            emitChange();
        }
    };

    // ---- Icon set: Instagram/WhatsApp-style outline SVGs, 24x24 viewBox ----
    var ICONS = {
        home: '<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9"/><path d="M9.5 20v-6h5v6"/></svg>',
        members: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M2.7 20c.7-3.4 3.2-5.5 6.3-5.5s5.6 2.1 6.3 5.5"/><circle cx="17" cy="8.5" r="2.4"/><path d="M15.8 14.8c2.2.3 3.9 2 4.5 4.7"/></svg>',
        give: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.1 2 4.5 5.4 4a4.7 4.7 0 0 1 6.6 1.8A4.7 4.7 0 0 1 18.6 4c3.4.5 5 4.1 3.4 7.7C19.5 16.4 12 21 12 21Z"/></svg>',
        bought: '<svg viewBox="0 0 24 24"><path d="M6 8h12l1 12.5a1 1 0 0 1-1 1.5H6a1 1 0 0 1-1-1.5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
        about: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".25" fill="currentColor" stroke-width="1.6"/></svg>',
        funds: '<svg viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M4 21V10l8-6 8 6v11"/><path d="M9 21v-7h6v7"/></svg>',
        sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/></svg>',
        moon: '<svg viewBox="0 0 24 24"><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.3 7 7 0 0 0 20.5 14.5Z"/></svg>'
    };

    function upgradeBottomNavIcons(root) {
        var items = (root || document).querySelectorAll(".bottom-nav-item[data-icon] .nav-icon");
        items.forEach(function (span) {
            var key = span.closest(".bottom-nav-item").getAttribute("data-icon");
            if (ICONS[key]) span.innerHTML = ICONS[key];
        });
    }

    // The theme toggle now lives inside the shared header (header.js owns it).
    // theme.js keeps only: theme detection/apply, the window.LJMTheme API, and
    // the bottom-nav emoji→SVG icon upgrade.
    document.addEventListener("DOMContentLoaded", function () {
        upgradeBottomNavIcons(document);
    });
})();
