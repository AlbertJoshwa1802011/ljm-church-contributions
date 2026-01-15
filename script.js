document.addEventListener("DOMContentLoaded", async () => {
    // --------------------
    // Create loader
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
        top: "0", left: "0", width: "100%", height: "100%",
        background: "#1a1a1a", display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: "center", zIndex: "9999",
        opacity: "1", transition: "opacity 0.5s ease"
    });
    document.body.appendChild(loader);

    // Add dynamic CSS for animations
    const style = document.createElement("style");
    style.innerHTML = `
        .loader-symbol { position: relative; width:100px; height:100px; display:flex; justify-content:center; align-items:center; font-size:32px; font-weight:bold; color:#ffd700; animation:pulse 1.5s infinite alternate; }
        .loader-symbol .halo { position:absolute; width:120px; height:120px; border:4px solid #ffd700; border-radius:50%; animation:rotateHalo 2s linear infinite; }
        .loader-text { margin-top:16px; color:#fff; font-size:18px; font-weight:500; text-align:center; }
        @keyframes rotateHalo { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0% { transform: scale(1); text-shadow:0 0 5px #ffd700; } 100% { transform: scale(1.2); text-shadow:0 0 15px #ffd700; } }
    `;
    document.head.appendChild(style);

    // --------------------
    // Fetch cached data or API
    const cachedTech = getCachedFund("techFundData");
    const cachedChristmas = getCachedFund("christmasFundData");

    const promises = [];

    if (!cachedTech) {
        promises.push(fetchAndCacheFund("techFundData", "https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec"));
    }
    if (!cachedChristmas) {
        promises.push(fetchAndCacheFund("christmasFundData", "https://script.google.com/macros/s/AKfycbz6Bk6yurNmTf3FcQ4ykvja7P1VWOMVTP4wDMTUa9wCHXAPNViB-UmhpdFKpiCzg_KA/exec"));
    }

    // Wait for APIs to finish if any
    await Promise.all(promises);

    // --------------------
    // Minimum loader display for UX
    await new Promise(resolve => setTimeout(resolve, 800)); // at least 0.8s

    // Smooth fade out
    loader.style.opacity = "0";
    setTimeout(() => loader.remove(), 500);

    // --------------------
    // Continue existing dashboard logic
    const params = new URLSearchParams(window.location.search);
    let selectedFund = params.get("fund") || "tech";
    selectedFund = selectedFund.toLowerCase().replace(/\s+/g, '');

    if(selectedFund === "christmasfund") {
        initChristmasFundDashboard(); // your existing function
    } else {
        initDashboard(); // your existing Tech Fund function
    }

    // Heading
    const heading = document.getElementById("fundHeading");
    if (heading) {
        if (selectedFund.includes("christmas")) heading.textContent = `🎄 Christmas Fund Contributions`;
        else heading.textContent = `💻 Tech Fund Contributions`;
    }
});


// Helper: Fetch & cache fund (for startup preloader)
async function fetchAndCacheFund(fundKey, apiUrl) {
    try {
        const res = await fetch(apiUrl, { credentials: 'omit' });
        const data = await res.json();
        setCachedFund(fundKey, { contributions: data.contributions || [], goalAmount: data.goalAmount || 0 });
    } catch (err) {
        console.error(`Error fetching ${fundKey}:`, err);
    }
}

// --------------------
// Helper: get cached fund
function getCachedFund(fundKey, ttl = 60000) {
    const cache = localStorage.getItem(fundKey);
    if (!cache) return null;

    try {
        const parsed = JSON.parse(cache);
        const now = Date.now();
        if (now - parsed.lastFetched < ttl) return parsed.data;
        return null;
    } catch {
        return null;
    }
}

// Helper: set fund cache
function setCachedFund(fundKey, data) {
    localStorage.setItem(fundKey, JSON.stringify({ data, lastFetched: Date.now() }));
}

// --------------------
// Tech Fund
function initDashboard() {
    const API_URL = "https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec";
    const FUND_KEY = "techFundData";
    const TTL = 60000; // 60s

    let contributionsData = [];
    let goalAmount = 0;
    const SHOW_COUNT = 6;
    let currentDisplayCount = SHOW_COUNT;

    const heading = document.getElementById("fundHeading");
    if (heading) heading.textContent = "💻 Tech Fund Contributions";

    const fetchData = async () => {
        // check cache first
        const cached = getCachedFund(FUND_KEY, TTL);
        if (cached) {
            contributionsData = cached.contributions || [];
            goalAmount = cached.goalAmount || 0;
            renderDashboard();
            renderTopContributors(contributionsData);
            return;
        }

        // fetch from API
        try {
            const res = await fetch(API_URL, { credentials: 'omit' });
            const data = await res.json();
            contributionsData = data.contributions || [];
            goalAmount = data.goalAmount || 0;

            // save cache
            setCachedFund(FUND_KEY, { contributions: contributionsData, goalAmount });

            currentDisplayCount = SHOW_COUNT;
            renderDashboard();
            renderTopContributors(contributionsData);
        } catch (err) {
            console.error("Error fetching Tech Fund data:", err);
        }
    };

    const renderDashboard = (filteredData = null) => {
        const data = filteredData || contributionsData;
        const timeline = document.getElementById("timelineContainer");
        timeline.innerHTML = "";

        const topContributors = getTopContributors(contributionsData, 6);

        topContributors.forEach((item, index) => {
            const card = document.createElement("div");
            card.className = "timeline-card";
            const medals = ["🥇", "🥈", "🥉"];
            const medal = medals[index] || "⭐";

            card.innerHTML = `
                <div class="date">${medal} Rank #${index + 1}</div>
                <div class="amount">₹${item.Total}</div>
                <div class="category">Total Contribution</div>
                <div class="notes">${item.Entries} Contributions</div>
                <div class="member">${item.Member}</div>
            `;
            timeline.appendChild(card);
        });

        // Stats
        const totalCollected = data.reduce((sum, c) => sum + (Number(c.Amount)||0), 0);
        document.getElementById("goalAmount").innerHTML = "💰 ₹" + goalAmount;
        document.getElementById("totalAmount").innerHTML = "📊 ₹" + totalCollected;
        document.getElementById("remainingAmount").innerHTML = "⏳ ₹" + Math.max(goalAmount - totalCollected, 0);
        document.getElementById("entryCount").innerHTML = "📝 " + contributionsData.length;

        // Progress bar
        const progressPercent = goalAmount > 0 ? Math.min((totalCollected / goalAmount) * 100, 100) : 0;
        const progressBar = document.getElementById("progressBar");
        progressBar.style.width = progressPercent + "%";
        progressBar.innerText = Math.round(progressPercent) + "%";

        if(progressPercent < 50) progressBar.style.background = 'linear-gradient(90deg, #b08d57, #d4af37)';
        else if(progressPercent < 80) progressBar.style.background = 'linear-gradient(90deg, #ffd700, #f1c40f)';
        else if(progressPercent < 100) progressBar.style.background = 'linear-gradient(90deg, #f1c40f, #f39c12)';
        else {
            progressBar.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
            progressBar.style.boxShadow = '0 0 15px rgba(46,204,113,0.7)';
        }

        // Pie chart
        const categoryMap = {};
        contributionsData.forEach(c => {
            const cat = c.Category || "Other";
            const amt = Number(c.Amount) || 0;
            categoryMap[cat] = (categoryMap[cat] || 0) + amt;
        });

        const ctx = document.getElementById('categoryPieChart').getContext('2d');
        if(window.pieChart) window.pieChart.destroy();
        window.pieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(categoryMap),
                datasets: [{ data: Object.values(categoryMap), backgroundColor: ['#2c7be5','#00b74a','#f6c23e','#e74a3b','#8e44ad','#fd7e14'] }]
            },
            options: { responsive:true, plugins:{ legend:{position:'bottom'}, title:{display:true, text:'Contributions by Category'} } }
        });
    };

    document.getElementById("searchInput").addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = contributionsData.filter(c => (c.Member||"").toLowerCase().includes(term));
        currentDisplayCount = SHOW_COUNT;
        renderDashboard(filtered);
    });

    // Auto-refresh every 60s
    setInterval(fetchData, TTL);

    // Initial fetch
    fetchData();
}

// --------------------
// Christmas Fund (same caching logic)
function initChristmasFundDashboard() {
    const API_URL = "https://script.google.com/macros/s/AKfycbz6Bk6yurNmTf3FcQ4ykvja7P1VWOMVTP4wDMTUa9wCHXAPNViB-UmhpdFKpiCzg_KA/exec";
    const FUND_KEY = "christmasFundData";
    const TTL = 60000;

    let contributionsData = [];
    let goalAmount = 0;
    const SHOW_COUNT = 6;
    let currentDisplayCount = SHOW_COUNT;

    const heading = document.getElementById("fundHeading");
    if (heading) heading.textContent = "🎄 Christmas Fund Contributions";

    const fetchData = async () => {
        const cached = getCachedFund(FUND_KEY, TTL);
        if (cached) {
            contributionsData = cached.contributions || [];
            goalAmount = cached.goalAmount || 0;
            renderDashboard();
            renderTopContributors(contributionsData);
            return;
        }

        try {
            const res = await fetch(API_URL, { credentials:'omit' });
            const data = await res.json();
            contributionsData = data.contributions || [];
            goalAmount = data.goalAmount || 0;

            setCachedFund(FUND_KEY, { contributions: contributionsData, goalAmount });

            currentDisplayCount = SHOW_COUNT;
            renderDashboard();
            renderTopContributors(contributionsData);
        } catch(err) {
            console.error("Error fetching Christmas Fund data:", err);
        }
    };

    const renderDashboard = (filteredData = null) => {
        const data = filteredData || contributionsData;
        const timeline = document.getElementById("timelineContainer");
        timeline.innerHTML = "";

        const topContributors = getTopContributors(contributionsData, 6);

        topContributors.forEach((item, index) => {
            const card = document.createElement("div");
            card.className = "timeline-card";
            const medals = ["🥇","🥈","🥉"];
            const medal = medals[index] || "⭐";

            card.innerHTML = `
                <div class="date">${medal} Rank #${index+1}</div>
                <div class="amount">₹${item.Total}</div>
                <div class="category">Total Contribution</div>
                <div class="notes">${item.Entries} Contributions</div>
                <div class="member">${item.Member}</div>
            `;
            timeline.appendChild(card);
        });

        const totalCollected = data.reduce((sum,c)=>sum+(Number(c.Amount)||0),0);
        document.getElementById("goalAmount").innerHTML = "💰 ₹" + goalAmount;
        document.getElementById("totalAmount").innerHTML = "📊 ₹" + totalCollected;
        document.getElementById("remainingAmount").innerHTML = "⏳ ₹" + Math.max(goalAmount - totalCollected,0);
        document.getElementById("entryCount").innerHTML = "📝 " + contributionsData.length;

        const progressPercent = goalAmount > 0 ? Math.min((totalCollected/goalAmount)*100,100):0;
        const progressBar = document.getElementById("progressBar");
        progressBar.style.width = progressPercent + "%";
        progressBar.innerText = Math.round(progressPercent) + "%";

        if(progressPercent < 50) progressBar.style.background = 'linear-gradient(90deg, #b08d57, #d4af37)';
        else if(progressPercent < 80) progressBar.style.background = 'linear-gradient(90deg, #ffd700, #f1c40f)';
        else if(progressPercent < 100) progressBar.style.background = 'linear-gradient(90deg, #f1c40f, #f39c12)';
        else {
            progressBar.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
            progressBar.style.boxShadow = '0 0 15px rgba(46,204,113,0.7)';
        }

        // Pie chart
        const categoryMap = {};
        contributionsData.forEach(c=>{
            const cat = c.Category || "Other";
            const amt = Number(c.Amount)||0;
            categoryMap[cat] = (categoryMap[cat]||0)+amt;
        });

        const ctx = document.getElementById('categoryPieChart').getContext('2d');
        if(window.pieChart) window.pieChart.destroy();
        window.pieChart = new Chart(ctx,{
            type:'pie',
            data:{
                labels:Object.keys(categoryMap),
                datasets:[{ data:Object.values(categoryMap), backgroundColor:['#2c7be5','#00b74a','#f6c23e','#e74a3b','#8e44ad','#fd7e14'] }]
            },
            options:{ responsive:true, plugins:{ legend:{position:'bottom'}, title:{display:true,text:'Contributions by Category (Christmas Fund)'}} }
        });
    };

    document.getElementById("searchInput").addEventListener("input",(e)=>{
        const term = e.target.value.toLowerCase();
        const filtered = contributionsData.filter(c=>(c.Member||"").toLowerCase().includes(term));
        currentDisplayCount = SHOW_COUNT;
        renderDashboard(filtered);
    });

    setInterval(fetchData, TTL);
    fetchData();
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
