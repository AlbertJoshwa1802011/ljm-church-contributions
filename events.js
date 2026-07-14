/**
 * ============================================================================
 * events.js — "Events" gallery page
 * ============================================================================
 *
 * Fetches published events via /api/events and renders the gallery grid,
 * category filter chips, and a photo-carousel detail modal.
 * Matches the existing site's caching / fetch pattern (see impact.js).
 * ============================================================================
 */

(function () {
    "use strict";

    const API_URL = "/api/events";

    const CACHE_KEY = "eventsCache";
    const CACHE_TTL_MS = 60 * 1000; // 60s — matches other pages

    const els = {
        grid:            document.getElementById("eventsGrid"),
        empty:           document.getElementById("eventsEmpty"),
        filter:          document.getElementById("eventsFilter"),
        totalEvents:     document.getElementById("totalEvents"),
        photosShared:    document.getElementById("photosShared"),

        modal:           document.getElementById("eventModal"),
        modalClose:      document.getElementById("eventModalClose"),
        modalBack:       document.getElementById("eventModalBackdrop"),
        modalCategory:   document.getElementById("eventModalCategory"),
        modalTitle:      document.getElementById("eventModalTitle"),
        modalDate:       document.getElementById("eventModalDate"),
        modalLocation:   document.getElementById("eventModalLocation"),
        modalDesc:       document.getElementById("eventModalDesc"),
        modalExtra:      document.getElementById("eventModalExtra"),
        modalExtraList:  document.getElementById("eventModalExtraList"),

        carouselStage:   document.getElementById("eventCarouselStage"),
        carouselImg:     document.getElementById("eventCarouselImg"),
        carouselCount:   document.getElementById("eventCarouselCount"),
        carouselCaption: document.getElementById("eventCarouselCaption"),
        prev:            document.getElementById("eventPrev"),
        next:            document.getElementById("eventNext"),
        thumbs:          document.getElementById("eventThumbs")
    };

    let currentFilter  = "all";
    let allEvents       = [];
    let allCategories   = [];

    let carouselPhotos = [];   // [{id, photoUrl, caption, sortOrder}]
    let carouselIndex  = 0;
    let modalOpen      = false;
    let currentEvent   = null; // the event currently shown in the modal

    /* ---------- Utilities ---------- */

    function escapeHTML(s) {
        return String(s || "")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function formatDateShort(iso) {
        if (!iso) return "";
        const d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    }

    function categoryEmoji(name) {
        const n = (name || "").toLowerCase();
        if (n.includes("outreach")) return "🤝";
        if (n.includes("worship")) return "🙏";
        if (n.includes("youth")) return "🧑‍🤝‍🧑";
        if (n.includes("children") || n.includes("kids")) return "🧒";
        if (n.includes("christmas")) return "🎄";
        if (n.includes("retreat")) return "⛺";
        if (n.includes("fellowship")) return "🍽️";
        if (n.includes("mission")) return "🌍";
        if (n.includes("prayer")) return "🕊️";
        return "🎉";
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

    async function fetchEvents() {
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
            const res = await fetch(API_URL, { cache: "no-store" });
            const data = await res.json();
            writeCache(data);
            render(data);
        } catch (err) {
            console.warn("Failed to load events:", err);
            if (!allEvents.length) showEmpty("Couldn't load events. Please try again later.");
        }
    }

    /* ---------- Render ---------- */

    function render(data) {
        allEvents     = Array.isArray(data && data.events) ? data.events : [];
        allCategories = Array.isArray(data && data.categories) ? data.categories : [];

        if (els.totalEvents) els.totalEvents.textContent = allEvents.length;
        if (els.photosShared) {
            const totalPhotos = allEvents.reduce((sum, e) => sum + (Number(e.photoCount) || 0), 0);
            els.photosShared.textContent = totalPhotos;
        }

        buildFilters(allCategories);
        renderGrid();
    }

    function buildFilters(categories) {
        if (!els.filter) return;
        const chips = ['<button class="filter-chip' + (currentFilter === "all" ? " active" : "") + '" data-category="all">All</button>']
            .concat(categories.map(c => {
                const active = currentFilter.toLowerCase() === String(c).toLowerCase() ? " active" : "";
                return `<button class="filter-chip${active}" data-category="${escapeHTML(c)}">${escapeHTML(categoryEmoji(c))} ${escapeHTML(c)}</button>`;
            }));
        els.filter.innerHTML = chips.join("");
    }

    function renderGrid() {
        const filtered = currentFilter === "all"
            ? allEvents
            : allEvents.filter(e => (e.category || "").toLowerCase() === currentFilter.toLowerCase());

        if (!filtered.length) {
            els.grid.innerHTML = "";
            els.empty.style.display = "block";
            return;
        }
        els.empty.style.display = "none";

        els.grid.innerHTML = filtered.map(e => cardHTML(e)).join("");

        els.grid.querySelectorAll(".product-card").forEach(card => {
            card.addEventListener("click", () => {
                const id = card.getAttribute("data-id");
                if (id) openModal(id);
            });
        });
    }

    function cardHTML(ev) {
        const emoji = categoryEmoji(ev.category);
        const hasPhoto = !!(ev.coverPhoto && String(ev.coverPhoto).trim());
        const photoBlock = hasPhoto
            ? `<img class="product-photo" src="${escapeHTML(ev.coverPhoto)}" alt="${escapeHTML(ev.title)}"
                    onerror="this.outerHTML='<div class=&quot;product-photo placeholder&quot;>${escapeHTML(emoji)}</div>'">`
            : `<div class="product-photo placeholder">${escapeHTML(emoji)}</div>`;

        const photoCount = Number(ev.photoCount) || 0;
        const badge = photoCount > 0
            ? `<div class="event-badge">📷 ${photoCount}</div>`
            : "";

        const ribbon = ev.featured ? `<div class="featured-ribbon">⭐ Featured</div>` : "";

        return `
            <article class="product-card${ev.featured ? " featured" : ""}" data-id="${escapeHTML(ev.id)}">
                ${ribbon}
                <div class="product-photo-wrap">
                    ${photoBlock}
                    ${badge}
                </div>
                <div class="product-body">
                    <span class="product-fund-tag">${escapeHTML(emoji)} ${escapeHTML(ev.category || "Event")}</span>
                    <h3>${escapeHTML(ev.title)}</h3>
                    <div class="product-meta">
                        <span>📅 ${escapeHTML(formatDateShort(ev.eventDate))}${ev.location ? " · " + escapeHTML(ev.location) : ""}</span>
                    </div>
                    ${ev.description ? `<p class="product-desc">${escapeHTML(ev.description)}</p>` : ""}
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

    /* ---------- Filter tabs ---------- */

    function bindFilter() {
        els.filter.addEventListener("click", (e) => {
            const btn = e.target.closest(".filter-chip");
            if (!btn) return;
            els.filter.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
            btn.classList.add("active");
            currentFilter = btn.getAttribute("data-category");
            renderGrid();
        });
    }

    /* ---------- Modal ---------- */

    function placeholderEl(ev) {
        const ph = document.createElement("div");
        ph.className = "placeholder-big";
        ph.textContent = categoryEmoji(ev && ev.category);
        return ph;
    }

    async function openModal(id) {
        try {
            const res = await fetch(`${API_URL}?id=${encodeURIComponent(id)}&_t=${Date.now()}`, { cache: "no-store" });
            const data = await res.json();
            const ev = data && data.event;
            if (!ev) return;
            currentEvent = ev;

            const emoji = categoryEmoji(ev.category);
            els.modalCategory.textContent = `${emoji} ${ev.category || "Event"}`;
            els.modalTitle.textContent    = ev.title || "";
            els.modalDate.textContent     = ev.eventDate ? "📅 " + formatDateShort(ev.eventDate) : "";
            els.modalLocation.textContent = ev.location ? "📍 " + ev.location : "";
            els.modalDesc.textContent     = ev.description || "No description provided.";

            renderExtra(ev.extra);

            const photos = Array.isArray(data.photos) ? data.photos.slice() : [];
            photos.sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));

            carouselPhotos = photos.length
                ? photos
                : (ev.coverPhoto ? [{ id: "cover", photoUrl: ev.coverPhoto, caption: "" }] : []);
            carouselIndex = 0;

            renderCarousel(ev);
            renderThumbs();

            els.modal.classList.add("open");
            els.modal.setAttribute("aria-hidden", "false");
            document.body.style.overflow = "hidden";
            modalOpen = true;
        } catch (err) {
            console.warn("Failed to load event detail:", err);
        }
    }

    function renderExtra(extra) {
        const entries = extra && typeof extra === "object" ? Object.entries(extra).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "") : [];
        if (!entries.length) {
            els.modalExtra.style.display = "none";
            els.modalExtraList.innerHTML = "";
            return;
        }
        els.modalExtra.style.display = "block";
        els.modalExtraList.innerHTML = entries.map(([k, v]) => `
            <div class="event-extra-row">
                <span class="k">${escapeHTML(k)}</span>
                <span class="v">${escapeHTML(v)}</span>
            </div>
        `).join("");
    }

    function renderCarousel(ev) {
        const hasPhotos = carouselPhotos.length > 0;
        const showNav = carouselPhotos.length > 1;

        els.prev.hidden = !showNav;
        els.next.hidden = !showNav;

        els.carouselStage.innerHTML = "";

        const count = document.createElement("div");
        count.className = "carousel-count";
        count.id = "eventCarouselCount";

        if (!hasPhotos) {
            els.carouselStage.appendChild(placeholderEl(ev));
            els.carouselStage.appendChild(count);
            els.carouselCaption.textContent = "";
            return;
        }

        const photo = carouselPhotos[carouselIndex];
        const img = document.createElement("img");
        img.id = "eventCarouselImg";
        img.alt = (ev && ev.title) || "";
        img.src = photo.photoUrl || "";
        img.onerror = function () {
            const ph = placeholderEl(ev);
            if (img.parentNode) img.parentNode.replaceChild(ph, img);
        };
        els.carouselStage.appendChild(img);

        count.textContent = `${carouselIndex + 1} / ${carouselPhotos.length}`;
        els.carouselStage.appendChild(count);

        els.carouselCaption.textContent = photo.caption || "";
    }

    function renderThumbs() {
        if (carouselPhotos.length <= 1) {
            els.thumbs.innerHTML = "";
            els.thumbs.style.display = "none";
            return;
        }
        els.thumbs.style.display = "flex";
        els.thumbs.innerHTML = carouselPhotos.map((p, i) => `
            <div class="event-thumb${i === carouselIndex ? " active" : ""}" data-index="${i}">
                <img src="${escapeHTML(p.photoUrl || "")}" alt="" onerror="this.style.visibility='hidden'">
            </div>
        `).join("");

        els.thumbs.querySelectorAll(".event-thumb").forEach(t => {
            t.addEventListener("click", () => {
                const i = Number(t.getAttribute("data-index"));
                if (!isNaN(i)) goToSlide(i);
            });
        });
    }

    function goToSlide(index) {
        if (!carouselPhotos.length) return;
        carouselIndex = ((index % carouselPhotos.length) + carouselPhotos.length) % carouselPhotos.length;
        renderCarousel(currentEvent);
        els.thumbs.querySelectorAll(".event-thumb").forEach((t, i) => {
            t.classList.toggle("active", i === carouselIndex);
        });
    }

    function closeModal() {
        els.modal.classList.remove("open");
        els.modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        modalOpen = false;
        currentEvent = null;
    }

    /* ---------- Init ---------- */

    document.addEventListener("DOMContentLoaded", () => {
        bindFilter();
        els.modalClose.addEventListener("click", closeModal);
        els.modalBack.addEventListener("click", closeModal);
        els.prev.addEventListener("click", () => goToSlide(carouselIndex - 1));
        els.next.addEventListener("click", () => goToSlide(carouselIndex + 1));

        document.addEventListener("keydown", (e) => {
            if (!modalOpen) return;
            if (e.key === "Escape") closeModal();
            else if (e.key === "ArrowLeft") goToSlide(carouselIndex - 1);
            else if (e.key === "ArrowRight") goToSlide(carouselIndex + 1);
        });

        fetchEvents();
    });
})();
