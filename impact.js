/**
 * ============================================================================
 * impact.js — "What We Bought" page
 * ============================================================================
 *
 * Fetches the Purchases sheet via Apps Script and renders the product gallery.
 * Matches the existing site's caching / fetch pattern (see script.js).
 * ============================================================================
 */

(function () {
    "use strict";

    const API_URL =
        "/api/contributions?fund=purchases";

    const CACHE_KEY = "impactPurchasesCache";
    const CACHE_TTL_MS = 60 * 1000; // 60s — matches other pages

    const els = {
        grid:        document.getElementById("impactGrid"),
        empty:       document.getElementById("impactEmpty"),
        filter:      document.getElementById("impactFilter"),
        totalItems:  document.getElementById("totalItems"),
        totalSpent:  document.getElementById("totalSpent"),
        fundsActive: document.getElementById("fundsActive"),
        modal:       document.getElementById("impactModal"),
        modalImg:    document.getElementById("impactModalImage"),
        modalTitle:  document.getElementById("impactModalTitle"),
        modalCost:   document.getElementById("impactModalCost"),
        modalDate:   document.getElementById("impactModalDate"),
        modalId:     document.getElementById("impactModalId"),
        modalDesc:   document.getElementById("impactModalDesc"),
        modalFund:   document.getElementById("impactModalFund"),
        modalVendor: document.getElementById("impactModalVendor"),
        modalClose:  document.getElementById("impactModalClose"),
        modalBack:   document.getElementById("impactModalBackdrop")
    };

    let currentFilter = "all";
    let allPurchases  = [];

    /* ---------- Utilities ---------- */

    function formatINR(n) {
        const num = Number(n) || 0;
        return "₹" + num.toLocaleString("en-IN");
    }

    function formatDateShort(iso) {
        if (!iso) return "";
        const d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    }

    function escapeHTML(s) {
        return String(s || "")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function fundEmoji(name) {
        const n = (name || "").toLowerCase();
        if (n.includes("tech")) return "💻";
        if (n.includes("christmas")) return "🎄";
        return "⛪";
    }

    /* ---------- Cache ---------- */

    function readCache() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const { ts, data } = JSON.parse(raw);
            if (Date.now() - ts > CACHE_TTL_MS) return null;
            return data;
        } catch (_) { return null; }
    }

    function writeCache(data) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
        } catch (_) { /* quota exceeded — ignore */ }
    }

    /* ---------- Fetch ---------- */

    async function fetchPurchases() {
        // --- LOCAL PREVIEW PATH ---
        if (window.__LJM_USE_MOCK_PURCHASES__ && window.__LJM_PURCHASES_MOCK__) {
            render(window.__LJM_PURCHASES_MOCK__);
            return;
        }

        const cached = readCache();
        if (cached) {
            render(cached);
            // Still fetch fresh in background
            refresh();
            return;
        }
        await refresh();
    }

    async function refresh() {
        try {
            const res  = await fetch(API_URL, { cache: "no-store" });
            const data = await res.json();
            writeCache(data);
            render(data);
        } catch (err) {
            console.error("Failed to load purchases:", err);
            if (!allPurchases.length) showEmpty("Couldn't load purchases. Please try again later.");
        }
    }

    /* ---------- Render ---------- */

    function render(data) {
        allPurchases = Array.isArray(data && data.purchases) ? data.purchases : [];

        // Top-line totals
        els.totalItems.textContent  = allPurchases.length;
        els.totalSpent.textContent  = formatINR(data && data.totalSpent);
        els.fundsActive.textContent = Object.keys((data && data.totalSpentByFund) || {}).length || 0;

        renderGrid();
    }

    function renderGrid() {
        const filtered = currentFilter === "all"
            ? allPurchases
            : allPurchases.filter(p => (p.fund || "").toLowerCase() === currentFilter.toLowerCase());

        if (!filtered.length) {
            els.grid.innerHTML = "";
            els.empty.style.display = "block";
            return;
        }
        els.empty.style.display = "none";

        els.grid.innerHTML = filtered.map(p => cardHTML(p)).join("");

        // Wire clicks
        els.grid.querySelectorAll(".product-card").forEach(card => {
            card.addEventListener("click", (e) => {
                // Don't open modal when clicking the vendor link
                if (e.target.closest(".product-vendor-btn")) return;
                const id = card.getAttribute("data-id");
                const item = allPurchases.find(x => x.id === id);
                if (item) openModal(item);
            });
        });
    }

    function cardHTML(p) {
        const hasPhoto = !!(p.photo && p.photo.trim());
        const photoBlock = hasPhoto
            ? `<img class="product-photo" src="${escapeHTML(p.photo)}" alt="${escapeHTML(p.name)}"
                    onerror="this.outerHTML='<div class=&quot;product-photo placeholder&quot;>${escapeHTML(fundEmoji(p.fund))}</div>'">`
            : `<div class="product-photo placeholder">${escapeHTML(fundEmoji(p.fund))}</div>`;

        const vendorBtn = p.vendor
            ? `<a href="${escapeHTML(p.vendor)}" class="product-vendor-btn" target="_blank" rel="noopener">🛒 View on Vendor Site</a>`
            : "";

        // Funding breakdown: show when there's an external contribution
        const fundContrib = Number(p.fundContribution);
        const extContrib  = Number(p.externalContribution);
        const hasBreakdown =
            (!isNaN(fundContrib) && fundContrib > 0 && !isNaN(extContrib) && extContrib > 0);

        const breakdownBlock = hasBreakdown ? `
            <div class="funding-breakdown">
                <div class="fb-row">
                    <span class="fb-dot" style="background:var(--info, #3f7a94);"></span>
                    <span class="fb-label">${escapeHTML(fundEmoji(p.fund))} ${escapeHTML(p.fund || "Fund")}</span>
                    <span class="fb-amount">${formatINR(fundContrib)}</span>
                </div>
                <div class="fb-row">
                    <span class="fb-dot" style="background:#ec9a3e;"></span>
                    <span class="fb-label">🤝 External Donor</span>
                    <span class="fb-amount">${formatINR(extContrib)}</span>
                </div>
            </div>
        ` : "";

        return `
            <article class="product-card" data-id="${escapeHTML(p.id)}">
                ${photoBlock}
                <div class="product-body">
                    <span class="product-fund-tag">${escapeHTML(fundEmoji(p.fund))} ${escapeHTML(p.fund || "Fund")}</span>
                    <h3>${escapeHTML(p.name)}</h3>
                    <div class="product-cost">${formatINR(p.cost)}</div>
                    <div class="product-meta">
                        <span>📅 ${escapeHTML(formatDateShort(p.date))}</span>
                        <span style="color:#aaa;">${escapeHTML(p.id || "")}</span>
                    </div>
                    ${breakdownBlock}
                    ${p.description ? `<p class="product-desc">${escapeHTML(p.description)}</p>` : ""}
                    ${vendorBtn}
                </div>
            </article>
        `;
    }

    function showEmpty(msg) {
        els.grid.innerHTML = "";
        els.empty.style.display = "block";
        if (msg) {
            const h3 = els.empty.querySelector("h3");
            const p  = els.empty.querySelector("p");
            if (h3) h3.textContent = "Something went wrong";
            if (p)  p.textContent  = msg;
        }
    }

    /* ---------- Modal ---------- */

    function openModal(p) {
        const placeholderSvg =
            "data:image/svg+xml;utf8," +
            encodeURIComponent(
                `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='260'>
                   <rect width='600' height='260' fill='#ECEBFB'/>
                   <text x='50%' y='50%' text-anchor='middle' dy='.3em' font-size='72'>${fundEmoji(p.fund)}</text>
                 </svg>`
            );

        els.modalImg.src    = p.photo && p.photo.trim() ? p.photo : placeholderSvg;
        els.modalImg.onerror = () => { els.modalImg.src = placeholderSvg; };
        els.modalTitle.textContent = p.name || "";
        els.modalCost.textContent  = formatINR(p.cost);
        els.modalDate.textContent  = "📅 " + formatDateShort(p.date);
        els.modalId.textContent    = p.id || "";
        els.modalDesc.textContent  = p.description || "No description provided.";
        els.modalFund.textContent  = `${fundEmoji(p.fund)} ${p.fund || "Fund"}`;

        // Funding breakdown in the modal
        const modalBreakdown = document.getElementById("impactModalBreakdown");
        if (modalBreakdown) {
            const fundContrib = Number(p.fundContribution);
            const extContrib  = Number(p.externalContribution);
            const hasBreakdown =
                (!isNaN(fundContrib) && fundContrib > 0 && !isNaN(extContrib) && extContrib > 0);

            if (hasBreakdown) {
                const fundPct = Math.round((fundContrib / (fundContrib + extContrib)) * 100);
                const extPct  = 100 - fundPct;
                modalBreakdown.innerHTML = `
                    <div class="modal-fb-title">💰 Funded by</div>
                    <div class="modal-fb-bar">
                        <div class="modal-fb-seg fund" style="width:${fundPct}%;">${fundPct}%</div>
                        <div class="modal-fb-seg ext"  style="width:${extPct}%;">${extPct}%</div>
                    </div>
                    <div class="modal-fb-rows">
                        <div class="modal-fb-row">
                            <span><span class="fb-dot" style="background:var(--info, #3f7a94);"></span> ${escapeHTML(p.fund || "Fund")}</span>
                            <strong>${formatINR(fundContrib)}</strong>
                        </div>
                        <div class="modal-fb-row">
                            <span><span class="fb-dot" style="background:#ec9a3e;"></span> External Donors</span>
                            <strong>${formatINR(extContrib)}</strong>
                        </div>
                        ${p.externalSources ? `<div class="modal-fb-note">🤝 ${escapeHTML(p.externalSources)}</div>` : ""}
                    </div>
                `;
                modalBreakdown.style.display = "block";
            } else {
                modalBreakdown.style.display = "none";
            }
        }

        if (p.vendor) {
            els.modalVendor.href = p.vendor;
            els.modalVendor.style.display = "inline-flex";
        } else {
            els.modalVendor.style.display = "none";
        }

        els.modal.classList.add("open");
        els.modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        els.modal.classList.remove("open");
        els.modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    /* ---------- Filter tabs ---------- */

    function bindFilter() {
        els.filter.addEventListener("click", (e) => {
            const btn = e.target.closest(".filter-chip");
            if (!btn) return;
            els.filter.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
            btn.classList.add("active");
            currentFilter = btn.getAttribute("data-fund");
            renderGrid();
        });
    }

    /* ---------- Init ---------- */

    document.addEventListener("DOMContentLoaded", () => {
        bindFilter();
        els.modalClose.addEventListener("click", closeModal);
        els.modalBack.addEventListener("click", closeModal);
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") closeModal();
        });
        fetchPurchases();
    });
})();
