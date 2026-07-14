/**
 * Unified Admin Session Manager
 * Provides persistent, secure admin bar across ALL pages.
 * - HMAC-signed session token (tamper-proof)
 * - 30-minute TTL with visible countdown + auto-logout
 * - Admin bar injected at top of every page when session is active
 */
(function () {
    "use strict";

    const ADMIN_EMAILS = [
        "albertjoshrock101@gmail.com",
        "thinkmuthu@gmail.com",
        "augustinraja261@gmail.com"
    ];

    const SESSION_KEY = "ljmAdminSession";
    const SESSION_TTL_MS = 30 * 60 * 1000;
    const HMAC_SECRET = "LJM-Ch8rch-2026-S3cure!";

    // ── Crypto helpers (HMAC-SHA256 signing) ──

    async function hmacSign(message) {
        try {
            const enc = new TextEncoder();
            const key = await crypto.subtle.importKey(
                "raw", enc.encode(HMAC_SECRET),
                { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
            );
            const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
            return Array.from(new Uint8Array(sig))
                .map(b => b.toString(16).padStart(2, "0")).join("");
        } catch (_) {
            let hash = 0;
            for (let i = 0; i < message.length; i++) {
                hash = ((hash << 5) - hash + message.charCodeAt(i)) | 0;
            }
            return "fallback-" + Math.abs(hash).toString(16);
        }
    }

    async function hmacVerify(message, signature) {
        const expected = await hmacSign(message);
        return expected === signature;
    }

    // ── Session CRUD ──

    async function createSession(email, name) {
        const payload = { email: email, name: name || "", ts: Date.now() };
        const raw = JSON.stringify(payload);
        const sig = await hmacSign(raw);
        const token = btoa(raw) + "." + sig;
        sessionStorage.setItem(SESSION_KEY, token);
        return payload;
    }

    async function readSession() {
        try {
            const token = sessionStorage.getItem(SESSION_KEY);
            if (!token) return null;

            const parts = token.split(".");
            if (parts.length < 2) { destroySession(); return null; }

            const raw = atob(parts[0]);
            const sig = parts.slice(1).join(".");
            const valid = await hmacVerify(raw, sig);
            if (!valid) { destroySession(); return null; }

            const payload = JSON.parse(raw);
            if (!payload.email || !ADMIN_EMAILS.includes(payload.email)) {
                destroySession();
                return null;
            }

            const age = Date.now() - payload.ts;
            if (age < 0 || age > SESSION_TTL_MS) {
                destroySession();
                return null;
            }

            return payload;
        } catch (_) {
            destroySession();
            return null;
        }
    }

    function destroySession() {
        sessionStorage.removeItem(SESSION_KEY);
    }

    async function refreshSession() {
        const s = await readSession();
        if (!s) return null;
        return createSession(s.email, s.name);
    }

    // ── Admin Bar UI ──

    function injectAdminBarCSS() {
        if (document.getElementById("ljm-admin-bar-css")) return;
        const style = document.createElement("style");
        style.id = "ljm-admin-bar-css";
        style.textContent = `
            #ljmAdminBar {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 99999;
                background: linear-gradient(135deg, #171429, #2b2350);
                color: #efeaff;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 16px;
                height: 42px;
                font-family: 'Outfit', 'Segoe UI', system-ui, sans-serif;
                font-size: 13px;
                box-shadow: 0 2px 12px rgba(20, 15, 8, 0.5);
                border-bottom: 1px solid rgba(80, 70, 229, 0.3);
            }
            #ljmAdminBar a {
                color: #c7c2e8;
                text-decoration: none;
                padding: 6px 12px;
                border-radius: 6px;
                font-weight: 500;
                font-size: 12px;
                transition: all 0.2s;
                white-space: nowrap;
            }
            #ljmAdminBar a:hover {
                background: rgba(80, 70, 229, 0.2);
                color: #fff;
            }
            #ljmAdminBar a.ab-active {
                background: rgba(80, 70, 229, 0.25);
                color: #A79FFF;
                font-weight: 600;
            }
            .ab-left {
                display: flex;
                align-items: center;
                gap: 4px;
                overflow-x: auto;
                scrollbar-width: none;
                -webkit-overflow-scrolling: touch;
            }
            .ab-left::-webkit-scrollbar { display: none; }
            .ab-brand {
                font-weight: 700;
                color: #A79FFF;
                font-size: 13px;
                margin-right: 8px;
                white-space: nowrap;
                flex-shrink: 0;
            }
            .ab-right {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-shrink: 0;
                margin-left: 10px;
            }
            .ab-timer {
                font-size: 11px;
                color: #94a3b8;
                white-space: nowrap;
                font-variant-numeric: tabular-nums;
            }
            .ab-timer.warning { color: #f59e0b; }
            .ab-timer.danger { color: #ef4444; font-weight: 600; }
            .ab-user {
                font-size: 11px;
                color: #b6b0d9;
                max-width: 140px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .ab-logout {
                background: rgba(239, 68, 68, 0.15) !important;
                color: #fca5a5 !important;
                border: 1px solid rgba(239, 68, 68, 0.2) !important;
                font-weight: 600 !important;
                padding: 5px 10px !important;
                font-size: 11px !important;
                cursor: pointer;
            }
            .ab-logout:hover {
                background: rgba(239, 68, 68, 0.3) !important;
                color: #fff !important;
            }
            body.ljm-admin-active {
                padding-top: 42px !important;
            }
            /* admin.html has its own top-nav that needs offset */
            body.ljm-admin-active .top-nav {
                top: 42px;
            }

            @media (max-width: 600px) {
                #ljmAdminBar {
                    height: 38px;
                    padding: 0 10px;
                    font-size: 11px;
                }
                #ljmAdminBar a {
                    font-size: 11px;
                    padding: 4px 8px;
                }
                .ab-brand { font-size: 11px; margin-right: 4px; }
                .ab-user { display: none; }
                body.ljm-admin-active {
                    padding-top: 38px !important;
                }
                body.ljm-admin-active .top-nav {
                    top: 38px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function getActivePage() {
        const path = window.location.pathname;
        // Cloudflare Pages serves clean URLs (redirects admin.html -> /admin),
        // so match on the file name with any ".html" stripped, not the raw
        // segment — otherwise every check below silently never matches once
        // a visitor lands on the extensionless URL (which Pages promotes).
        let file = path.split("/").pop() || "index";
        if (file.endsWith(".html")) file = file.slice(0, -5);
        if (file === "" || file === "index") return "home";
        if (file === "admin") return "dashboard";
        if (file === "members") return "members";
        if (file === "funds") return "funds";
        if (file === "impact") return "impact";
        if (file === "about") return "about";
        return "";
    }

    function buildAdminBar(session) {
        const active = getActivePage();
        const links = [
            { href: "admin.html", id: "dashboard", icon: "📊", label: "Dashboard" },
            { href: "index.html", id: "home", icon: "🏠", label: "Home" },
            { href: "members.html", id: "members", icon: "👥", label: "Members" },
            { href: "funds.html", id: "funds", icon: "💰", label: "Funds" },
            { href: "impact.html", id: "impact", icon: "🛍", label: "Purchases" },
            { href: "about.html", id: "about", icon: "ℹ️", label: "About" },
        ];

        const navLinks = links.map(l =>
            `<a href="${l.href}" class="${active === l.id ? 'ab-active' : ''}">${l.icon} ${l.label}</a>`
        ).join("");

        const displayName = session.name || session.email.split("@")[0];

        const bar = document.createElement("div");
        bar.id = "ljmAdminBar";
        bar.innerHTML = `
            <div class="ab-left">
                <span class="ab-brand">ADMIN</span>
                ${navLinks}
            </div>
            <div class="ab-right">
                <span class="ab-timer" id="abTimer"></span>
                <span class="ab-user" title="${session.email}">${displayName}</span>
                <a href="#" class="ab-logout" id="abLogoutBtn">Logout</a>
            </div>
        `;
        return bar;
    }

    let countdownInterval = null;

    function startCountdown(session) {
        const timerEl = document.getElementById("abTimer");
        if (!timerEl) return;

        function tick() {
            const remaining = SESSION_TTL_MS - (Date.now() - session.ts);
            if (remaining <= 0) {
                clearInterval(countdownInterval);
                destroySession();
                document.getElementById("ljmAdminBar")?.remove();
                document.body.classList.remove("ljm-admin-active");
                window.dispatchEvent(new CustomEvent("ljmAdminLogout"));
                return;
            }
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            timerEl.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;

            timerEl.classList.remove("warning", "danger");
            if (remaining < 2 * 60 * 1000) timerEl.classList.add("danger");
            else if (remaining < 5 * 60 * 1000) timerEl.classList.add("warning");
        }

        tick();
        countdownInterval = setInterval(tick, 1000);
    }

    async function showAdminBar() {
        const session = await readSession();
        if (!session) return false;

        // admin.html has its own complete navigation (grouped sidebar on
        // desktop, group buttons + sheet on mobile) — this floating quick-nav
        // bar exists so an admin browsing the *public* site can jump back to
        // admin pages; showing it on top of the admin console itself was a
        // second, redundant navigation layer.
        if (getActivePage() === "dashboard") return true;

        injectAdminBarCSS();

        const existing = document.getElementById("ljmAdminBar");
        if (existing) existing.remove();

        const bar = buildAdminBar(session);
        document.body.prepend(bar);
        document.body.classList.add("ljm-admin-active");

        document.getElementById("abLogoutBtn").addEventListener("click", async (e) => {
            e.preventDefault();
            if (countdownInterval) clearInterval(countdownInterval);
            destroySession();
            bar.remove();
            document.body.classList.remove("ljm-admin-active");
            window.dispatchEvent(new CustomEvent("ljmAdminLogout"));
        });

        startCountdown(session);
        return true;
    }

    // ── Public API ──

    window.LJMAdmin = {
        ADMIN_EMAILS: ADMIN_EMAILS,
        createSession: createSession,
        readSession: readSession,
        destroySession: destroySession,
        refreshSession: refreshSession,
        showAdminBar: showAdminBar,
        isAdmin: function (email) {
            return ADMIN_EMAILS.includes(email);
        }
    };

    // ── Auto-init: show bar on every page if session exists ──
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", showAdminBar);
    } else {
        showAdminBar();
    }
})();
