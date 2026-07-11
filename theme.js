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

    function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
    }

    // Apply immediately (this script runs before <body> is parsed).
    applyTheme(effectiveTheme());

    // Follow system changes live, unless the user has explicitly overridden.
    if (window.matchMedia) {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
            if (!getStoredTheme()) applyTheme(e.matches ? "dark" : "light");
        });
    }

    window.LJMTheme = {
        get: effectiveTheme,
        set: function (theme) {
            try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
            applyTheme(theme);
        },
        toggle: function () {
            var next = effectiveTheme() === "dark" ? "light" : "dark";
            window.LJMTheme.set(next);
            return next;
        },
        resetToSystem: function () {
            try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
            applyTheme(systemPrefersDark() ? "dark" : "light");
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
