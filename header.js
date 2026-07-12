// LJM Church — shared app shell for all public pages.
// Injects: (1) top header (brand, desktop nav, fund switcher, theme toggle,
// auth cluster with avatar menu + sign out), (2) mobile bottom nav
// (Home · Funds · Give · Subscriptions · More) and (3) the "More" slide-up sheet.
// One component so every page stays consistent and easy to evolve.
//
// Auth contract: index.html's inline Google Sign-In script drives the ids
// #authContainer / #googleSignInBtn / #userInfo / #adminLink — this shell
// preserves them on the home page. Identity is read from
// sessionStorage.ljmUserIdToken (GIS JWT) and enriched by
// sessionStorage.ljmAuthProfile ({ isAdmin, member, ... } written by the
// /api/auth handshake).
(function () {
    var BRAND = "LJM Church";
    var BRAND_SUB = "Light of Jesus Ministry";

    var ICONS = {
        mark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5 C 12 5, 9.5 1.5, 6 1.5 C 3 1.5, 1 4, 1 7.5 C 1 12.5, 10 18.5, 12 20 C 14 18.5, 23 12.5, 23 7.5 C 23 4, 21 1.5, 18 1.5 C 14.5 1.5, 12 5, 12 5 Z" fill="#dc2626"/><path d="M11 4 H13 V7 H15.5 V9 H13 V15.5 H11 V9 H8.5 V7 H11 Z" fill="#fbbf24"/><path d="M12 14.5 C 10.5 13, 6 13, 3 14.5 L 3 18.5 C 6 17, 10.5 17, 12 18.5 C 13.5 17, 18 17, 21 18.5 L 21 14.5 C 18 13, 13.5 13, 12 14.5 Z" fill="#ffffff" stroke="#7f1d1d" stroke-width="0.8"/></svg>',
        chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/></svg>',
        moon: '<svg viewBox="0 0 24 24"><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.3 7 7 0 0 0 20.5 14.5Z"/></svg>',
        wallet: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><circle cx="16.5" cy="13.5" r="1.1" fill="currentColor" stroke="none"/></svg>',
        home: '<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9"/><path d="M9.5 20v-6h5v6"/></svg>',
        funds: '<svg viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M4 21V10l8-6 8 6v11"/><path d="M9 21v-7h6v7"/></svg>',
        give: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.1 2 4.5 5.4 4a4.7 4.7 0 0 1 6.6 1.8A4.7 4.7 0 0 1 18.6 4c3.4.5 5 4.1 3.4 7.7C19.5 16.4 12 21 12 21Z"/></svg>',
        subscriptions: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>',
        more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
        members: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M2.7 20c.7-3.4 3.2-5.5 6.3-5.5s5.6 2.1 6.3 5.5"/><circle cx="17" cy="8.5" r="2.4"/><path d="M15.8 14.8c2.2.3 3.9 2 4.5 4.7"/></svg>',
        bought: '<svg viewBox="0 0 24 24"><path d="M6 8h12l1 12.5a1 1 0 0 1-1 1.5H6a1 1 0 0 1-1-1.5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
        about: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".25" fill="currentColor" stroke-width="1.6"/></svg>',
        person: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.2c.9-3.9 3.8-6.2 7.2-6.2s6.3 2.3 7.2 6.2"/></svg>',
        phone: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.9 21 3 13.1 3 3.9c0-.6.4-1 1-1H7.3c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.3 1.1L6.6 10.8Z"/></svg>',
        mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.2"/><path d="m4 7 8 6 8-6"/></svg>',
        admin: '<svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.4-2.9 8.3-7 10-4.1-1.7-7-5.6-7-10V6l7-3Z"/><path d="M9.2 12.2l2 2 3.8-4"/></svg>',
        signout: '<svg viewBox="0 0 24 24"><path d="M9 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3H9"/><path d="M15 16l4-4-4-4"/><path d="M19 12H9"/></svg>',
        settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };

    // Desktop top-nav order (mobile uses bottom nav + More sheet instead).
    var NAV = [
        ["home", "index.html", "Home"],
        ["funds", "funds.html", "Funds"],
        ["subscriptions", "subscriptions.html", "Subscriptions"],
        ["members", "members.html", "Members"],
        ["impact", "impact.html", "Impact"],
        ["about", "about.html", "About"]
    ];

    function currentPage() {
        // Cloudflare Pages serves clean URLs (redirects funds.html -> /funds),
        // so match with any ".html" stripped — otherwise every check below
        // silently never matches once a visitor lands on the extensionless
        // URL (which Pages promotes), breaking active-nav highlighting.
        var p = (location.pathname.split("/").pop() || "index").toLowerCase();
        if (p.slice(-5) === ".html") p = p.slice(0, -5);
        if (p === "" || p === "index") return "home";
        if (p === "funds") return "funds";
        if (p === "subscriptions") return "subscriptions";
        if (p === "members") return "members";
        if (p === "impact") return "impact";
        if (p === "about") return "about";
        if (p === "member") return "members";
        return "";
    }

    function currentFundSlug() {
        try { return new URLSearchParams(location.search).get("fund") || ""; } catch (_) { return ""; }
    }

    // ---- identity ----
    function readStoredIdentity() {
        try {
            var t = sessionStorage.getItem("ljmUserIdToken");
            if (!t || t.split(".").length !== 3) return null;
            var p = JSON.parse(atob(t.split(".")[1]));
            return { name: p.name || (p.email || "").split("@")[0], email: (p.email || "").toLowerCase(), picture: p.picture || "" };
        } catch (_) { return null; }
    }
    function readAuthProfile() {
        try { return JSON.parse(sessionStorage.getItem("ljmAuthProfile") || "null"); } catch (_) { return null; }
    }
    function isAdminUser(identity) {
        var profile = readAuthProfile();
        if (profile && profile.isAdmin) return true;
        if (identity && window.LJMAdmin && LJMAdmin.isAdmin(identity.email)) return true;
        return false;
    }

    function signOut() {
        try {
            sessionStorage.removeItem("ljmUserIdToken");
            sessionStorage.removeItem("ljmAuthProfile");
            sessionStorage.removeItem("ljmGuest");
        } catch (_) {}
        try { if (window.LJMAdmin) LJMAdmin.destroySession(); } catch (_) {}
        try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (_) {}
        location.href = "index.html";
    }
    window.LJMShell = { signOut: signOut };

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
            return [
                { slug: "tech-contributions", name: "Tech Fund" },
                { slug: "christmas-fund", name: "Christmas Fund" }
            ];
        });
    }
    var FUND_EMOJI = { "tech-contributions": "💻", "christmas-fund": "🎄" };
    function fundLabel(f) { return (FUND_EMOJI[f.slug] || "⛪") + " " + f.name; }

    function getSettings() {
        try {
            var cached = JSON.parse(sessionStorage.getItem("ljmSettingsCache") || "null");
            if (cached && Date.now() - cached.t < 60000) return Promise.resolve(cached.settings);
        } catch (_) {}
        return fetch("/api/settings?_t=" + Date.now()).then(function (r) { return r.json(); }).then(function (d) {
            var s = (d && d.settings) || {};
            try { sessionStorage.setItem("ljmSettingsCache", JSON.stringify({ t: Date.now(), settings: s })); } catch (_) {}
            return s;
        }).catch(function () {
            return {
                pastor_name: "Pastor MK",
                pastor_phone: "+91 99409 40326",
                pastor_email: "",
                pastor_address: "Light of Jesus Ministry, Coimbatore"
            };
        });
    }

    // ================= top header =================
    function buildHeader() {
        var mount = document.querySelector("header.navbar") || document.querySelector("header.ljm-header");
        if (!mount) return;

        var page = currentPage();
        var identity = readStoredIdentity();

        var navHtml = NAV.map(function (n) {
            return '<a href="' + n[1] + '" data-nav="' + n[0] + '"' +
                (n[0] === page ? ' class="active"' : "") + '>' + n[2] + "</a>";
        }).join("");

        // Home page keeps the ids the inline GIS script drives.
        var gisHtml = page === "home"
            ? '<div id="authContainer" class="ljmh-auth-gis"><div id="googleSignInBtn"></div></div>' +
              '<span id="userInfo" class="ljmh-userinfo" style="display:none;"></span>' +
              '<a href="admin.html" id="adminLink" class="ljmh-admin" style="display:none;">Admin ⚡</a>'
            : "";

        var accountHtml = identity
            ? '<button type="button" class="ljmh-avatar" id="ljmhAvatarBtn" title="' + esc(identity.email) + '" aria-haspopup="menu" aria-expanded="false">' +
                  (identity.picture ? '<img src="' + esc(identity.picture) + '" alt="" referrerpolicy="no-referrer">' : esc((identity.name || "?").charAt(0).toUpperCase())) +
              "</button>" +
              '<div class="ljmh-menu" id="ljmhAvatarMenu" hidden></div>'
            : (page === "home" ? "" : '<a class="ljmh-signin" href="index.html#signin">Sign in</a>');

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
                    '<div class="ljmh-auth" data-page="' + page + '">' + gisHtml + accountHtml + "</div>" +
                "</div>" +
            "</div>";

        wireTheme(mount.querySelector(".theme-toggle-btn"));
        wireFundSwitch(mount);
        wireAvatarMenu(identity);

        getSettings().then(function (settings) {
            var phone = settings.pastor_phone || "+91 99409 40326";
            var email = settings.pastor_email || "";
            var name = settings.pastor_name || "Pastor MK";
            var address = settings.pastor_address || "Light of Jesus Ministry, Coimbatore";
            var telHref = "tel:" + phone.replace(/[^0-9+]/g, "");

            var topBar = document.getElementById("ljmTopBar");
            if (!topBar) {
                topBar = document.createElement("div");
                topBar.id = "ljmTopBar";
                topBar.className = "ljm-top-bar";
                mount.parentNode.insertBefore(topBar, mount);
            }
            // Phone/email (primary) stay tappable and visible at every width;
            // name/address (secondary) collapse away only on narrow phones —
            // see the .ljm-top-secondary media rule in theme.css.
            topBar.innerHTML =
                '<div class="ljm-top-primary">' +
                    '<a class="ljm-top-item" href="' + esc(telHref) + '">📞 ' + esc(phone) + '</a>' +
                    (email
                        ? '<span class="ljm-top-divider">|</span><a class="ljm-top-item" href="mailto:' + esc(email) + '">✉️ ' + esc(email) + '</a>'
                        : '') +
                '</div>' +
                '<span class="ljm-top-divider ljm-top-divider-sec">|</span>' +
                '<div class="ljm-top-secondary">' +
                    '<span class="ljm-top-item">👤 Pastor: ' + esc(name) + '</span>' +
                    '<span class="ljm-top-divider">|</span>' +
                    '<span class="ljm-top-item">📍 ' + esc(address) + '</span>' +
                '</div>';

            var sheetUserDetail = document.getElementById("ljmhMoreSheetUserDetail");
            if (sheetUserDetail) {
                sheetUserDetail.innerHTML = '<div class="ljmh-menu-name">Pastor ' + esc(name) + '</div>' +
                                            '<div class="ljmh-menu-email">' + esc(phone) + ' · ' + esc(address.split(",")[0]) + '</div>';
            }

            // Always-present contact shortcuts in the mobile "More" sheet —
            // previously this slot only existed for signed-out visitors, so a
            // signed-in mobile user had no way at all to reach pastor contact
            // info (the top bar was also fully hidden below 580px).
            var callItem = document.getElementById("ljmhSheetCallPastor");
            if (callItem) {
                callItem.href = telHref;
                var callLabel = callItem.querySelector("span");
                if (callLabel) callLabel.textContent = "Call " + name;
            }
            var emailItem = document.getElementById("ljmhSheetEmailPastor");
            if (emailItem) {
                if (email) {
                    emailItem.href = "mailto:" + email;
                    emailItem.style.display = "";
                } else {
                    emailItem.style.display = "none";
                }
            }
        });
    }

    function wireTheme(btn) {
        if (!btn || !window.LJMTheme) return;
        var paint = function () { btn.innerHTML = window.LJMTheme.get() === "dark" ? ICONS.sun : ICONS.moon; };
        paint();
        btn.addEventListener("click", function () { window.LJMTheme.toggle(); paint(); });
    }

    function wireFundSwitch(root) {
        var wrap = root.querySelector(".ljmh-fundswitch");
        if (!wrap) return;
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
        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            if (menu.hidden) { menu.hidden = false; btn.setAttribute("aria-expanded", "true"); wrap.classList.add("open"); }
            else close();
        });
        document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) close(); });
        document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    }

    function wireAvatarMenu(identity) {
        var btn = document.getElementById("ljmhAvatarBtn");
        var menu = document.getElementById("ljmhAvatarMenu");
        if (!btn || !menu || !identity) return;

        var admin = isAdminUser(identity);
        menu.innerHTML =
            '<div class="ljmh-menu-head">' +
                '<div class="ljmh-menu-name">' + esc(identity.name) + "</div>" +
                '<div class="ljmh-menu-email">' + esc(identity.email) + "</div>" +
            "</div>" +
            '<a class="ljmh-menu-item" href="member.html">' + ICONS.person + "<span>My contributions</span></a>" +
            (admin ? '<a class="ljmh-menu-item" href="admin.html">' + ICONS.admin + "<span>Admin console</span></a>" +
                     '<a class="ljmh-menu-item" href="admin.html#settings">' + ICONS.settings + "<span>System Settings</span></a>" : "") +
            '<button type="button" class="ljmh-menu-item ljmh-menu-signout" id="ljmhSignOutBtn">' + ICONS.signout + "<span>Sign out</span></button>";

        var close = function () { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); };
        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            if (menu.hidden) { menu.hidden = false; btn.setAttribute("aria-expanded", "true"); }
            else close();
        });
        document.addEventListener("click", function (e) { if (!menu.contains(e.target) && e.target !== btn) close(); });
        document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
        var so = document.getElementById("ljmhSignOutBtn");
        if (so) so.addEventListener("click", signOut);
    }

    // ================= bottom nav + More sheet =================
    function buildBottomNav() {
        // Replace any legacy per-page bottom nav with the shell-owned one.
        var old = document.querySelector("nav.bottom-nav");
        if (old) old.remove();

        var page = currentPage();
        var nav = document.createElement("nav");
        nav.className = "bottom-nav";
        nav.setAttribute("aria-label", "Primary");
        var item = function (key, href, label, icon, extra) {
            return '<a href="' + href + '" class="bottom-nav-item' + (extra || "") + (page === key ? " active" : "") + '" data-tab="' + key + '">' +
                '<span class="nav-icon">' + icon + "</span>" + (label ? "<span>" + label + "</span>" : "") + "</a>";
        };
        nav.innerHTML =
            item("home", "index.html", "Home", ICONS.home) +
            item("funds", "funds.html", "Funds", ICONS.funds) +
            item("give", "index.html#give", "", ICONS.give, " action-btn") +
            item("subscriptions", "subscriptions.html", "Subscriptions", ICONS.subscriptions) +
            '<button type="button" class="bottom-nav-item" id="ljmhMoreBtn" data-tab="more">' +
                '<span class="nav-icon">' + ICONS.more + "</span><span>More</span></button>";
        document.body.appendChild(nav);

        // Give: on the home page open the contribution modal instead of navigating.
        var giveBtn = nav.querySelector('[data-tab="give"]');
        if (giveBtn && page === "home") {
            giveBtn.addEventListener("click", function (e) { e.preventDefault(); triggerGive(); });
        }

        buildMoreSheet();
        var moreBtn = document.getElementById("ljmhMoreBtn");
        if (moreBtn) moreBtn.addEventListener("click", openMoreSheet);
    }

    function triggerGive() {
        var pay = document.getElementById("rzp-button1");
        if (pay) { pay.click(); return; }
        var target = document.querySelector(".fund-heading") || document.body;
        target.scrollIntoView({ behavior: "smooth" });
    }

    function buildMoreSheet() {
        if (document.getElementById("ljmhMoreSheet")) return;
        var identity = readStoredIdentity();
        var admin = isAdminUser(identity);
        var page = currentPage();

        var wrap = document.createElement("div");
        wrap.id = "ljmhMoreSheet";
        wrap.hidden = true;
        wrap.innerHTML =
            '<div class="ljmh-sheet-backdrop"></div>' +
            '<div class="ljmh-sheet" role="dialog" aria-label="More">' +
                '<div class="ljmh-sheet-grip"></div>' +
                (identity
                    ? '<div class="ljmh-sheet-user">' +
                        '<span class="ljmh-avatar ljmh-avatar-static">' + (identity.picture ? '<img src="' + esc(identity.picture) + '" alt="" referrerpolicy="no-referrer">' : esc((identity.name || "?").charAt(0).toUpperCase())) + "</span>" +
                        '<div><div class="ljmh-menu-name">' + esc(identity.name) + '</div><div class="ljmh-menu-email">' + esc(identity.email) + "</div></div>" +
                      "</div>"
                    : '<div class="ljmh-sheet-user"><span class="ljmh-avatar ljmh-avatar-static">🙏</span><div id="ljmhMoreSheetUserDetail"><div class="ljmh-menu-name">Welcome</div><div class="ljmh-menu-email">' + BRAND_SUB + "</div></div></div>") +
                '<div class="ljmh-sheet-grid">' +
                    '<a class="ljmh-sheet-item' + (page === "members" ? " active" : "") + '" href="members.html">' + ICONS.members + "<span>Members</span></a>" +
                    '<a class="ljmh-sheet-item' + (page === "impact" ? " active" : "") + '" href="impact.html">' + ICONS.bought + "<span>Impact</span></a>" +
                    '<a class="ljmh-sheet-item' + (page === "about" ? " active" : "") + '" href="about.html">' + ICONS.about + "<span>About</span></a>" +
                    '<a class="ljmh-sheet-item" id="ljmhSheetCallPastor" href="tel:">' + ICONS.phone + "<span>Call Pastor</span></a>" +
                    '<a class="ljmh-sheet-item" id="ljmhSheetEmailPastor" href="mailto:" style="display:none;">' + ICONS.mail + "<span>Email Pastor</span></a>" +
                    '<a class="ljmh-sheet-item" href="member.html">' + ICONS.person + "<span>My giving</span></a>" +
                    (admin ? '<a class="ljmh-sheet-item" href="admin.html">' + ICONS.admin + "<span>Admin</span></a>" +
                             '<a class="ljmh-sheet-item" href="admin.html#settings">' + ICONS.settings + "<span>Settings</span></a>" : "") +
                    '<button type="button" class="ljmh-sheet-item" id="ljmhSheetTheme">' + ICONS.moon + "<span>Theme</span></button>" +
                "</div>" +
                (identity
                    ? '<button type="button" class="ljmh-sheet-signout" id="ljmhSheetSignOut">' + ICONS.signout + "<span>Sign out</span></button>"
                    : '<a class="ljmh-sheet-signout ljmh-sheet-signin" href="index.html#signin">' + ICONS.person + "<span>Sign in with Google</span></a>") +
            "</div>";
        document.body.appendChild(wrap);

        wrap.querySelector(".ljmh-sheet-backdrop").addEventListener("click", closeMoreSheet);
        document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMoreSheet(); });

        var themeBtn = document.getElementById("ljmhSheetTheme");
        if (themeBtn && window.LJMTheme) {
            var paint = function () {
                themeBtn.innerHTML = (window.LJMTheme.get() === "dark" ? ICONS.sun : ICONS.moon) +
                    "<span>" + (window.LJMTheme.get() === "dark" ? "Light mode" : "Dark mode") + "</span>";
            };
            paint();
            themeBtn.addEventListener("click", function () { window.LJMTheme.toggle(); paint(); });
        }
        var so = document.getElementById("ljmhSheetSignOut");
        if (so) so.addEventListener("click", signOut);
    }

    function openMoreSheet() {
        var s = document.getElementById("ljmhMoreSheet");
        if (!s) return;
        s.hidden = false;
        requestAnimationFrame(function () { s.classList.add("open"); });
        document.documentElement.style.overflow = "hidden";
    }
    function closeMoreSheet() {
        var s = document.getElementById("ljmhMoreSheet");
        if (!s || s.hidden) return;
        s.classList.remove("open");
        document.documentElement.style.overflow = "";
        setTimeout(function () { s.hidden = true; }, 220);
    }

    // #give deep link (from other pages' Give button)
    function handleGiveHash() {
        if (location.hash === "#give" && currentPage() === "home") {
            setTimeout(triggerGive, 900); // let razorpay-checkout wire up first
        }
    }

    function build() {
        buildHeader();
        buildBottomNav();
        handleGiveHash();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", build);
    } else {
        build();
    }
})();
