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

function getCachedFund(key) {
    const cached = localStorage.getItem(key);
    if (!cached) {
        console.log(`[MEMBER CACHE] No cache found for key: ${key}`);
        return null;
    }
    try {
        const parsed = JSON.parse(cached);
        // Always return cached data if it exists (no TTL check - same as main dashboard)
        if (parsed.data) {
            console.log(`[MEMBER CACHE] Cache found and valid for key: ${key}, using cached data (NO API CALL)`);
            return parsed.data;
        }
        console.log(`[MEMBER CACHE] Cache exists but no data field for key: ${key}`);
        return null;
    } catch (e) {
        console.error(`[MEMBER CACHE] Error parsing cache for key ${key}:`, e);
        return null;
    }
}

function setCachedFund(key, data) {
    localStorage.setItem(key, JSON.stringify({ data, lastFetched: Date.now() }));
}

async function fetchFundData(url, cacheKey) {
    // Check cache first - use it if available (NO API CALL if cache exists)
    const cached = getCachedFund(cacheKey);
    if (cached) {
        console.log(`[MEMBER] Using cached data for ${cacheKey} (NO API CALL - instant load)`);
        return cached;
    }
    
    // No cache - fetch from API ONLY ONCE
    console.log(`[MEMBER] No cache found for ${cacheKey}, fetching from API (FIRST TIME ONLY)`);
    try {
        const res = await fetch(url, { credentials: "omit" });
        const data = await res.json();
        setCachedFund(cacheKey, data);
        console.log(`[MEMBER] Data cached for ${cacheKey} - future loads will use cache (NO API CALLS)`);
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
