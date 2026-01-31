document.addEventListener("DOMContentLoaded", async () => {
    // --------------------
    // Create loader IMMEDIATELY - before anything else
    const loader = document.createElement("div");
    loader.id = "startupLoader";
    loader.innerHTML = `
        <div class="loader-symbol">
            <span>LJM</span>
            <div class="halo"></div>
        </div>
        <div class="loader-text">Preparing your dashboard…</div>
    `;
    Object.assign(loader.style, {
        position: "fixed",
        top: "0", 
        left: "0", 
        width: "100%", 
        height: "100%",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", 
        display: "flex", 
        flexDirection: "column",
        justifyContent: "center", 
        alignItems: "center", 
        zIndex: "999999",
        opacity: "1", 
        transition: "opacity 0.5s ease",
        pointerEvents: "none"
    });
    
    // Add loader to body immediately - use multiple methods to ensure it's added
    if (document.body) {
    document.body.appendChild(loader);
    } else {
        // If body not ready, prepend to html
        if (document.documentElement) {
            document.documentElement.appendChild(loader);
        }
    }

    // Add dynamic CSS for animations (purple theme)
    const style = document.createElement("style");
    style.innerHTML = `
        #startupLoader { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; z-index: 999999 !important; }
        .loader-symbol { position: relative; width:100px; height:100px; display:flex; justify-content:center; align-items:center; font-size:32px; font-weight:bold; color:#667eea; animation:pulse 1.5s infinite alternate; z-index:1; }
        .loader-symbol .halo { position:absolute; width:120px; height:120px; border:4px solid #667eea; border-radius:50%; animation:rotateHalo 2s linear infinite; box-shadow: 0 0 20px rgba(102, 126, 234, 0.5); z-index:0; }
        .loader-text { margin-top:80px; color:#fff; font-size:18px; font-weight:500; text-align:center; z-index:2; position:relative; white-space:nowrap; }
        @keyframes rotateHalo { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0% { transform: scale(1); text-shadow:0 0 10px rgba(102, 126, 234, 0.8); } 100% { transform: scale(1.2); text-shadow:0 0 20px rgba(102, 126, 234, 1); } }
    `;
    document.head.appendChild(style);
    
    // Force loader to be visible
    console.log("Loader created and added to DOM");

    // --------------------
    // NO PRE-FETCH - Let dashboard functions handle cache checking
    // Cache will be checked inside initDashboard() and initChristmasFundDashboard()
    // This prevents unnecessary API calls when cache already exists

    // --------------------
    // Continue existing dashboard logic
    const params = new URLSearchParams(window.location.search);
    let selectedFund = params.get("fund") || "tech";
    selectedFund = selectedFund.toLowerCase().replace(/\s+/g, '');

    console.log("Initializing dashboard for fund:", selectedFund);
    
    // Initialize dashboard (this will fetch data and render)
    // IMPORTANT: This MUST complete before removing loader
    try {
    if(selectedFund === "christmasfund") {
            console.log("Loading Christmas Fund...");
            await initChristmasFundDashboard(); // Wait for dashboard to initialize AND data to load
    } else {
            console.log("Loading Tech Fund...");
            await initDashboard(); // Wait for dashboard to initialize AND data to load
    }

    // Heading
    const heading = document.getElementById("fundHeading");
    if (heading) {
        if (selectedFund.includes("christmas")) heading.textContent = `🎄 Christmas Fund Contributions`;
        else heading.textContent = `💻 Tech Fund Contributions`;
    }
        
        console.log("Dashboard initialized, data loaded");
    } catch (err) {
        console.error("Error initializing dashboard:", err);
    }
    
    // --------------------
    // Wait minimum 1.5 seconds for UX (ensures loader is visible)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Remove loader after everything is loaded
    console.log("Removing loader...");
    if (loader && loader.parentNode) {
        loader.style.opacity = "0";
        setTimeout(() => {
            if (loader && loader.parentNode) {
                loader.remove();
                console.log("Loader removed");
            }
        }, 500);
    }
    
    // Fallback: Force remove loader after 15 seconds if still present (safety net)
    setTimeout(() => {
        if (loader && loader.parentNode) {
            console.log("Force removing loader (timeout)");
            loader.style.opacity = "0";
            setTimeout(() => {
                if (loader && loader.parentNode) {
                    loader.remove();
                }
            }, 300);
        }
    }, 15000);
});


// Helper: Fetch & cache fund (for startup preloader)
async function fetchAndCacheFund(fundKey, apiUrl) {
    try {
        const res = await fetch(apiUrl, { credentials: 'omit' });
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        if (data && (data.contributions !== undefined || data.goalAmount !== undefined)) {
        setCachedFund(fundKey, { contributions: data.contributions || [], goalAmount: data.goalAmount || 0 });
        }
    } catch (err) {
        console.error(`Error fetching ${fundKey}:`, err);
        // Don't throw - allow page to load with cached data if available
    }
}

// --------------------
// Helper: get cached fund
// Helper: get cached fund (use cache if exists, regardless of TTL - only refresh on hard reload)
function getCachedFund(fundKey, ttl = 60000) {
    const cache = localStorage.getItem(fundKey);
    if (!cache) {
        console.log(`[CACHE] No cache found for key: ${fundKey}`);
        return null;
    }

    try {
        const parsed = JSON.parse(cache);
        // Always return cached data if it exists (no TTL check - cache persists until hard refresh)
        // TTL parameter kept for compatibility but not enforced
        if (parsed.data) {
            console.log(`[CACHE] Cache found and valid for key: ${fundKey}, using cached data (NO API CALL)`);
            return parsed.data;
        }
        console.log(`[CACHE] Cache exists but no data field for key: ${fundKey}`);
        return null;
    } catch (err) {
        console.error(`[CACHE] Error parsing cache for key ${fundKey}:`, err);
        return null;
    }
}

// Helper: set fund cache
function setCachedFund(fundKey, data) {
    localStorage.setItem(fundKey, JSON.stringify({ data, lastFetched: Date.now() }));
}

// --------------------
// Tech Fund
async function initDashboard() {
    const API_URL = "https://script.google.com/macros/s/AKfycbyn7BAXvOI-GRNI3DfFBXc6tBAgcuwlKu2PWgJ-JKi-ShZEP-eOnzmvxC01AjGsevQd/exec?fund=tech-contributions";
    const FUND_KEY = "techFundData";
    const TTL = 60000; // 60s

    let contributionsData = [];
    let goalAmount = 0;
    const SHOW_COUNT = 15; // Items per page for contributors
    let currentDisplayCount = 0; // Start at page 0

    const heading = document.getElementById("fundHeading");
    if (heading) heading.textContent = "💻 Tech Fund Contributions";
    
    const subtitle = document.getElementById("fundSubtitle");
    if (subtitle) subtitle.textContent = "Let your contributions bring glory to Jesus";
    
    // Show motivational banner for Tech Fund
    const banner = document.getElementById("motivationalBanner");
    if (banner) banner.style.display = "block";

    const fetchData = async () => {
        console.log("Tech Fund: fetchData() called");
        
        // Check cache first - use it if available (NO API CALL if cache exists)
        const cached = getCachedFund(FUND_KEY, TTL);
        if (cached) {
            console.log("Tech Fund: Using cached data (NO API CALL - instant load)");
            contributionsData = cached.contributions || [];
            goalAmount = cached.goalAmount || 0;
            currentDisplayCount = 0;
            renderDashboard();
            renderTopContributors(contributionsData);
            return; // NO background fetch - use cache only
        }

        // No cache - fetch from API ONLY ONCE
        console.log("Tech Fund: No cache found, fetching from API (FIRST TIME ONLY):", API_URL);
        try {
            const res = await fetch(API_URL, { credentials: 'omit' });
            console.log("Tech Fund: API response status:", res.status);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            console.log("Tech Fund: Data received, contributions:", (data.contributions && data.contributions.length) || 0);
            contributionsData = data.contributions || [];
            goalAmount = data.goalAmount || 0;

            // Save to cache (will be used for all subsequent loads)
            setCachedFund(FUND_KEY, { contributions: contributionsData, goalAmount });
            console.log("Tech Fund: Data cached - future loads will use cache (NO API CALLS)");

            currentDisplayCount = 0;
            renderDashboard();
            renderTopContributors(contributionsData);
            console.log("Tech Fund: Dashboard rendered");
        } catch (err) {
            console.error("Error fetching Tech Fund data:", err);
        }
    };

    const renderDashboard = (filteredData = null) => {
        try {
        const data = filteredData || contributionsData;
        const timeline = document.getElementById("timelineContainer");
            if (!timeline) {
                console.warn("Timeline container not found");
                return;
            }
        timeline.innerHTML = "";

            // Get all contributors with their total contributions
            const contributors = getTopContributors(data, 1000); // Get all contributors
        
        if (contributors.length === 0) {
            timeline.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">💫</div>
                    <h3>No contributions yet</h3>
                    <p>Be the first to contribute to our Tech Fund!</p>
                </div>
            `;
        } else {
            // Pagination setup - show 15 per page (same as Christmas Fund)
            const itemsPerPage = 15;
            // Initialize to first page if needed
            if (currentDisplayCount === 0) {
                currentDisplayCount = itemsPerPage;
            }
            const totalPages = Math.ceil(contributors.length / itemsPerPage);
            // Calculate which page we're on based on how many items we're showing
            const currentPage = Math.floor((currentDisplayCount - 1) / itemsPerPage);
            const startIdx = currentPage * itemsPerPage;
            const endIdx = Math.min(startIdx + itemsPerPage, contributors.length);
            const displayContributors = contributors.slice(startIdx, endIdx);
            
            // Add section title ABOVE the grid (only if there are 16 or more contributors)
            if (contributors.length >= 16) {
                const sectionTitle = document.createElement("h3");
                sectionTitle.className = "section-title contributors-title";
                sectionTitle.textContent = `👥 All Contributors (${contributors.length} total)`;
                timeline.appendChild(sectionTitle);
            }

            // Create contributors grid
            const grid = document.createElement("div");
            grid.className = "contributors-grid";
            
            displayContributors.forEach((contributor, index) => {
            const card = document.createElement("div");
                card.className = "contributor-card";
                const rank = startIdx + index + 1;
                
                // Medal for top 3
                let medal = "";
                if (rank === 1) medal = "🥇";
                else if (rank === 2) medal = "🥈";
                else if (rank === 3) medal = "🥉";
                else if (rank <= 10) medal = "⭐";

            card.innerHTML = `
                    <div class="contributor-rank">${medal} #${rank}</div>
                    <div class="contributor-avatar">${contributor.Member.charAt(0).toUpperCase()}</div>
                    <div class="contributor-name">${contributor.Member}</div>
                    <div class="contributor-amount">₹${contributor.Total.toLocaleString('en-IN')}</div>
                    <div class="contributor-count">${contributor.Entries} contribution${contributor.Entries !== 1 ? 's' : ''}</div>
                `;
                grid.appendChild(card);
            });
            
            timeline.appendChild(grid);

            // Pagination buttons container (only if there are 16 or more contributors)
            if (contributors.length >= 16) {
                const paginationContainer = document.createElement("div");
                paginationContainer.className = "pagination-container";
                
                // Previous button (show if not on first page)
                if (currentPage > 0) {
                    const prevBtn = document.createElement("button");
                    prevBtn.className = "pagination-nav-btn";
                    prevBtn.textContent = "← Previous";
                    prevBtn.onclick = () => {
                        currentDisplayCount = Math.max(itemsPerPage, currentDisplayCount - itemsPerPage);
                        renderDashboard(filteredData);
                    };
                    paginationContainer.appendChild(prevBtn);
                }
                
                // Show More button (show if there are more contributors to display)
                // Only show if count >= 16 and not all items are displayed
                if (endIdx < contributors.length) {
                    const showMoreBtn = document.createElement("button");
                    showMoreBtn.className = "pagination-nav-btn";
                    const remaining = contributors.length - endIdx;
                    showMoreBtn.textContent = `Show More (${remaining} remaining)`;
                    showMoreBtn.onclick = () => {
                        currentDisplayCount = Math.min(contributors.length, currentDisplayCount + itemsPerPage);
                        renderDashboard(filteredData);
                    };
                    paginationContainer.appendChild(showMoreBtn);
                }
                
                // Only append if there are buttons to show
                if (paginationContainer.children.length > 0) {
                    timeline.appendChild(paginationContainer);
                }
            }
        }

        // Stats
        const totalCollected = data.reduce((sum, c) => sum + (Number(c.Amount)||0), 0);
        const remaining = Math.max(goalAmount - totalCollected, 0);
        const progressPercent = goalAmount > 0 ? Math.min((totalCollected / goalAmount) * 100, 100) : 0;
        
        document.getElementById("goalAmount").innerHTML = "🎯 ₹" + goalAmount.toLocaleString('en-IN');
        document.getElementById("totalAmount").innerHTML = "💰 ₹" + totalCollected.toLocaleString('en-IN');
        document.getElementById("remainingAmount").innerHTML = remaining > 0 ? "⏳ ₹" + remaining.toLocaleString('en-IN') : "🎉 Goal Achieved!";
        document.getElementById("entryCount").innerHTML = "📝 " + contributionsData.length;

            // Update motivational banner based on progress
            const banner = document.getElementById("motivationalBanner");
            if (banner) {
                if (progressPercent >= 100) {
                    banner.innerHTML = `
                        <div class="banner-content">
                            <span class="banner-icon">🎉</span>
                            <div class="banner-text">
                                <strong>Goal Achieved! Praise the Lord!</strong>
                                <span>Thank you for your faithful giving to the church</span>
                            </div>
                        </div>
                    `;
                } else if (progressPercent >= 75) {
                    banner.innerHTML = `
                        <div class="banner-content">
                            <span class="banner-icon">🔥</span>
                            <div class="banner-text">
                                <strong>We're almost there! ${Math.round(100 - progressPercent)}% to go!</strong>
                                <span>Your contribution helps advance God's work in our church</span>
                            </div>
                        </div>
                    `;
                } else {
                    banner.innerHTML = `
                        <div class="banner-content">
                            <span class="banner-icon">🙏</span>
                            <div class="banner-text">
                                <strong>Every contribution matters!</strong>
                                <span>Your support helps advance technology for God's glory in our church</span>
                            </div>
                        </div>
                    `;
                }
            }

            // Progress bar (using progressPercent calculated above)
        const progressBar = document.getElementById("progressBar");
            if (progressBar) {
        progressBar.style.width = progressPercent + "%";
        progressBar.innerText = Math.round(progressPercent) + "%";

                // Tech Fund color scheme - purple/blue gradient
                if(progressPercent < 50) {
                    progressBar.style.background = 'linear-gradient(90deg, #667eea, #764ba2)';
                } else if(progressPercent < 80) {
                    progressBar.style.background = 'linear-gradient(90deg, #764ba2, #667eea)';
                } else if(progressPercent < 100) {
                    progressBar.style.background = 'linear-gradient(90deg, #667eea, #5a67d8)';
                    progressBar.style.boxShadow = '0 0 15px rgba(102, 126, 234, 0.5)';
                } else {
                    progressBar.style.background = 'linear-gradient(90deg, #48bb78, #38a169)';
                    progressBar.style.boxShadow = '0 0 20px rgba(72, 187, 120, 0.7)';
                }
            }
            
            // Render top contributors (important - was missing!)
            try {
                renderTopContributors(contributionsData);
            } catch (err) {
                console.error("Error rendering top contributors:", err);
            }

            // Enhanced Stats Visualization (replaces pie chart)
            // Wait for Chart.js to be fully loaded
            const renderCharts = () => {
                if (typeof Chart !== 'undefined') {
                    try {
                        renderEnhancedStats(contributionsData);
                    } catch (err) {
                        console.error("Error rendering enhanced stats:", err);
                        const chartCard = document.querySelector('.chart-card');
                        if (chartCard) {
                            chartCard.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 40px;">Unable to load statistics</p>';
                        }
                    }
                } else {
                    // Retry after a short delay if Chart.js not loaded yet
                    setTimeout(renderCharts, 200);
                }
            };
            
            // Start rendering charts
            if (document.readyState === 'complete') {
                renderCharts();
            } else {
                window.addEventListener('load', renderCharts);
                // Also try after a delay
                setTimeout(renderCharts, 500);
            }
        } catch (err) {
            console.error("Error in renderDashboard:", err);
        }
    };

    document.getElementById("searchInput").addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = contributionsData.filter(c => (c.Member||"").toLowerCase().includes(term));
        currentDisplayCount = 0; // Reset to first page when searching
        renderDashboard(filtered);
    });

    // NO AUTO-REFRESH - use cache only after first load
    // Initial fetch - wait for it to complete (THIS IS CRITICAL - loader waits for this)
    console.log("Christmas Fund: Starting initial data fetch...");
    await fetchData();
    console.log("Christmas Fund: Initial data fetch completed");
}

// --------------------
// Christmas Fund (same caching logic)
async function initChristmasFundDashboard() {
    const API_URL = "https://script.google.com/macros/s/AKfycbyn7BAXvOI-GRNI3DfFBXc6tBAgcuwlKu2PWgJ-JKi-ShZEP-eOnzmvxC01AjGsevQd/exec?fund=christmas-fund";
    const FUND_KEY = "christmasFundData";
    const TTL = 60000;

    let contributionsData = [];
    let goalAmount = 0;
    const SHOW_COUNT = 15; // Items per page for contributors
    let currentDisplayCount = 0; // Start at page 0

    const heading = document.getElementById("fundHeading");
    if (heading) heading.textContent = "🎄 Christmas Fund Contributions";
    
    // Hide motivational banner for Christmas Fund
    const banner = document.getElementById("motivationalBanner");
    if (banner) banner.style.display = "none";

    const fetchData = async () => {
        console.log("Christmas Fund: fetchData() called");
        
        // Check cache first - use it if available (NO API CALL if cache exists)
        const cached = getCachedFund(FUND_KEY, TTL);
        if (cached) {
            console.log("Christmas Fund: Using cached data (NO API CALL - instant load)");
            contributionsData = cached.contributions || [];
            goalAmount = cached.goalAmount || 0;
            currentDisplayCount = 0;
            renderDashboard();
            renderTopContributors(contributionsData);
            return; // NO background fetch - use cache only
        }

        // No cache - fetch from API ONLY ONCE
        console.log("Christmas Fund: No cache found, fetching from API (FIRST TIME ONLY):", API_URL);
        try {
            const res = await fetch(API_URL, { credentials:'omit' });
            console.log("Christmas Fund: API response status:", res.status);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            console.log("Christmas Fund: Data received, contributions:", (data.contributions && data.contributions.length) || 0);
            contributionsData = data.contributions || [];
            goalAmount = data.goalAmount || 0;

            // Save to cache (will be used for all subsequent loads)
            setCachedFund(FUND_KEY, { contributions: contributionsData, goalAmount });
            console.log("Christmas Fund: Data cached - future loads will use cache (NO API CALLS)");

            currentDisplayCount = 0;
            renderDashboard();
            renderTopContributors(contributionsData);
            console.log("Christmas Fund: Dashboard rendered");
        } catch(err) {
            console.error("Error fetching Christmas Fund data:", err);
        }
    };

    const renderDashboard = (filteredData = null) => {
        try {
        const data = filteredData || contributionsData;
        const timeline = document.getElementById("timelineContainer");
            if (!timeline) {
                console.warn("Timeline container not found");
                return;
            }
        timeline.innerHTML = "";

            // Get ALL contributors (ordered by total contribution amount)
            const allContributors = getTopContributors(data, 1000); // Get all contributors

            if (allContributors.length === 0) {
                timeline.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">💫</div>
                        <h3>No contributions yet</h3>
                        <p>Be the first to contribute to our Christmas Fund!</p>
                    </div>
                `;
            } else {
                // Pagination setup - show 15 per page, show "Show More" button if more than 15
                const itemsPerPage = 15;
                // Initialize to first page if needed
                if (currentDisplayCount === 0) {
                    currentDisplayCount = itemsPerPage;
                }
                const totalPages = Math.ceil(allContributors.length / itemsPerPage);
                // Calculate which page we're on based on how many items we're showing
                const currentPage = Math.floor((currentDisplayCount - 1) / itemsPerPage);
                const startIdx = currentPage * itemsPerPage;
                const endIdx = Math.min(startIdx + itemsPerPage, allContributors.length);
                const displayContributors = allContributors.slice(startIdx, endIdx);
                
                // Add section title ABOVE the grid (only if there are more than 15 contributors)
                if (allContributors.length > 15) {
                    const sectionTitle = document.createElement("h3");
                    sectionTitle.className = "section-title contributors-title";
                    sectionTitle.textContent = `👥 All Contributors (${allContributors.length} total)`;
                    timeline.appendChild(sectionTitle);
                }

                // Create contributors grid
                const grid = document.createElement("div");
                grid.className = "contributors-grid";

                displayContributors.forEach((item, index) => {
            const card = document.createElement("div");
                    card.className = "contributor-card";
                    const rank = startIdx + index + 1;
                    
                    // Medal for top 3
                    let medal = "";
                    if (rank === 1) medal = "🥇";
                    else if (rank === 2) medal = "🥈";
                    else if (rank === 3) medal = "🥉";
                    else if (rank <= 10) medal = "⭐";

            card.innerHTML = `
                        <div class="contributor-rank">${medal} #${rank}</div>
                        <div class="contributor-avatar">${item.Member.charAt(0).toUpperCase()}</div>
                        <div class="contributor-name">${item.Member}</div>
                        <div class="contributor-amount">₹${item.Total.toLocaleString('en-IN')}</div>
                        <div class="contributor-count">${item.Entries} contribution${item.Entries !== 1 ? 's' : ''}</div>
                    `;
                    grid.appendChild(card);
                });

                timeline.appendChild(grid);

                // Pagination buttons container (only if there are more than 15 contributors)
                if (allContributors.length > 15) {
                    const paginationContainer = document.createElement("div");
                    paginationContainer.className = "pagination-container";
                    
                    // Previous button (show if not on first page)
                    if (currentPage > 0) {
                        const prevBtn = document.createElement("button");
                        prevBtn.className = "pagination-nav-btn";
                        prevBtn.textContent = "← Previous";
                        prevBtn.onclick = () => {
                            currentDisplayCount = Math.max(itemsPerPage, currentDisplayCount - itemsPerPage);
                            renderDashboard(filteredData);
                        };
                        paginationContainer.appendChild(prevBtn);
                    }
                    
                    // Show More button (show if there are more contributors to display)
                    // Always show if not all items are displayed, regardless of page
                    if (endIdx < allContributors.length) {
                        const showMoreBtn = document.createElement("button");
                        showMoreBtn.className = "pagination-nav-btn";
                        const remaining = allContributors.length - endIdx;
                        showMoreBtn.textContent = `Show More (${remaining} remaining)`;
                        showMoreBtn.onclick = () => {
                            currentDisplayCount = Math.min(allContributors.length, currentDisplayCount + itemsPerPage);
                            renderDashboard(filteredData);
                        };
                        paginationContainer.appendChild(showMoreBtn);
                    }
                    
                    // Only append if there are buttons to show
                    if (paginationContainer.children.length > 0) {
                        timeline.appendChild(paginationContainer);
                    }
                }
            }

            // Stats
            const totalCollected = data.reduce((sum, c) => sum + (Number(c.Amount) || 0), 0);
            const remaining = Math.max(goalAmount - totalCollected, 0);
            const progressPercent = goalAmount > 0 ? Math.min((totalCollected / goalAmount) * 100, 100) : 0;
            
            const goalEl = document.getElementById("goalAmount");
            const totalEl = document.getElementById("totalAmount");
            const remainingEl = document.getElementById("remainingAmount");
            const entryEl = document.getElementById("entryCount");
            
            if (goalEl) goalEl.innerHTML = "🎯 ₹" + goalAmount.toLocaleString('en-IN');
            if (totalEl) totalEl.innerHTML = "💰 ₹" + totalCollected.toLocaleString('en-IN');
            if (remainingEl) remainingEl.innerHTML = remaining > 0 ? "⏳ ₹" + remaining.toLocaleString('en-IN') : "🎉 Goal Achieved!";
            if (entryEl) entryEl.innerHTML = "📝 " + contributionsData.length;

            // Progress bar
        const progressBar = document.getElementById("progressBar");
            if (progressBar) {
        progressBar.style.width = progressPercent + "%";
        progressBar.innerText = Math.round(progressPercent) + "%";

                // Christmas Fund color scheme - gold/amber gradient
                if(progressPercent < 50) {
                    progressBar.style.background = 'linear-gradient(90deg, #b08d57, #d4af37)';
                } else if(progressPercent < 80) {
                    progressBar.style.background = 'linear-gradient(90deg, #ffd700, #f1c40f)';
                } else if(progressPercent < 100) {
                    progressBar.style.background = 'linear-gradient(90deg, #f1c40f, #f39c12)';
                } else {
            progressBar.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
            progressBar.style.boxShadow = '0 0 15px rgba(46,204,113,0.7)';
                }
            }
            
            // Render top contributors section
            try {
                renderTopContributors(contributionsData);
            } catch (err) {
                console.error("Error rendering top contributors:", err);
            }

            // Enhanced Stats Visualization (replaces pie chart)
            const renderCharts = () => {
                if (typeof Chart !== 'undefined') {
                    try {
                        renderEnhancedStats(contributionsData);
                    } catch (err) {
                        console.error("Error rendering enhanced stats:", err);
                        const chartCard = document.querySelector('.chart-card');
                        if (chartCard) {
                            chartCard.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 40px;">Unable to load statistics</p>';
                        }
                    }
                } else {
                    setTimeout(renderCharts, 200);
                }
            };
            
            if (document.readyState === 'complete') {
                renderCharts();
            } else {
                window.addEventListener('load', renderCharts);
                setTimeout(renderCharts, 500);
            }
        } catch (err) {
            console.error("Error in renderDashboard:", err);
        }
    };

    // Search functionality - filter contributors
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const term = e.target.value.toLowerCase().trim();
            if (term === "") {
                // Show all contributors when search is cleared
                currentDisplayCount = 0;
                renderDashboard();
            } else {
                // Filter contributions by member name
                const filtered = contributionsData.filter(c => (c.Member||"").toLowerCase().includes(term));
                currentDisplayCount = 0; // Reset to first page when searching
        renderDashboard(filtered);
                
                // Show search results count
                const timeline = document.getElementById("timelineContainer");
                if (timeline && filtered.length > 0) {
                    const resultsInfo = document.createElement("div");
                    resultsInfo.className = "search-results-info";
                    resultsInfo.textContent = `Found ${filtered.length} contribution${filtered.length !== 1 ? 's' : ''} for "${e.target.value}"`;
                    resultsInfo.style.cssText = "text-align: center; margin-bottom: 20px; padding: 12px; background: linear-gradient(135deg, #ffd700, #f1c40f); color: #2c3e50; border-radius: 12px; font-weight: 600;";
                    const existingInfo = timeline.querySelector('.search-results-info');
                    if (existingInfo) existingInfo.remove();
                    timeline.insertBefore(resultsInfo, timeline.firstChild);
                }
            }
        });
    }

    // NO AUTO-REFRESH - use cache only after first load
    // Initial fetch - wait for it to complete (THIS IS CRITICAL - loader waits for this)
    console.log("Christmas Fund: Starting initial data fetch...");
    await fetchData();
    console.log("Christmas Fund: Initial data fetch completed");
}

// --------------------
// Helper: get top contributors
function getTopContributors(data, limit=6){
    const memberMap = {};
    data.forEach(item=>{
        const member = item.Member||"Anonymous";
        const amount = Number(item.Amount)||0;
        if(!memberMap[member]) memberMap[member]={ Member:member, Total:0, Entries:0 };
        memberMap[member].Total+=amount;
        memberMap[member].Entries+=1;
    });
    return Object.values(memberMap).sort((a,b)=>b.Total-a.Total).slice(0,limit);
}

// Enhanced Stats Visualization
function renderEnhancedStats(contributions) {
    const chartCard = document.querySelector('.chart-card');
    if (!chartCard) {
        console.warn("Chart card not found");
        return;
    }
    
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.warn("Chart.js not loaded yet, will retry...");
        // Don't show loading message, just return and let the retry mechanism handle it
        return;
    }
    
    console.log("Rendering enhanced stats with Chart.js");
    
    // Sort contributions by date
    const sortedContributions = [...contributions].sort((a, b) => new Date(a.Date) - new Date(b.Date));
    
    if (sortedContributions.length === 0) {
        chartCard.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 40px;">No data available yet</p>';
        return;
    }
    
    // Prepare time series data
    const timeSeriesData = {};
    const contributorGrowth = {};
    let uniqueContributors = new Set();
    
    sortedContributions.forEach((c) => {
        const date = new Date(c.Date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const amount = Number(c.Amount) || 0;
        
        // Time series
        if (!timeSeriesData[monthKey]) {
            timeSeriesData[monthKey] = { total: 0, count: 0 };
        }
        timeSeriesData[monthKey].total += amount;
        timeSeriesData[monthKey].count += 1;
        
        // Contributor growth
        uniqueContributors.add(c.Member);
        contributorGrowth[monthKey] = uniqueContributors.size;
    });
    
    const months = Object.keys(timeSeriesData).sort();
    const amounts = months.map(m => timeSeriesData[m].total);
    const contributorCounts = months.map(m => contributorGrowth[m] || 0);
    
    // Calculate interesting stats
    const totalContributors = uniqueContributors.size;
    const totalAmount = contributions.reduce((sum, c) => sum + (Number(c.Amount) || 0), 0);
    const avgContribution = contributions.length > 0 
        ? Math.round(totalAmount / contributions.length)
        : 0;
    const largestContribution = contributions.length > 0 
        ? Math.max(...contributions.map(c => Number(c.Amount) || 0))
        : 0;
    
    // Create stats cards and charts
    chartCard.innerHTML = `
        <div class="stats-container">
            <h3 class="stats-title">📊 Contribution Insights</h3>
            
            <div class="stats-grid">
                <div class="stat-mini-card">
                    <div class="stat-mini-icon">👥</div>
                    <div class="stat-mini-value">${totalContributors}</div>
                    <div class="stat-mini-label">Total Contributors</div>
                </div>
                <div class="stat-mini-card">
                    <div class="stat-mini-icon">💰</div>
                    <div class="stat-mini-value">₹${avgContribution.toLocaleString('en-IN')}</div>
                    <div class="stat-mini-label">Average Contribution</div>
                </div>
                <div class="stat-mini-card">
                    <div class="stat-mini-icon">⭐</div>
                    <div class="stat-mini-value">₹${largestContribution.toLocaleString('en-IN')}</div>
                    <div class="stat-mini-label">Largest Contribution</div>
                </div>
            </div>
            
            <div class="chart-container">
                <canvas id="timeSeriesChart"></canvas>
            </div>
            
            <div class="chart-container">
                <canvas id="contributorGrowthChart"></canvas>
            </div>
        </div>
    `;
    
    // Time Series Chart
    const timeCanvas = document.getElementById('timeSeriesChart');
    if (!timeCanvas) {
        console.warn("Time series chart canvas not found");
        return;
    }
    const timeCtx = timeCanvas.getContext('2d');
    if (window.timeSeriesChart && typeof window.timeSeriesChart.destroy === 'function') {
        window.timeSeriesChart.destroy();
    }
    window.timeSeriesChart = new Chart(timeCtx, {
        type: 'line',
        data: {
            labels: months.map(m => {
                const [year, month] = m.split('-');
                return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            }),
            datasets: [{
                label: 'Monthly Contributions (₹)',
                data: amounts,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: '#764ba2',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            aspectRatio: window.innerWidth < 768 ? 1.5 : 2,
            plugins: {
                legend: { display: true, position: 'top' },
                title: { 
                    display: true, 
                    text: 'Contributions Over Time', 
                    font: { size: window.innerWidth < 768 ? 14 : 16, weight: 'bold' } 
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₹' + value;
                        },
                        font: { size: window.innerWidth < 768 ? 10 : 12 }
                    }
                },
                x: {
                    ticks: {
                        font: { size: window.innerWidth < 768 ? 10 : 12 }
                    }
                }
            }
        }
    });
    
    // Contributor Growth Chart
    const growthCanvas = document.getElementById('contributorGrowthChart');
    if (!growthCanvas) {
        console.warn("Contributor growth chart canvas not found");
        return;
    }
    const growthCtx = growthCanvas.getContext('2d');
    if (window.contributorGrowthChart && typeof window.contributorGrowthChart.destroy === 'function') {
        window.contributorGrowthChart.destroy();
    }
    window.contributorGrowthChart = new Chart(growthCtx, {
        type: 'bar',
        data: {
            labels: months.map(m => {
                const [year, month] = m.split('-');
                return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short' });
            }),
            datasets: [{
                label: 'Number of Contributors',
                data: contributorCounts,
                backgroundColor: 'rgba(118, 75, 162, 0.6)',
                borderColor: '#764ba2',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            aspectRatio: window.innerWidth < 768 ? 1.5 : 2,
            plugins: {
                legend: { display: true, position: 'top' },
                title: { 
                    display: true, 
                    text: 'Contributor Growth Over Time', 
                    font: { size: window.innerWidth < 768 ? 14 : 16, weight: 'bold' } 
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: { size: window.innerWidth < 768 ? 10 : 12 }
                    }
                },
                x: {
                    ticks: {
                        font: { size: window.innerWidth < 768 ? 10 : 12 }
                    }
                }
            }
        }
    });
}

// Render top contributors (cards)
function renderTopContributors(contributions){
    const grid = document.getElementById("topContributorsGrid");
    if(!grid) return;

    const medals=["🥇","🥈","🥉","⭐","⭐","⭐"];
    const top=getTopContributors(contributions,6);

    grid.innerHTML="";
    top.forEach((item,index)=>{
        const card=document.createElement("div");
        card.className="top-card";

        card.innerHTML=`
            <div class="rank-line">
                <span class="medal">${medals[index]}</span>
                <span class="rank-text">Rank #${index+1}</span>
            </div>

            <div class="amount">₹${item.Total}</div>
            <div class="amount-label">Total Contribution</div>

            <div class="meta">
                <span>${item.Entries} Contributions</span>
                <span class="member-name">${item.Member}</span>
            </div>
        `;
        grid.appendChild(card);
    });
}
