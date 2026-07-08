// Shared top header for all public pages — "Light of Jesus Ministry".
// One component so the header stays identical everywhere and is easy to evolve.
// Rebuilds the existing <header class="navbar"> mount in place on DOMContentLoaded.
//
// Preserves the auth hooks index.html's inline script wires up by id
// (#authContainer, #googleSignInBtn, #userInfo, #adminLink) so Google Sign-In
// keeps working untouched. Owns the theme toggle (theme.js defers to it) and a
// fund switcher that scales to any number of funds via /api/funds.
(function () {
    var BRAND = "Light of Jesus Ministry";

    var ICONS = {
        mark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1.6 3.4 1.6 6.2 0 8.4 2.2-.6 3.8-2 4.8-4.2.9 3.2.3 6-1.8 8.4 2.4-.3 4.3-1.4 5.7-3.4.2 4.6-2.7 8.8-7 10.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 22c-4.4-1.4-7.3-5.6-7-10.2 1.4 2 3.3 3.1 5.7 3.4-2.1-2.4-2.7-5.2-1.8-8.4 1 2.2 2.6 3.6 4.8 4.2" fill="currentColor" opacity="0.28"/></svg>',
        chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/></svg>',
        moon: '<svg viewBox="0 0 24 24"><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.3 7 7 0 0 0 20.5 14.5Z"/></svg>',
        wallet: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><circle cx="16.5" cy="13.5" r="1.1" fill="currentColor" stroke="none"/></svg>'
    };

    var NAV = [
        ["home", "index.html", "Home"],
        ["funds", "funds.html", "Funds"],
        ["members", "members.html", "Members"],
        ["impact", "impact.html", "Impact"],
        ["about", "about.html", "About"]
    ];

    function currentPage() {
        var p = (location.pathname.split("/").pop() || "index.html").toLowerCase();
        if (p === "" || p === "index.html") return "home";
        if (p === "funds.html") return "funds";
        if (p === "members.html") return "members";
        if (p === "impact.html") return "impact";
        if (p === "about.html") return "about";
        if (p === "member.html") return "members";
        return "";
    }

    function currentFundSlug() {
        try { return new URLSearchParams(location.search).get("fund") || ""; } catch (_) { return ""; }
    }

    // ---- session helpers (read-only; index.html owns the real GIS flow) ----
    function readStoredIdentity() {
        try {
            var t = sessionStorage.getItem("ljmUserIdToken");
            if (!t || t.split(".").length !== 3) return null;
            var p = JSON.parse(atob(t.split(".")[1]));
            return { name: p.name || (p.email || "").split("@")[0], email: p.email || "", picture: p.picture || "" };
        } catch (_) { return null; }
    }

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    // ---- fund switcher data (cached briefly to avoid flicker across pages) ----
    function getFunds() {
        try {
            var cached = JSON.parse(sessionStorage.getItem("ljmFundsCache") || "null");
            if (cached && Date.now() - cached.t < 60000) return Promise.resolve(cached.funds);
        } catch (_) {}
        return fetch("/api/funds").then(function (r) { return r.json(); }).then(function (d) {
            var funds = (d && d.funds) ? d.funds.filter(function (f) { return f.status !== "deleted"; }) : [];
            try { sessionStorage.setItem("ljmFundsCache", JSON.stringify({ t: Date.now(), funds: funds })); } catch (_) {}
            return funds;
        }).catch(function () {
            // Fallback so the switcher is never empty even if the API is unreachable.
            return [
                { slug: "tech-contributions", name: "Tech Fund" },
                { slug: "christmas-fund", name: "Christmas Fund" }
            ];
        });
    }

    var FUND_EMOJI = { "tech-contributions": "💻", "christmas-fund": "🎄" };
    function fundLabel(f) { return (FUND_EMOJI[f.slug] || "⛪") + " " + f.name; }

    function build() {
        var mount = document.querySelector("header.navbar") || document.querySelector("header.ljm-header");
        if (!mount) return;

        var page = currentPage();
        var identity = readStoredIdentity();

        var navHtml = NAV.map(function (n) {
            return '<a href="' + n[1] + '" data-nav="' + n[0] + '"' +
                (n[0] === page ? ' class="active"' : "") + '>' + n[2] + "</a>";
        }).join("");

        // Auth cluster: keep the exact ids index.html's script drives.
        var authHtml =
            '<div id="authContainer" class="ljmh-auth-gis">' +
                '<div id="googleSignInBtn"></div>' +
            "</div>" +
            '<span id="userInfo" class="ljmh-userinfo" style="display:none;"></span>' +
            '<a href="admin.html" id="adminLink" class="ljmh-admin" style="display:none;">Admin ⚡</a>';

        // On pages without the GIS flow, show a lightweight sign-in / avatar.
        var guestHtml =
            (identity
                ? '<div class="ljmh-avatar" title="' + esc(identity.email) + '">' +
                      (identity.picture
                          ? '<img src="' + esc(identity.picture) + '" alt="">'
                          : esc((identity.name || "?").charAt(0).toUpperCase())) +
                  "</div>"
                : '<a class="ljmh-signin" href="index.html#signin">Sign in</a>');

        mount.className = "ljm-header";
        mount.innerHTML =
            '<div class="ljmh-inner">' +
                '<a class="ljmh-brand" href="index.html" aria-label="' + BRAND + ' home">' +
                    '<span class="ljmh-mark">' + ICONS.mark + "</span>" +
                    '<span class="ljmh-word">' + BRAND + "</span>" +
                "</a>" +
                '<nav class="ljmh-nav">' + navHtml + "</nav>" +
                '<div class="ljmh-actions">' +
                    '<div class="ljmh-fundswitch">' +
                        '<button type="button" class="ljmh-fundbtn" aria-haspopup="listbox" aria-expanded="false">' +
                            '<span class="ljmh-fund-ic">' + ICONS.wallet + "</span>" +
                            '<span class="ljmh-fundlabel">Funds</span>' +
                            '<span class="ljmh-fundchev">' + ICONS.chevron + "</span>" +
                        "</button>" +
                        '<div class="ljmh-fundmenu" role="listbox" hidden></div>' +
                    "</div>" +
                    '<button type="button" class="theme-toggle-btn" aria-label="Toggle dark mode"></button>' +
                    '<div class="ljmh-auth" data-page="' + page + '">' +
                        (page === "home" ? authHtml : guestHtml) +
                    "</div>" +
                "</div>" +
            "</div>";

        wireTheme(mount);
        wireFundSwitch(mount);
    }

    function wireTheme(root) {
        var btn = root.querySelector(".theme-toggle-btn");
        if (!btn || !window.LJMTheme) return;
        var paint = function () { btn.innerHTML = window.LJMTheme.get() === "dark" ? ICONS.sun : ICONS.moon; };
        paint();
        btn.addEventListener("click", function () { window.LJMTheme.toggle(); paint(); });
    }

    function wireFundSwitch(root) {
        var wrap = root.querySelector(".ljmh-fundswitch");
        var btn = wrap.querySelector(".ljmh-fundbtn");
        var menu = wrap.querySelector(".ljmh-fundmenu");
        var labelEl = wrap.querySelector(".ljmh-fundlabel");
        var slug = currentFundSlug();

        getFunds().then(function (funds) {
            if (slug) {
                var cur = funds.filter(function (f) { return f.slug === slug; })[0];
                if (cur) labelEl.textContent = cur.name;
            } else if (currentPage() === "home") {
                labelEl.textContent = "Tech Fund";
            }
            menu.innerHTML = funds.map(function (f) {
                var active = f.slug === slug ? " ljmh-fund-active" : "";
                return '<a class="ljmh-fundopt' + active + '" role="option" href="index.html?fund=' +
                    encodeURIComponent(f.slug) + '">' + esc(fundLabel(f)) + "</a>";
            }).join("") || '<div class="ljmh-fundempty">No funds yet</div>';
        });

        var close = function () { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); wrap.classList.remove("open"); };
        var open = function () { menu.hidden = false; btn.setAttribute("aria-expanded", "true"); wrap.classList.add("open"); };
        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            if (menu.hidden) open(); else close();
        });
        document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) close(); });
        document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", build);
    } else {
        build();
    }
})();
