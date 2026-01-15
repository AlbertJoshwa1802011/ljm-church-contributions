// fundData.js

// Global object to hold data
window.FUND_CACHE = {
    data: null,         // Will hold the merged contributions
    lastFetched: 0,     // Timestamp of last fetch
    ttl: 6000,          // 6 seconds TTL for refresh
};

// Fund APIs
const FUND_URLS = [
    "https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec", // Tech
    "https://script.google.com/macros/s/AKfycbz6Bk6yurNmTf3FcQ4ykvja7P1VWOMVTP4wDMTUa9wCHXAPNViB-UmhpdFKpiCzg_KA/exec"  // Christmas
];

// Fetch and merge contributions
async function fetchFundData(force = false) {
    const now = Date.now();

    // If cached and not expired, return cache
    if (!force && window.FUND_CACHE.data && (now - window.FUND_CACHE.lastFetched < window.FUND_CACHE.ttl)) {
        return window.FUND_CACHE.data;
    }

    try {
        const results = await Promise.all(FUND_URLS.map(url => fetch(url).then(r => r.json())));
        
        // Merge contributions and store goal amounts
        const mergedData = {
            contributions: [],
            goals: {}  // separate goals for each fund
        };

        results.forEach((data, idx) => {
            if (data.contributions) {
                mergedData.contributions.push(...data.contributions);
            }

            // Determine fund goal
            if (idx === 0) mergedData.goals.tech = Number(data.goalAmount || 0);
            if (idx === 1) mergedData.goals.christmas = Number(data.goalAmount || 0);
        });

        // Update cache
        window.FUND_CACHE.data = mergedData;
        window.FUND_CACHE.lastFetched = now;

        return mergedData;
    } catch (err) {
        console.error("Error fetching fund data:", err);
        return { contributions: [], goals: {} };
    }
}

window.FUND_CACHE = { data: null, lastFetched: 0, ttl: 60000 }; // 60 seconds
setInterval(() => fetchFundData(true), window.FUND_CACHE.ttl);

