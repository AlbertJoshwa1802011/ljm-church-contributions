document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const memberName = params.get("name");

    if (!memberName) {
        document.getElementById("memberHeading").innerText =
            "Please select a member";
        return;
    }

    document.getElementById("memberHeading").innerText =
        `🙏 ${memberName}'s Contributions`;

    fetchMemberData(memberName);
});

const API_URL_TECH = "https://script.google.com/macros/s/AKfycbyn7BAXvOI-GRNI3DfFBXc6tBAgcuwlKu2PWgJ-JKi-ShZEP-eOnzmvxC01AjGsevQd/exec?fund=tech-contributions";
const API_URL_CHRISTMAS = "https://script.google.com/macros/s/AKfycbyn7BAXvOI-GRNI3DfFBXc6tBAgcuwlKu2PWgJ-JKi-ShZEP-eOnzmvxC01AjGsevQd/exec?fund=christmas-fund";

// Cache keys - use SAME keys as main dashboard for cache sharing
const CACHE_KEY_TECH = "techFundData";
const CACHE_KEY_CHRISTMAS = "christmasFundData";

// Cache configuration (must match script.js)
const CACHE_VERSION = 1;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedFund(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed.version !== CACHE_VERSION) {
            localStorage.removeItem(key);
            return null;
        }
        const age = Date.now() - (parsed.lastFetched || 0);
        // Expire if too old or negative (clock skew / invalid timestamp)
        if (age < 0 || age > CACHE_TTL_MS) {
            console.log(`[MEMBER CACHE] Expired: ${key} (age: ${Math.round(age / 1000)}s)`);
            localStorage.removeItem(key);
            return null;
        }
        if (parsed.data) {
            console.log(`[MEMBER CACHE] Hit: ${key} (age: ${Math.round(age / 1000)}s)`);
            return parsed.data;
        }
        return null;
    } catch (e) {
        console.error(`[MEMBER CACHE] Error for ${key}:`, e);
        try { localStorage.removeItem(key); } catch (_) {}
        return null;
    }
}

function setCachedFund(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({ data, lastFetched: Date.now(), version: CACHE_VERSION }));
    } catch (err) {
        console.error(`[MEMBER CACHE] Save error for ${key}:`, err);
    }
}

async function fetchFundData(url, cacheKey) {
    // Check cache first (valid for 5 minutes)
    const cached = getCachedFund(cacheKey);
    if (cached) {
        console.log(`[MEMBER] Cache hit for ${cacheKey}`);
        return cached;
    }
    
    // No valid cache - fetch fresh data from API
    console.log(`[MEMBER] Cache miss/expired for ${cacheKey}, fetching from API`);
    try {
        const res = await fetch(url + '&_t=' + Date.now(), { credentials: "omit", cache: "no-store" });
        const data = await res.json();
        setCachedFund(cacheKey, data);
        return data;
    } catch (err) {
        console.error("Error fetching fund data:", err);
        return { contributions: [], goalAmount: 0 };
    }
}

async function fetchMemberData(memberName) {
    // Fetch both funds in parallel with caching
    const [techData, christmasData] = await Promise.all([
        fetchFundData(API_URL_TECH, CACHE_KEY_TECH),
        fetchFundData(API_URL_CHRISTMAS, CACHE_KEY_CHRISTMAS)
    ]);
    
    // Combine contributions from both funds
    const allContributions = [
        ...(techData.contributions || []),
        ...(christmasData.contributions || [])
    ];
    
    // Filter for this member
    const memberData = allContributions.filter(
        c => (c.Member || "").toLowerCase() === memberName.toLowerCase()
    );

    renderMemberDashboard(memberName, memberData);
}

function renderMemberDashboard(name, data) {
    let total = 0;
    const fundMap = {};

    data.forEach(c => {
        const amount = Number(c.Amount) || 0;
        total += amount;

        const fund = c.Category || "Other";
        fundMap[fund] = (fundMap[fund] || 0) + amount;
    });

    // Summary
    document.getElementById("totalGiven").innerText = "₹" + total.toLocaleString('en-IN');
    document.getElementById("totalEntries").innerText = data.length;
    document.getElementById("fundCount").innerText =
        Object.keys(fundMap).length;

    // Fund-wise summary
    const fundSummary = document.getElementById("fundSummary");
    fundSummary.innerHTML = "";

    Object.entries(fundMap).forEach(([fund, amt]) => {
        const row = document.createElement("div");
        row.className = "fund-row";
        row.innerHTML = `
            <span>${fund}</span>
            <strong>₹${amt.toLocaleString('en-IN')}</strong>
        `;
        fundSummary.appendChild(row);
    });

    // Timeline
    const timeline = document.getElementById("memberTimeline");
    if (!timeline) return;
    
    timeline.innerHTML = "";

    if (data.length === 0) {
        // Hide timeline section if no contributions
        timeline.style.display = "none";
        return;
    }

    // Show timeline section
    timeline.style.display = "block";

    data
        .sort((a, b) => new Date(b.Date) - new Date(a.Date))
        .forEach(c => {
            const card = document.createElement("div");
            card.className = "timeline-card";
            card.innerHTML = `
                <div class="date">${new Date(c.Date).toLocaleDateString()}</div>
                <div class="amount">₹${c.Amount}</div>
                <div class="category">${c.Category}</div>
                <div class="notes">${c.Notes || ""}</div>
            `;
            timeline.appendChild(card);
        });
}
