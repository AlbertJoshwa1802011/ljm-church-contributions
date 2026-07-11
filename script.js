// ==================================================
// LJM Church Contributions - Main Dashboard Script
// Smart caching, premium UX, instant load, Secure
// ==================================================

// Helper: escape HTML to prevent XSS attacks
function escapeHtml(unsafe) {
    if (unsafe == null) return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// --------------------
// Cache configuration (shared across pages via localStorage)
const CACHE_VERSION = 1;
const CACHE_TTL_MS = 180 * 1000; // 3 minutes

// Helper: get cached fund (with TTL enforcement - works on all devices including Android)
function getCachedFund(fundKey, ignoreExpiry = false) {
    try {
        const raw = localStorage.getItem(fundKey);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (parsed.version !== CACHE_VERSION) {
            localStorage.removeItem(fundKey);
            return null;
        }

        const age = Date.now() - (parsed.lastFetched || 0);
        
        if (!ignoreExpiry) {
            // Expire if too old OR if age is negative (device clock skew / invalid timestamp)
            if (age < 0 || age > CACHE_TTL_MS) {
                if (age > CACHE_TTL_MS) {
                    console.log(`[CACHE] Expired: ${fundKey} (age: ${Math.round(age / 1000)}s)`);
                }
                localStorage.removeItem(fundKey);
                return null;
            }
        }

        if (parsed.data) {
            console.log(`[CACHE] Hit: ${fundKey} (age: ${Math.round(age / 1000)}s)`);
            return parsed.data;
        }
        return null;
    } catch (err) {
        // localStorage disabled, full, or parse error - behave as no cache so we always fetch
        try { localStorage.removeItem(fundKey); } catch (_) {}
        return null;
    }
}

// Helper: set fund cache
function setCachedFund(fundKey, data) {
    try {
        localStorage.setItem(fundKey, JSON.stringify({
            data,
            lastFetched: Date.now(),
            version: CACHE_VERSION
        }));
        console.log(`[CACHE] Saved: ${fundKey}`);
    } catch (err) {
        try {
            localStorage.removeItem('techFundData');
            localStorage.removeItem('christmasFundData');
            localStorage.setItem(fundKey, JSON.stringify({
                data,
                lastFetched: Date.now(),
                version: CACHE_VERSION
            }));
        } catch (e) { /* storage full */ }
    }
}

// Members list cache (shared with members.html; 5 min TTL for fast Members page load)
const MEMBERS_LIST_CACHE_KEY = 'membersListCache';
function setCachedMembersList(members) {
    try {
        localStorage.setItem(MEMBERS_LIST_CACHE_KEY, JSON.stringify({
            members: Array.isArray(members) ? members : [],
            lastFetched: Date.now(),
            version: CACHE_VERSION
        }));
        console.log('[CACHE] Saved members list');
    } catch (e) {
        try { localStorage.removeItem(MEMBERS_LIST_CACHE_KEY); } catch (_) {}
    }
}
function getCachedMembersList() {
    try {
        const raw = localStorage.getItem(MEMBERS_LIST_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed.version !== CACHE_VERSION) {
            localStorage.removeItem(MEMBERS_LIST_CACHE_KEY);
            return null;
        }
        const age = Date.now() - (parsed.lastFetched || 0);
        if (age < 0 || age > CACHE_TTL_MS) {
            localStorage.removeItem(MEMBERS_LIST_CACHE_KEY);
            return null;
        }
        return Array.isArray(parsed.members) ? parsed.members : null;
    } catch (e) {
        try { localStorage.removeItem(MEMBERS_LIST_CACHE_KEY); } catch (_) {}
        return null;
    }
}

// Preload members list in background (so Members page opens fast)
async function preloadMembersList() {
    const techUrl = "/api/contributions?fund=tech-contributions";
    const christmasUrl = "/api/contributions?fund=christmas-fund";
    try {
        const [techRes, christmasRes] = await Promise.all([
            fetch(techUrl + '&_t=' + Date.now(), { credentials: 'omit', cache: 'no-store' }),
            fetch(christmasUrl + '&_t=' + Date.now(), { credentials: 'omit', cache: 'no-store' })
        ]);
        const tech = await techRes.json();
        const christmas = await christmasRes.json();
        const contributions = [...(tech.contributions || []), ...(christmas.contributions || [])];
        const members = [...new Set(contributions.map(c => c.Member).filter(Boolean))].sort();
        setCachedMembersList(members);
    } catch (err) {
        console.error('[CACHE] Members preload failed:', err);
    }
}

// --------------------
// Bible Verses about Giving
const BIBLE_VERSES = [
    { text: "Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.", ref: "2 Corinthians 9:7" },
    { text: "Give, and it will be given to you. A good measure, pressed down, shaken together and running over, will be poured into your lap.", ref: "Luke 6:38" },
    { text: "Honor the LORD with your wealth, with the firstfruits of all your crops; then your barns will be filled to overflowing.", ref: "Proverbs 3:9-10" },
    { text: "A generous person will prosper; whoever refreshes others will be refreshed.", ref: "Proverbs 11:25" },
    { text: "Bring the whole tithe into the storehouse, that there may be food in my house. Test me in this, says the LORD Almighty, and see if I will not throw open the floodgates of heaven.", ref: "Malachi 3:10" },
    { text: "Remember this: Whoever sows sparingly will also reap sparingly, and whoever sows generously will also reap generously.", ref: "2 Corinthians 9:6" },
    { text: "Command them to do good, to be rich in good deeds, and to be generous and willing to share.", ref: "1 Timothy 6:18" },
    { text: "It is more blessed to give than to receive.", ref: "Acts 20:35" },
    { text: "For where your treasure is, there your heart will be also.", ref: "Matthew 6:21" },
    { text: "The generous will themselves be blessed, for they share their food with the poor.", ref: "Proverbs 22:9" },
    { text: "Freely you have received; freely give.", ref: "Matthew 10:8" },
    { text: "God is not unjust; he will not forget your work and the love you have shown him as you have helped his people and continue to help them.", ref: "Hebrews 6:10" }
];

function initBibleVerse() {
    const verseText = document.getElementById("bibleVerseText");
    const verseRef = document.getElementById("bibleVerseRef");
    if (!verseText || !verseRef) return;

    // Use day of year to rotate verses (changes daily)
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / 86400000);
    const verse = BIBLE_VERSES[dayOfYear % BIBLE_VERSES.length];

    verseText.textContent = `"${verse.text}"`;
    verseRef.textContent = `— ${verse.ref}`;
}

// Pastor-curated Verse of the Month / Year (set in admin → Verses, stored in config).
// These are the "verse cards" the church hands out physically, mirrored in the app.
async function loadChurchVerses() {
    const section = document.getElementById("verseCards");
    if (!section) return;
    try {
        const res = await fetch("/api/settings?_t=" + Date.now(), { cache: "no-store" });
        const data = await res.json();
        const s = (data && data.settings) || {};

        const fill = (cardId, labelId, textId, refId, label, text, ref) => {
            const card = document.getElementById(cardId);
            const hasText = text && text.trim();
            if (!card) return false;
            if (!hasText) { card.style.display = "none"; return false; }
            card.style.display = "";
            document.getElementById(labelId).textContent = label || "";
            document.getElementById(textId).textContent = `"${text.trim()}"`;
            const refEl = document.getElementById(refId);
            refEl.textContent = ref && ref.trim() ? `— ${ref.trim()}` : "";
            return true;
        };

        const monthShown = fill("verseMonthCard", "verseMonthLabel", "verseMonthText", "verseMonthRef",
            s.verse_month_label, s.verse_month_text, s.verse_month_ref);
        const yearShown = fill("verseYearCard", "verseYearLabel", "verseYearText", "verseYearRef",
            s.verse_year_label, s.verse_year_text, s.verse_year_ref);

        section.style.display = (monthShown || yearShown) ? "" : "none";
    } catch (_) {
        section.style.display = "none";
    }
}

// --------------------
// Animated value counter
function animateValue(elementId, targetValue, prefix = '', duration = 1200) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    // Reset any previous animation
    if (el._anim) cancelAnimationFrame(el._anim);

    const startTime = performance.now();
    const startValue = 0;

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = Math.floor(startValue + easeProgress * (targetValue - startValue));
        
        el.textContent = prefix + current.toLocaleString('en-IN');
        
        if (progress < 1) {
            el._anim = requestAnimationFrame(update);
        }
    }
    el._anim = requestAnimationFrame(update);
}

// Render circular progress ring on KPI canvas
function drawProgressRing(progressPercent) {
    const canvas = document.getElementById('kpiProgressRing');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 22;
    const strokeWidth = 5;

    // Draw background track
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.15)';
    ctx.lineWidth = strokeWidth;
    ctx.stroke();

    // Draw active progress arc
    const startAngle = -0.5 * Math.PI;
    const endAngle = startAngle + (progressPercent / 100) * 2 * Math.PI;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle, false);
    
    // Read computed accent color from theme.css
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#d97757';
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Draw text in center (reads computed text color)
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillStyle = getComputedStyle(document.body).color || '#1f1e1a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(progressPercent) + '%', centerX, centerY);
}

// Redraw progress ring when theme changes
document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'data-theme') {
                if (window._currentProgressPercent !== undefined) {
                    drawProgressRing(window._currentProgressPercent);
                }
            }
        });
    });
    observer.observe(document.documentElement, { attributes: true });
});

/**
 * TREND INDICATOR: Renders a premium growth badge next to a value
 */
function updateTrendIndicator(containerId, trend) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (!trend || trend.direction === 'neutral') {
        el.innerHTML = `<span class="trend-badge trend-neutral">New</span>`;
        return;
    }

    const isPositive = trend.direction === 'up';
    const badgeClass = isPositive ? 'trend-up' : 'trend-down';
    const icon = isPositive ? '▲' : '▼';
    
    el.innerHTML = `
        <span class="trend-badge ${badgeClass}">${icon} ${Math.abs(trend.percent)}%</span>
        <span style="color: #64748b; font-size: 11px; margin-left: 4px;">vs last month</span>
    `;
}

// --------------------
// Modal: How we calculate (for stat cards and insight cards)
function initInsightModal() {
    const modal = document.getElementById('insightModal');
    if (!modal) return;

    const titleEl = document.getElementById('insightModalTitle');
    const bodyEl = document.getElementById('insightModalBody');
    const backdrop = modal.querySelector('.insight-modal-backdrop');
    const closeBtn = modal.querySelector('.insight-modal-close');

    function openModal(title, bodyHtml) {
        if (titleEl) titleEl.textContent = title;
        if (bodyEl) bodyEl.innerHTML = bodyHtml;
        modal.classList.add('insight-modal-visible');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.classList.remove('insight-modal-visible');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    // We use the global escapeHtml function now
    
    function getStatCardContent(type) {
        const ctx = window.__insightContext || {};
        const goal = ctx.goalAmount != null ? ctx.goalAmount : 0;
        const total = ctx.totalAmount != null ? ctx.totalAmount : 0;
        const remaining = Math.max(goal - total, 0);
        const count = ctx.entryCount != null ? ctx.entryCount : 0;
        const spent = Number(window._spentOnProducts) || 0;
        const productsCount = Number(window._productsBoughtCount) || 0;
        const availableBalance = Math.max(total - spent, 0);
        const summaryLine = `<p class="insight-modal-summary">Current: Goal ₹${Number(goal).toLocaleString('en-IN')} · Collected ₹${Number(total).toLocaleString('en-IN')} · Remaining ₹${Number(remaining).toLocaleString('en-IN')} · <strong>${count}</strong> contribution${count !== 1 ? 's' : ''}</p>`;
        switch (type) {
            case 'goal':
                return summaryLine + `<p><strong>Goal Amount</strong> is the target we are working towards for this fund.</p><p>Current goal: <strong>₹${Number(goal).toLocaleString('en-IN')}</strong></p>`;
            case 'total':
                return summaryLine + `<p><strong>Total Collected</strong> = sum of all contribution amounts.</p><p>Formula: each contribution's <code>Amount</code> is added up.</p><p>Current total: <strong>₹${Number(total).toLocaleString('en-IN')}</strong></p>`;
            case 'remaining':
                return summaryLine + `<p><strong>Remaining</strong> = Goal − Total collected.</p><p>Formula: <code>Remaining = ${Number(goal).toLocaleString('en-IN')} − ${Number(total).toLocaleString('en-IN')}</code></p><p>Current remaining: <strong>₹${Number(remaining).toLocaleString('en-IN')}</strong></p>`;
            case 'count':
                return summaryLine + `<p><strong>Number of Contributions</strong> = count of all contribution entries (each row in our records).</p><p>Current count: <strong>${count}</strong> contribution${count !== 1 ? 's' : ''}</p>`;
            case 'spent':
                return summaryLine +
                    `<p><strong>Spent on Products</strong> = money used from this fund to purchase items for the church.</p>` +
                    `<p>Total spent from fund: <strong>₹${spent.toLocaleString('en-IN')}</strong> on <strong>${productsCount}</strong> item${productsCount !== 1 ? 's' : ''}.</p>` +
                    `<p>Only the <em>fund contribution</em> portion is counted here — external donations (from family, personal top-ups) do NOT reduce the fund balance.</p>` +
                    `<p><a href="impact.html" style="color:#667eea; font-weight:700;">View all purchases →</a></p>`;
            case 'balance':
                return summaryLine +
                    `<p><strong>Available Balance</strong> = Total Collected − Spent on Products.</p>` +
                    `<p>Formula: <code>₹${Number(total).toLocaleString('en-IN')} − ₹${spent.toLocaleString('en-IN')} = ₹${availableBalance.toLocaleString('en-IN')}</code></p>` +
                    `<p>This is the money currently in hand that can be used for future purchases or church needs.</p>` +
                    `<p><a href="impact.html" style="color:#667eea; font-weight:700;">See what we bought →</a></p>`;
            default: return '<p>No details available.</p>';
        }
    }

    function getInsightCardContent(type) {
        const ctx = window.__insightContext || {};
        switch (type) {
            case 'unique': {
                let html = `<p><strong>Unique Contributors</strong> = number of different people who have given at least once (we count unique <code>Member</code> names).</p><p>Current: <strong>${ctx.uniqueMembers != null ? ctx.uniqueMembers : 0}</strong> people. Average per person: ₹${Number(ctx.avgPerPerson || 0).toLocaleString('en-IN')}.</p>`;
                const list = ctx.contributorList;
                if (list && list.length > 0) {
                    html += '<div class="contributor-detail-list-wrapper"><table class="contributor-detail-list"><thead><tr><th>Name</th><th>Total</th><th>#</th><th>Avg</th></tr></thead><tbody>';
                    list.forEach((c) => {
                        const avgPerEntry = c.Entries > 0 ? Math.round(c.Total / c.Entries) : 0;
                        html += `<tr><td>${escapeHtml(c.Member)}</td><td>₹${Number(c.Total).toLocaleString('en-IN')}</td><td>${c.Entries}</td><td>₹${avgPerEntry.toLocaleString('en-IN')}</td></tr>`;
                    });
                    html += '</tbody></table></div>';
                }
                return html;
            }
            case 'avg':
                return `<p><strong>Average Contribution</strong> = Total collected ÷ number of contribution entries.</p><p>Formula: <code>Total ÷ ${ctx.entryCount != null ? ctx.entryCount : 0} entries</code>. Current average: <strong>₹${Number(ctx.avgContribution || 0).toLocaleString('en-IN')}</strong> per entry.</p>`;
            case 'bestMonth': {
                let bestHtml = `<p><strong>Most Active Month</strong> = the calendar month with the highest total amount collected.</p>`;
                const months = ctx.monthlyBreakdown;
                if (months && months.length > 0) {
                    bestHtml += '<div class="contributor-detail-list-wrapper"><table class="contributor-detail-list"><thead><tr><th>Month</th><th>Collected</th><th>#</th></tr></thead><tbody>';
                    months.forEach((m) => {
                        bestHtml += `<tr><td>${escapeHtml(m.label)}</td><td>₹${Number(m.total).toLocaleString('en-IN')}</td><td>${m.count}</td></tr>`;
                    });
                    bestHtml += '</tbody></table></div>';
                } else {
                    bestHtml += '<p>No monthly data yet.</p>';
                }
                return bestHtml;
            }
            case 'estimated': {
                const remaining = ctx.remaining;
                const pace = ctx.monthsToGoal;
                const date = new Date();
                date.setMonth(date.getDate() + pace);
                const dateStr = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

                let estHtml = `
                    <div class="human-insight">
                        <p class="insight-primary">🎯 <strong>Goal Projection:</strong> Based on your current giving pace, we are on track to reach the goal by <strong>${dateStr}</strong>.</p>
                        <p>That's about <strong>${pace} month${pace !== 1 ? 's' : ''}</strong> away.</p>
                        <div class="insight-metric-grid">
                            <div class="metric-item">
                                <span class="label">Needed</span>
                                <span class="value">₹${remaining.toLocaleString('en-IN')}</span>
                            </div>
                            <div class="metric-item">
                                <span class="label">Monthly Rate</span>
                                <span class="value">₹${Math.round(ctx.avgPerMonth).toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    </div>
                `;
                return estHtml;
            }
            default: return '<p>No details available.</p>';
        }
    }

    function onCardClick(e) {
        const card = e.target.closest('.stat-card[data-stat-type], .insight-card[data-insight-type]');
        if (!card) return;
        e.preventDefault();
        const statType = card.getAttribute('data-stat-type');
        const insightType = card.getAttribute('data-insight-type');
        
        if (statType === 'collected') {
            const contributions = window._currentContributions || [];
            renderTrendChart(contributions, 'collected');
            return;
        }
        
        if (statType === 'count') {
            const contributions = window._currentContributions || [];
            renderTrendChart(contributions, 'count');
            return;
        }

        if (statType) {
            const titles = { goal: 'How we calculate: Goal Amount', remaining: 'How we calculate: Remaining' };
            openModal(titles[statType] || 'Calculation details', getStatCardContent(statType));
        } else if (insightType) {
            const titles = { unique: 'How we calculate: Unique Contributors', avg: 'How we calculate: Average Contribution', bestMonth: 'How we calculate: Most Active Month', estimated: 'How we calculate: Estimated to Goal', source: 'How we calculate: Giving Channels' };
            openModal(titles[insightType] || 'Calculation details', getInsightCardContent(insightType));
        }
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);
    modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('insight-modal-visible')) closeModal();
    });
    document.addEventListener('click', onCardClick);
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const card = e.target.closest('.stat-card[data-stat-type], .insight-card[data-insight-type]');
        if (card) onCardClick(e);
    });
}

// --------------------
// Goal Donut Chart
function renderGoalDonut(collected, goal) {
    const canvas = document.getElementById('goalDonutChart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (goal <= 0) return;

    const ctx = canvas.getContext('2d');
    if (window._goalDonutChart && typeof window._goalDonutChart.destroy === 'function') {
        window._goalDonutChart.destroy();
    }

    const percent = goal > 0 ? Math.min((collected / goal) * 100, 100) : 0;
    const remaining = Math.max(goal - collected, 0);

    window._goalDonutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Collected', 'Remaining'],
            datasets: [{
                data: [collected, remaining],
                backgroundColor: ['#667eea', 'rgba(102, 126, 234, 0.12)'],
                borderWidth: 0,
                cutout: '75%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: { duration: 700 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ₹' + context.raw.toLocaleString('en-IN');
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'centerText',
            afterDraw(chart) {
                const { ctx: c, chartArea } = chart;
                const centerX = (chartArea.left + chartArea.right) / 2;
                const centerY = (chartArea.top + chartArea.bottom) / 2;

                c.save();
                c.textAlign = 'center';
                c.textBaseline = 'middle';

                c.font = 'bold 26px Inter, sans-serif';
                c.fillStyle = '#667eea';
                c.fillText(Math.round(percent) + '%', centerX, centerY - 8);

                c.font = '11px Inter, sans-serif';
                c.fillStyle = '#6c757d';
                c.fillText('of Goal', centerX, centerY + 14);

                c.restore();
            }
        }]
    });
}

// --------------------
// Progress Milestones
function renderMilestones(progressPercent) {
    const container = document.getElementById('progressMilestones');
    if (!container) return;

    const milestones = [25, 50, 75, 100];
    container.innerHTML = '';

    milestones.forEach(m => {
        const badge = document.createElement('span');
        badge.className = 'milestone-badge ' + (progressPercent >= m ? 'achieved' : 'pending');
        badge.textContent = (progressPercent >= m ? '✓ ' : '') + m + '%';
        container.appendChild(badge);
    });
}

// --------------------
// Parse contribution date: use date part only so month is never wrong
function parseContributionDate(value) {
    if (value == null) return null;

    if (typeof value === 'number') {
        if (value > 0 && value < 100000) {
            const epoch = new Date(1899, 11, 30).getTime();
            const d = new Date(epoch + value * 86400000);
            return isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }

    if (typeof value !== 'string') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }

    const s = value.trim();
    if (!s) return null;

    if (/^-?\d+$/.test(s)) {
        const n = parseInt(s, 10);
        if (n > 0 && n < 100000) {
            const epoch = new Date(1899, 11, 30).getTime();
            const d = new Date(epoch + n * 86400000);
            return isNaN(d.getTime()) ? null : d;
        }
        if (n > 1e12) {
            const d = new Date(n);
            return isNaN(d.getTime()) ? null : d;
        }
    }

    // YYYY-MM-DD or YYYY-MM-DD HH:mm:ss
    const iso = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
    if (iso) {
        const y = parseInt(iso[1], 10);
        const mo = parseInt(iso[2], 10) - 1;
        const day = parseInt(iso[3], 10);
        const hh = iso[4] ? parseInt(iso[4], 10) : 0;
        const mm = iso[5] ? parseInt(iso[5], 10) : 0;
        const ss = iso[6] ? parseInt(iso[6], 10) : 0;
        const d = new Date(y, mo, day, hh, mm, ss);
        return isNaN(d.getTime()) ? null : d;
    }

    // DD/MM/YYYY or DD-MM-YYYY (day > 12 unambiguously; else treat as DD/MM)
    const slash = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (slash) {
        const a = parseInt(slash[1], 10), b = parseInt(slash[2], 10), y = parseInt(slash[3], 10);
        let month, day;
        if (a > 12) {
            day = a;
            month = b - 1;
        } else if (b > 12) {
            month = a - 1;
            day = b;
        } else {
            day = a;
            month = b - 1;
        }
        const d = new Date(y, month, day);
        return isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d;
}

// --------------------
// Shared: monthly breakdown (calendar months; optional per-day visibility)
// Uses each contribution's Date. API must send the actual contribution date per row;
// if the backend sends the same timestamp for every row, all amounts show in one month.
function getMonthlyBreakdown(contributions) {
    const byMonth = {};
    contributions.forEach(c => {
        const d = parseContributionDate(c.Date);
        if (!d) return;
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        const amount = Number(c.Amount) || 0;
        if (!byMonth[key]) {
            byMonth[key] = { total: 0, count: 0, label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), days: [] };
        }
        byMonth[key].total += amount;
        byMonth[key].count += 1;
        const dayNum = d.getDate();
        if (!byMonth[key].days.includes(dayNum)) byMonth[key].days.push(dayNum);
    });
    Object.keys(byMonth).forEach(k => byMonth[k].days.sort((a, b) => a - b));
    return byMonth;
}

// --------------------
// Giving Pace Calculator (month-aware, with explicit monthly breakdown)
function renderGivingPace(contributions, goalAmount, totalCollected) {
    const paceEl = document.getElementById('givingPace');
    if (!paceEl) return;

    const remaining = Math.max(goalAmount - totalCollected, 0);
    if (remaining <= 0) {
        paceEl.innerHTML = '🎉 <strong>Goal achieved!</strong> Praise the Lord for your faithfulness!';
        paceEl.classList.add('giving-pace-loaded');
        return;
    }

    const byMonth = getMonthlyBreakdown(contributions);
    const monthKeys = Object.keys(byMonth).sort();
    const monthsWithData = monthKeys.length;
    if (monthsWithData === 0) {
        paceEl.textContent = '';
        return;
    }

    const avgPerMonth = totalCollected / monthsWithData;
    const monthsToGoal = Math.ceil(remaining / avgPerMonth);
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + monthsToGoal);
    const dateStr = targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const monthLabels = monthKeys.map(k => byMonth[k].label);
    const rangeLabel = monthLabels.length >= 2 ? `${monthLabels[0]} – ${monthLabels[monthLabels.length - 1]}` : monthLabels[0];

    let monthSummaryHtml = '';
    monthKeys.forEach(k => {
        const M = byMonth[k];
        const daysStr = (M.days && M.days.length) ? ' on ' + M.days.map(d => d + (d === 1 || d === 21 || d === 31 ? 'st' : d === 2 || d === 22 ? 'nd' : d === 3 || d === 23 ? 'rd' : 'th')).join(', ') : '';
        monthSummaryHtml += `<span class="pace-month-item">${M.label}: ₹${Math.round(M.total).toLocaleString('en-IN')} (${M.count} contribution${M.count !== 1 ? 's' : ''}${daysStr})</span>`;
    });

    paceEl.innerHTML = `
        <div class="giving-pace-main">📈 Based on <strong>${monthsWithData} month${monthsWithData !== 1 ? 's' : ''}</strong> of data (${rangeLabel}), average <strong>₹${Math.round(avgPerMonth).toLocaleString('en-IN')}/month</strong> → goal by <strong>${dateStr}</strong>.</div>
        <div class="giving-pace-breakdown" id="givingPaceBreakdown">${monthSummaryHtml}</div>
    `;
    paceEl.classList.add('giving-pace-loaded');
}

// --------------------
// Giving Insights (uses same monthly breakdown as pace)
function renderGivingInsights(contributions, goalAmount) {
    const grid = document.getElementById('insightsGrid');
    if (!grid) return;

    const totalAmount = contributions.reduce((sum, c) => sum + (Number(c.Amount) || 0), 0);
    const uniqueMembers = new Set(contributions.map(c => c.Member).filter(Boolean)).size;
    const avgContribution = contributions.length > 0 ? Math.round(totalAmount / contributions.length) : 0;
    const avgPerPerson = uniqueMembers > 0 ? Math.round(totalAmount / uniqueMembers) : 0;

    const sources = { Online: 0, Manual: 0 };
    contributions.forEach(c => {
        const amt = Number(c.Amount) || 0;
        const notes = (c.Notes || "").toLowerCase();
        const category = (c.Category || "").toLowerCase();
        if (notes.includes("razorpay") || notes.includes("online") || category.includes("online")) {
            sources.Online += amt;
        } else {
            sources.Manual += amt;
        }
    });

    const byMonth = getMonthlyBreakdown(contributions);
    const monthEntries = Object.entries(byMonth).map(([k, v]) => [v.label, v.total]);
    const bestMonth = monthEntries.sort((a, b) => b[1] - a[1])[0];

    const remaining = Math.max(goalAmount - totalAmount, 0);
    const monthsWithData = Object.keys(byMonth).length;
    const avgPerMonth = monthsWithData > 0 ? totalAmount / monthsWithData : 0;
    const monthsToGoal = avgPerMonth > 0 ? Math.ceil(remaining / avgPerMonth) : 0;
    const moreNeeded = avgContribution > 0 ? Math.ceil(remaining / avgContribution) : 0;
    const contributorList = getTopContributors(contributions, 1000);
    const monthKeysSorted = Object.keys(byMonth).sort();
    const monthlyBreakdown = monthKeysSorted.map(k => ({
        label: byMonth[k].label,
        total: byMonth[k].total,
        count: byMonth[k].count
    }));

    const trend = calculateTrend(contributions);

    const insights = [
        { key: 'unique', icon: '👥', value: uniqueMembers, label: 'Unique Contributors',
            detail: avgPerPerson > 0 ? '₹' + avgPerPerson.toLocaleString('en-IN') + ' per person' : '' },
        { key: 'avg', icon: '💰', value: '₹' + avgContribution.toLocaleString('en-IN'), label: 'Avg Contribution',
            detail: contributions.length + ' total entries' },
        { key: 'bestMonth', icon: '📅', value: bestMonth ? bestMonth[0] : 'N/A', label: 'Most Active Month',
            detail: trend.direction !== 'neutral' ? `${trend.icon} ${Math.abs(trend.percent)}% vs last mo` : 'Stable giving pace' },
        { key: 'estimated', icon: '🎯',
            value: remaining > 0 ? (monthsToGoal > 0 ? '~' + monthsToGoal + ' mo' : 'Keep going!') : 'Done!',
            label: remaining > 0 ? 'Goal Timeline' : 'Goal Reached! 🎉',
            detail: remaining > 0 ? `At ₹${Math.round(avgPerMonth).toLocaleString('en-IN')}/mo` : 'Praise the Lord!' },
        { key: 'source', icon: '🔀', value: (totalAmount > 0 ? Math.round((sources.Online / totalAmount) * 100) : 0) + '%', label: 'Online / UPI Share',
            detail: `₹${sources.Online.toLocaleString('en-IN')} Online · ₹${sources.Manual.toLocaleString('en-IN')} Manual` }
    ];

    window.__insightContext = {
        goalAmount, totalAmount, remaining, entryCount: contributions.length,
        uniqueMembers, avgContribution, avgPerPerson, bestMonth,
        monthsToGoal, moreNeeded, monthsWithData: Object.keys(byMonth).length,
        contributorList, monthlyBreakdown, avgPerMonth, sources
    };

    grid.innerHTML = '';
    insights.forEach(insight => {
        const card = document.createElement('div');
        card.className = 'insight-card';
        card.setAttribute('data-insight-type', insight.key);
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', insight.label + ' - click for calculation details');
        card.innerHTML = `
            <div class="insight-icon">${insight.icon}</div>
            <div class="insight-value">${insight.value}</div>
            <div class="insight-label">${insight.label} <span class="card-info-icon">ℹ️</span></div>
            <div class="insight-detail">${insight.detail}</div>
        `;
        grid.appendChild(card);
    });
}

// --------------------
// Distribution Pie Chart (shares with percentage)
function renderDistributionPie(contributions) {
    const canvas = document.getElementById('distributionPieChart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (!contributions || contributions.length === 0) return;

    const memberMap = {};
    contributions.forEach(c => {
        const member = c.Member || 'Anonymous';
        memberMap[member] = (memberMap[member] || 0) + (Number(c.Amount) || 0);
    });

    const sorted = Object.entries(memberMap).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 8);
    const othersTotal = sorted.slice(8).reduce((sum, [, amt]) => sum + amt, 0);

    const labels = top.map(([name]) => name);
    const data = top.map(([, amt]) => amt);

    if (othersTotal > 0) {
        labels.push('Others');
        data.push(othersTotal);
    }

    const colors = [
        '#667eea', '#764ba2', '#f093fb', '#4facfe',
        '#43e97b', '#fa709a', '#fee140', '#30cfd0',
        '#a8edea'
    ];

    const ctx = canvas.getContext('2d');
    if (window._distributionPieChart && typeof window._distributionPieChart.destroy === 'function') {
        window._distributionPieChart.destroy();
    }

    window._distributionPieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 700, easing: 'easeOutQuart' },
            plugins: {
                legend: { position: 'bottom', labels: { font: { size: 12, family: 'Inter' }, padding: 16 } },
                title: {
                    display: true,
                    text: '🥧 Contribution Share by Member',
                    font: { size: 16, weight: 'bold', family: 'Inter' }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#333',
                    bodyColor: '#666',
                    borderColor: '#667eea',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = Math.round((context.raw / total) * 100);
                            return ` ${context.label}: ₹${Number(context.raw).toLocaleString('en-IN')} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

// --------------------
// Trend Chart (Line Chart for Growth)
function renderTrendChart(contributions, type = 'collected') {
    const modalBody = document.getElementById('insightModalBody');
    const modalTitle = document.getElementById('insightModalTitle');
    const modal = document.getElementById('insightModal');
    
    if (!modalBody || !modalTitle || !modal) return;

    modalTitle.textContent = type === 'collected' ? '📈 Collection Growth Trend' : '📊 Contribution Frequency';
    modalBody.innerHTML = `
        <p style="margin-bottom: 20px; font-size: 14px; color: #64748b;">
            ${type === 'collected' 
                ? 'Tracking the cumulative collection over time. Each point represents the total amount reached on that date.'
                : 'Tracking the number of contributions over time.'}
        </p>
        <div style="height: 300px; width: 100%; position: relative;">
            <canvas id="trendLineChart"></canvas>
        </div>
        <div id="trendSummary" style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 12px; font-size: 13px;">
            Loading summary...
        </div>
    `;

    modal.classList.add('insight-modal-visible');

    // Process data for trend chart
    const sorted = [...contributions]
        .map(c => ({ ...c, DateObj: parseContributionDate(c.Date) }))
        .filter(c => c.DateObj)
        .sort((a, b) => a.DateObj - b.DateObj);

    const labels = [];
    const dataPoints = [];
    let runningTotal = 0;

    // Group by date to show cleaner line
    const dateMap = {};
    sorted.forEach(c => {
        const dStr = c.DateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const val = Number(c.Amount) || 0;
        if (!dateMap[dStr]) dateMap[dStr] = { amt: 0, count: 0 };
        dateMap[dStr].amt += val;
        dateMap[dStr].count += 1;
    });

    Object.entries(dateMap).forEach(([date, vals]) => {
        labels.push(date);
        if (type === 'collected') {
            runningTotal += vals.amt;
            dataPoints.push(runningTotal);
        } else {
            runningTotal += vals.count;
            dataPoints.push(runningTotal);
        }
    });

    const ctx = document.getElementById('trendLineChart').getContext('2d');
    
    if (window._currentTrendChart) window._currentTrendChart.destroy();

    window._currentTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: type === 'collected' ? 'Total Collected (₹)' : 'Total Count',
                data: dataPoints,
                borderColor: type === 'collected' ? '#10b981' : '#8b5cf6',
                backgroundColor: type === 'collected' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#fff',
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: ${type === 'collected' ? '₹' : ''}${context.raw.toLocaleString('en-IN')}`;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                y: { 
                    beginAtZero: true, 
                    grid: { color: '#f1f5f9' },
                    ticks: { font: { size: 10 }, callback: value => type === 'collected' ? '₹' + value.toLocaleString('en-IN') : value }
                }
            }
        }
    });

    const summaryEl = document.getElementById('trendSummary');
    if (summaryEl) {
        const total = dataPoints[dataPoints.length - 1];
        const days = labels.length;
        const avg = Math.round(total / (days || 1));
        summaryEl.innerHTML = `
            <strong>Performance Summary:</strong><br>
            • Projected pace: ${type === 'collected' ? '₹' + avg.toLocaleString('en-IN') : avg + ' entries'} per recorded day.<br>
            • Current milestone: ${type === 'collected' ? '₹' : ''}${total.toLocaleString('en-IN')} reached over ${days} active donation days.
        `;
    }
}

// --------------------
// Source Distribution Chart (Online vs Manual)
function renderSourceChart(contributions) {
    const canvas = document.getElementById('sourcePieChart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (!contributions || contributions.length === 0) return;

    const sources = { Online: 0, Manual: 0 };
    contributions.forEach(c => {
        const amt = Number(c.Amount) || 0;
        const notes = (c.Notes || "").toLowerCase();
        const category = (c.Category || "").toLowerCase();
        if (notes.includes("razorpay") || notes.includes("online") || category.includes("online")) {
            sources.Online += amt;
        } else {
            sources.Manual += amt;
        }
    });

    const ctx = canvas.getContext('2d');
    if (window._sourcePieChart && typeof window._sourcePieChart.destroy === 'function') {
        window._sourcePieChart.destroy();
    }

    window._sourcePieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Online / UPI', 'Manual (Cash/GPay)'],
            datasets: [{
                data: [sources.Online, sources.Manual],
                backgroundColor: ['#667eea', '#f1c40f'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: { position: 'bottom', labels: { font: { size: 12, family: 'Inter' }, padding: 16 } },
                title: {
                    display: true,
                    text: '🔀 Contribution Channel (Amount)',
                    font: { size: 16, weight: 'bold', family: 'Inter' }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? Math.round((context.raw / total) * 100) : 0;
                            return ` ${context.label}: ₹${Number(context.raw).toLocaleString('en-IN')} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * TREND CALCULATOR: Compares this month vs last month
 */
function calculateTrend(contributions) {
    const now = new Date();
    const currentMonthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = lastMonth.getFullYear() + '-' + String(lastMonth.getMonth() + 1).padStart(2, '0');

    let currentTotal = 0, lastTotal = 0;
    let currentCount = 0, lastCount = 0;

    contributions.forEach(c => {
        const d = parseContributionDate(c.Date);
        if (!d) return;
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        if (key === currentMonthKey) {
            currentTotal += Number(c.Amount) || 0;
            currentCount++;
        }
        if (key === lastMonthKey) {
            lastTotal += Number(c.Amount) || 0;
            lastCount++;
        }
    });

    const diff = currentTotal - lastTotal;
    const percent = lastTotal > 0 ? Math.round((diff / lastTotal) * 100) : 0;
    const direction = diff > 0 ? 'up' : (diff < 0 ? 'down' : 'neutral');
    const icon = diff > 0 ? '📈' : (diff < 0 ? '📉' : '➖');

    return { percent, direction, icon, currentTotal, lastTotal, currentCount, lastCount };
}

// --------------------
// Last Updated Indicator
function updateLastUpdated(fundKey) {
    const el = document.getElementById('lastUpdated');
    if (!el) return;

    const raw = localStorage.getItem(fundKey);
    if (!raw) return;

    try {
        const parsed = JSON.parse(raw);
        if (parsed.lastFetched) {
            const ago = Math.round((Date.now() - parsed.lastFetched) / 1000);
            let timeStr;
            if (ago < 60) timeStr = 'just now';
            else if (ago < 3600) timeStr = Math.round(ago / 60) + ' min ago';
            else timeStr = Math.round(ago / 3600) + ' hr ago';
            el.textContent = '🔄 Data updated ' + timeStr;
        }
    } catch (e) { /* ignore */ }
}

// --------------------
// Silent Background Refresh
async function silentBackgroundRefresh(selectedFund) {
    const indicator = document.getElementById('updateIndicator');

    try {
        let apiUrl, fundKey;
        if (selectedFund === 'christmasfund') {
            apiUrl = "/api/contributions?fund=christmas-fund";
            fundKey = "christmasFundData";
        } else {
            apiUrl = "/api/contributions?fund=tech-contributions";
            fundKey = "techFundData";
        }

        // Show subtle indicator
        if (indicator) indicator.style.display = 'flex';

        const res = await fetch(apiUrl + '&_t=' + Date.now(), { credentials: 'omit', cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();

        // Compare with cached data
        const oldCached = getCachedFund(fundKey);
        const oldCount = oldCached ? (oldCached.contributions || []).length : 0;
        const newCount = (data.contributions || []).length;

        // Save new data to cache
        setCachedFund(fundKey, { contributions: data.contributions || [], goalAmount: data.goalAmount || 0 });

        // If data changed, reload dashboard silently
        if (newCount !== oldCount) {
            console.log('[BACKGROUND] Data changed! Refreshing UI...');
            // Trigger a re-render by re-initializing
            if (selectedFund === 'christmasfund') {
                await initChristmasFundDashboard();
            } else {
                await initDashboard();
            }
        }

        // Update last updated indicator
        updateLastUpdated(fundKey);

        console.log('[BACKGROUND] Silent refresh complete');
    } catch (err) {
        console.error('[BACKGROUND] Refresh error:', err);
    } finally {
        if (indicator) {
            setTimeout(() => { indicator.style.display = 'none'; }, 1500);
        }
    }
}

// ==================================================
// HERO GREETING (time-aware, personalized greeting)
// ==================================================
function renderHeroGreeting() {
    const section = document.getElementById("heroGreeting");
    if (!section) return;

    try {
        const profile = JSON.parse(sessionStorage.getItem("ljmAuthProfile") || "null");
        if (!profile || !profile.email) {
            section.style.display = "none";
            return;
        }

        const firstName = (profile.name || profile.email).split(" ")[0].trim();
        const hour = new Date().getHours();
        let timeGreeting = "Hello";
        if (hour < 12) timeGreeting = "Good morning";
        else if (hour < 18) timeGreeting = "Good afternoon";
        else timeGreeting = "Good evening";

        const emojis = ["🙏", "✝️", "🕊️", "💫"];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];

        document.getElementById("greetingText").textContent = `${timeGreeting}, ${firstName} ${emoji}`;
        section.style.display = "block";
    } catch (_) {
        section.style.display = "none";
    }
}

// ==================================================
// TAB SYSTEM (Part 2: Dashboard Redesign)
// ==================================================
let chartsRendered = false;

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');

            // Update button states
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update panel visibility
            tabPanels.forEach(panel => panel.classList.remove('active'));
            const activePanel = document.getElementById(`tab-${tabName}`);
            if (activePanel) activePanel.classList.add('active');

            // Lazy-render charts on Analytics tab activation
            if (tabName === 'analytics' && !chartsRendered && window._currentContributions) {
                chartsRendered = true;
                setTimeout(() => {
                    const contributions = window._currentContributions || [];
                    renderCategoryPie(contributions);
                    renderDistributionPie(contributions);
                    renderSourceChart(contributions);
                    renderEnhancedStats(contributions);
                }, 50);
            }
        });
    });
}

// ==================================================
// MAIN INITIALIZATION
// ==================================================
document.addEventListener("DOMContentLoaded", async () => {
    // --------------------
    // Clear cache on hard refresh (F5, Ctrl+R, Ctrl+Shift+R) so user always gets fresh data
    try {
        if (window.performance) {
            const navEntries = performance.getEntriesByType("navigation");
            if (navEntries.length > 0 && navEntries[0].type === "reload") {
                localStorage.removeItem("techFundData");
                localStorage.removeItem("christmasFundData");
                console.log("[CACHE] Cache cleared on page reload - will fetch fresh data");
            }
        }
    } catch (_) { /* performance API not available */ }

    // --------------------
    // Determine which fund to load
    const params = new URLSearchParams(window.location.search);
    let selectedFund = params.get("fund") || "tech";
    selectedFund = selectedFund.toLowerCase().replace(/\s+/g, '');

    const fundKey = selectedFund === "christmasfund" ? "christmasFundData" : "techFundData";
    const hasCachedData = getCachedFund(fundKey) !== null;

    // --------------------
    // SMART LOADER: Only show if no cached data exists
    let loader = null;

    if (!hasCachedData) {
        loader = document.createElement("div");
        loader.id = "startupLoader";
        loader.innerHTML = `
            <div class="loader-symbol">
                <span>LJM</span>
                <div class="halo"></div>
            </div>
            <div class="loader-text">Preparing your dashboard…</div>
        `;
        Object.assign(loader.style, {
            position: "fixed", top: "0", left: "0", width: "100%", height: "100%",
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            display: "flex", flexDirection: "column",
            justifyContent: "center", alignItems: "center",
            zIndex: "999999", opacity: "1", transition: "opacity 0.5s ease",
            pointerEvents: "none"
        });

        if (document.body) {
            document.body.appendChild(loader);
        } else if (document.documentElement) {
            document.documentElement.appendChild(loader);
        }

        // Add loader animations
        const style = document.createElement("style");
        style.innerHTML = `
            #startupLoader { position: fixed !important; z-index: 999999 !important; }
            .loader-symbol { position: relative; width:100px; height:100px; display:flex; justify-content:center; align-items:center; font-size:32px; font-weight:bold; color:#667eea; animation:loaderPulse 1.5s infinite alternate; z-index:1; }
            .loader-symbol .halo { position:absolute; width:120px; height:120px; border:4px solid #667eea; border-radius:50%; animation:loaderRotate 2s linear infinite; box-shadow: 0 0 20px rgba(102, 126, 234, 0.5); z-index:0; }
            .loader-text { margin-top:80px; color:#fff; font-size:18px; font-weight:500; text-align:center; z-index:2; position:relative; }
            @keyframes loaderRotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes loaderPulse { 0% { transform: scale(1); text-shadow:0 0 10px rgba(102, 126, 234, 0.8); } 100% { transform: scale(1.2); text-shadow:0 0 20px rgba(102, 126, 234, 1); } }
        `;
        document.head.appendChild(style);
        console.log("[LOADER] Showing loader — no cached data");
    } else {
        console.log("[FAST LOAD] ⚡ Cached data found — instant load, no loader!");
    }

    // --------------------
    // Initialize Bible verse immediately (doesn't need data)
    initBibleVerse();

    // Load pastor-curated Verse of the Month / Year cards
    loadChurchVerses();

    // --------------------
    // Modal for "how we calculate" (stat and insight cards)
    initInsightModal();

    // --------------------
    // Initialize dashboard
    console.log("Initializing dashboard for fund:", selectedFund);

    try {
        const LEGACY_TECH = ["tech", "techfund", "tech-contributions"];
        const LEGACY_XMAS = ["christmas", "christmasfund", "christmas-fund"];

        if (LEGACY_XMAS.includes(selectedFund)) {
            await initChristmasFundDashboard();
        } else if (LEGACY_TECH.includes(selectedFund)) {
            await initDashboard();
        } else {
            // Dynamic fund: same dashboard pipeline, served by /api/funds?slug=…
            await initDashboard({ slug: selectedFund });
        }

        const heading = document.getElementById("fundHeading");
        if (heading && (LEGACY_TECH.includes(selectedFund) || LEGACY_XMAS.includes(selectedFund))) {
            heading.textContent = selectedFund.includes("christmas")
                ? "🎄 Christmas Fund Contributions"
                : "💻 Tech Fund Contributions";
        }

        console.log("Dashboard initialized");
    } catch (err) {
        console.error("Error initializing dashboard:", err);
    }

    // --------------------
    // Remove loader (only if it was shown)
    if (loader) {
        await new Promise(resolve => setTimeout(resolve, 1200));
        if (loader.parentNode) {
            loader.style.opacity = "0";
            setTimeout(() => { if (loader.parentNode) loader.remove(); }, 500);
        }
    }

    // --------------------
    // Update last-updated timestamp
    updateLastUpdated(fundKey);

    // Load Stage Planned Wishlist
    loadHomeWishlist();

    // --------------------
    // Silent background refresh: if cached data was used, refresh silently after 8s
    if (hasCachedData) {
        setTimeout(() => {
            console.log("[BACKGROUND] Triggering silent refresh...");
            silentBackgroundRefresh(selectedFund);
        }, 8000);
    }

    // When user returns to tab (e.g. Android: reopen app): if cache is expired, refresh immediately
    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState !== "visible") return;
        const currentKey = selectedFund === "christmasfund" ? "christmasFundData" : "techFundData";
        if (getCachedFund(currentKey) === null) {
            console.log("[CACHE] Tab visible and cache expired - refreshing in background");
            silentBackgroundRefresh(selectedFund);
        }
    });

    // Fallback: force remove loader after 15s
    if (loader) {
        setTimeout(() => {
            if (loader && loader.parentNode) {
                loader.style.opacity = "0";
                setTimeout(() => { if (loader.parentNode) loader.remove(); }, 300);
            }
        }, 15000);
    }
});


// ==================================================
// TECH FUND DASHBOARD
// ==================================================
async function initDashboard(dynamicFund) {
    // dynamicFund: { slug } — reuses this whole pipeline for admin-created funds
    // (the /api/funds?slug= payload is shaped identically to /api/contributions)
    const API_URL = dynamicFund
        ? "/api/funds?slug=" + encodeURIComponent(dynamicFund.slug)
        : "/api/contributions?fund=tech-contributions";
    const FUND_KEY = dynamicFund ? "fundData_" + dynamicFund.slug : "techFundData";

    let contributionsData = [];
    let goalAmount = 0;
    let currentDisplayCount = 0;

    const heading = document.getElementById("fundHeading");
    if (heading) heading.textContent = dynamicFund ? "⛪ Loading fund…" : "💻 Tech Fund Contributions";

    const subtitle = document.getElementById("fundSubtitle");
    if (subtitle) subtitle.textContent = "Let your contributions bring glory to Jesus";

    const banner = document.getElementById("motivationalBanner");
    if (banner) banner.style.display = "block";

    const fetchData = async () => {
        try {
            const res = await fetch(API_URL + '&_t=' + Date.now(), { credentials: 'omit', cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            contributionsData = data.contributions || [];
            window._currentContributions = contributionsData;
            window._memberEmails = data.memberEmails || {};
            window._memberPhones = data.memberPhones || {};
            window._memberStatus = data.memberStatus || {};
            goalAmount = data.goalAmount || 0;
            // Dynamic funds carry their display name in the payload
            if (dynamicFund && data.fund && heading) {
                heading.textContent = "⛪ " + data.fund.name + " Contributions";
                if (subtitle && data.fund.description) subtitle.textContent = data.fund.description;
            }
            // NEW: "What We Bought" aggregates for this fund
            window._spentOnProducts = Number(data.spentOnProducts) || 0;
            window._productsBoughtCount = Number(data.productsBoughtCount) || 0;
            // LOCAL PREVIEW: override from mock if running on file:// or ?mock=1
            if (window.__LJM_USE_MOCK_PURCHASES__ && window.__LJM_PURCHASES_MOCK__) {
                const mock = window.__LJM_PURCHASES_MOCK__;
                const techKey = "Tech Fund";
                const fundSpent = (mock.fundContribByFund && mock.fundContribByFund[techKey]) || 0;
                const fundCount = (mock.purchases || []).filter(p => p.fund === techKey).length;
                window._spentOnProducts = fundSpent;
                window._productsBoughtCount = fundCount;
            }
            setCachedFund(FUND_KEY, {
                contributions: contributionsData,
                goalAmount,
                memberEmails: window._memberEmails,
                memberPhones: window._memberPhones,
                memberStatus: window._memberStatus,
                spentOnProducts: window._spentOnProducts,
                productsBoughtCount: window._productsBoughtCount
            });
            currentDisplayCount = 0;
            renderHeroGreeting();
            initTabs();
            renderDashboard();
            renderTopContributors(contributionsData);
            document.dispatchEvent(new CustomEvent('LJM_DATA_READY', {
                detail: { fund: 'tech', members: Array.from(new Set(contributionsData.map(c => c.member))) }
            }));
        } catch (err) {
            console.error("Error fetching Tech Fund:", err);
            const cached = getCachedFund(FUND_KEY, true);
            if (cached) {
                contributionsData = cached.contributions || [];
                window._currentContributions = contributionsData;
                window._memberEmails = cached.memberEmails || {};
                window._memberPhones = cached.memberPhones || {};
                window._memberStatus = cached.memberStatus || {};
                goalAmount = cached.goalAmount || 0;
                window._spentOnProducts = Number(cached.spentOnProducts) || 0;
                window._productsBoughtCount = Number(cached.productsBoughtCount) || 0;
                // LOCAL PREVIEW: apply mock override when running from file:// or ?mock=1
                if (window.__LJM_USE_MOCK_PURCHASES__ && window.__LJM_USE_MOCK_PURCHASES__) {
                    const mock = window.__LJM_PURCHASES_MOCK__;
                    const techKey = "Tech Fund";
                    window._spentOnProducts = (mock.fundContribByFund && mock.fundContribByFund[techKey]) || 0;
                    window._productsBoughtCount = (mock.purchases || []).filter(p => p.fund === techKey).length;
                }
                currentDisplayCount = 0;
                renderHeroGreeting();
                initTabs();
                renderDashboard();
                renderTopContributors(contributionsData);
            } else {
                // Render error state if API fails and no cached data is available at all
                contributionsData = [];
                goalAmount = 0;
                window._spentOnProducts = 0;
                window._productsBoughtCount = 0;
                initTabs();
                renderDashboard([]);
                const timeline = document.getElementById("timelineContainer");
                if (timeline) {
                    timeline.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-icon">⚠️</div>
                            <h3>Connection Timeout</h3>
                            <p>Unable to retrieve contributions data from the server. Please check your internet or try refreshing.</p>
                        </div>
                    `;
                }
            }
        }
    };

    const renderDashboard = (filteredData = null) => {
        try {
            const data = filteredData || contributionsData;
            const timeline = document.getElementById("timelineContainer");
            if (!timeline) return;
            timeline.innerHTML = "";

            const contributors = getContributorsAlpha(data);

            if (contributors.length === 0) {
                timeline.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">💫</div>
                        <h3>No contributions yet</h3>
                        <p>Be the first to contribute to our Tech Fund!</p>
                    </div>
                `;
            } else {
                const itemsPerPage = 15;
                if (currentDisplayCount === 0) currentDisplayCount = itemsPerPage;
                const currentPage = Math.floor((currentDisplayCount - 1) / itemsPerPage);
                const startIdx = currentPage * itemsPerPage;
                const endIdx = Math.min(startIdx + itemsPerPage, contributors.length);
                const displayContributors = contributors.slice(startIdx, endIdx);

                const sectionTitle = document.createElement("h3");
                sectionTitle.className = "section-title contributors-title";
                sectionTitle.textContent = contributors.length >= 16
                    ? `👥 All Contributors · A–Z (${contributors.length} total)`
                    : "👥 All Contributors · A–Z";
                timeline.appendChild(sectionTitle);

                const grid = document.createElement("div");
                grid.className = "contributors-grid";

                displayContributors.forEach((contributor, index) => {
                    const card = document.createElement("div");
                    card.className = "contributor-card";
                    const rank = startIdx + index + 1;
                    let medal = "";

                    const safeMember = escapeHtml(contributor.Member);
                    card.style.cursor = 'pointer';
                    card.setAttribute('role', 'button');
                    card.setAttribute('tabindex', '0');
                    card.onclick = () => openContributorDetailModal(contributor.Member, data);
                    card.innerHTML = `
                        <div class="contributor-rank">${medal} #${rank}</div>
                        <div class="contributor-avatar">${safeMember.charAt(0).toUpperCase()}</div>
                        <div class="contributor-name">${safeMember}</div>
                        <div class="contributor-amount">₹${contributor.Total.toLocaleString('en-IN')}</div>
                        <div class="contributor-count">${contributor.Entries} contribution${contributor.Entries !== 1 ? 's' : ''}</div>
                    `;
                    grid.appendChild(card);
                });

                timeline.appendChild(grid);

                if (contributors.length >= 16) {
                    const paginationContainer = document.createElement("div");
                    paginationContainer.className = "pagination-container";

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

                    if (endIdx < contributors.length) {
                        const showMoreBtn = document.createElement("button");
                        showMoreBtn.className = "pagination-nav-btn";
                        showMoreBtn.textContent = `Show More (${contributors.length - endIdx} remaining)`;
                        showMoreBtn.onclick = () => {
                            currentDisplayCount = Math.min(contributors.length, currentDisplayCount + itemsPerPage);
                            renderDashboard(filteredData);
                        };
                        paginationContainer.appendChild(showMoreBtn);
                    }

                    if (paginationContainer.children.length > 0) {
                        timeline.appendChild(paginationContainer);
                    }
                }
            }

            // ---- STATS (single source of truth: all from data) ----
            const totalCollected = data.reduce((sum, c) => sum + (Number(c.Amount) || 0), 0);
            const remaining = Math.max(goalAmount - totalCollected, 0);
            const progressPercent = goalAmount > 0 ? Math.min((totalCollected / goalAmount) * 100, 100) : 0;
            const uniqueContributors = new Set(data.map(c => c.Member).filter(Boolean)).size;
            const avgContribution = data.length > 0 ? Math.round(totalCollected / data.length) : 0;

            // ---- TRENDS ----
            const trend = calculateTrend(data);
            const lastDataCount = (data.length - (trend.direction !== 'neutral' ? 1 : 0)); // simple mock for prev count

            // Animated stat values
            animateValue("goalAmount", goalAmount, "🎯 ₹");
            animateValue("totalAmount", totalCollected, "💰 ₹");
            if (remaining > 0) {
                animateValue("remainingAmount", remaining, "⏳ ₹");
            } else {
                document.getElementById("remainingAmount").innerHTML = "🎉 Goal Achieved!";
            }
            animateValue("entryCount", data.length, "📝 ");

            // NEW: "What We Bought" math — Spent & Available Balance
            const spent = Number(window._spentOnProducts) || 0;
            const productsCount = Number(window._productsBoughtCount) || 0;
            const availableBalance = Math.max(totalCollected - spent, 0);

            const spentEl = document.getElementById("spentAmount");
            if (spentEl) animateValue("spentAmount", spent, "🛍️ ₹");
            const spentSub = document.getElementById("spentSubdetail");
            if (spentSub) {
                spentSub.innerHTML = productsCount > 0
                    ? `${productsCount} ${productsCount === 1 ? "item" : "items"} bought · <a href="impact.html" style="color:#667eea; font-weight:700;">See details →</a>`
                    : `<a href="impact.html" style="color:#667eea; font-weight:700;">Nothing bought yet — see all →</a>`;
            }

            const balanceEl = document.getElementById("balanceAmount");
            if (balanceEl) animateValue("balanceAmount", availableBalance, "💼 ₹");
            const balanceSub = document.getElementById("balanceSubdetail");
            if (balanceSub) {
                balanceSub.textContent = spent > 0
                    ? `Collected ₹${Number(totalCollected).toLocaleString("en-IN")} − Spent ₹${spent.toLocaleString("en-IN")}`
                    : "Money in hand right now";
            }

            // Render Trend Badges
            updateTrendIndicator("totalSubdetail", trend);
            updateTrendIndicator("countSubdetail", {
                direction: trend.currentCount > trend.lastCount ? 'up' : (trend.currentCount < trend.lastCount ? 'down' : 'neutral'),
                percent: trend.lastCount > 0 ? Math.abs(Math.round(((trend.currentCount - trend.lastCount) / trend.lastCount) * 100)) : 0,
                icon: trend.currentCount > trend.lastCount ? '📈' : '📉'
            });

            // Sub-details for stat cards
            const goalSub = document.getElementById("goalSubdetail");
            if (goalSub) goalSub.textContent = "For the glory of God";
            const remainSub = document.getElementById("remainingSubdetail");
            if (remainSub) remainSub.textContent = remaining > 0 ? "Keep giving — we're getting closer!" : "Praise the Lord! 🙌";

            // Motivational banner based on progress
            if (banner) {
                banner.style.display = "block";
                if (progressPercent >= 100) {
                    banner.innerHTML = `<div class="banner-content"><span class="banner-icon">🎉</span><div class="banner-text"><strong>Goal Achieved! Praise the Lord!</strong><span>Thank you for your faithful giving to the church</span></div></div>`;
                } else if (progressPercent >= 75) {
                    banner.innerHTML = `<div class="banner-content"><span class="banner-icon">🔥</span><div class="banner-text"><strong>We're almost there! ${Math.round(100 - progressPercent)}% to go!</strong><span>Your contribution helps advance God's work in our church</span></div></div>`;
                } else {
                    banner.innerHTML = `<div class="banner-content"><span class="banner-icon">🙏</span><div class="banner-text"><strong>Every contribution matters!</strong><span>Your support helps advance technology for God's glory in our church</span></div></div>`;
                }
            }

            // Progress bar
            const progressBar = document.getElementById("progressBar");
            if (progressBar) {
                progressBar.style.width = progressPercent + "%";
                progressBar.innerText = Math.round(progressPercent) + "%";
                if (progressPercent < 50) {
                    progressBar.style.background = 'linear-gradient(90deg, #667eea, #764ba2)';
                } else if (progressPercent < 80) {
                    progressBar.style.background = 'linear-gradient(90deg, #764ba2, #667eea)';
                } else if (progressPercent < 100) {
                    progressBar.style.background = 'linear-gradient(90deg, #667eea, #5a67d8)';
                    progressBar.style.boxShadow = '0 0 15px rgba(102, 126, 234, 0.5)';
                } else {
                    progressBar.style.background = 'linear-gradient(90deg, #48bb78, #38a169)';
                    progressBar.style.boxShadow = '0 0 20px rgba(72, 187, 120, 0.7)';
                }
            }

            // Draw circular KPI progress ring
            window._currentProgressPercent = progressPercent;
            try { drawProgressRing(progressPercent); } catch (e) { console.error("KPI Progress Ring error:", e); }

            // ---- NEW FEATURES ----
            // Goal donut chart
            try { renderGoalDonut(totalCollected, goalAmount); } catch (e) { console.error("Donut error:", e); }

            // Milestones
            try { renderMilestones(progressPercent); } catch (e) { console.error("Milestones error:", e); }

            // Giving pace (uses same data for consistency)
            try { renderGivingPace(data, goalAmount, totalCollected); } catch (e) { console.error("Pace error:", e); }

            // Giving insights (sets __insightContext from same data)
            try { renderGivingInsights(data, goalAmount); } catch (e) { console.error("Insights error:", e); }

            // Distribution pie chart
            try { renderDistributionPie(data); } catch (e) { console.error("Distribution pie error:", e); }

            // Source distribution chart
            try { renderSourceChart(data); } catch (e) { console.error("Source chart error:", e); }

            // Top contributors
            try { renderTopContributors(data); } catch (e) { console.error("Top contributors error:", e); }

            // Recent activity (chronological, per-transaction feed)
            try { renderRecentActivityFeed(data, "recentActivityFeed"); } catch (e) { console.error("Recent activity error:", e); }

            // Enhanced Stats (time series + growth charts)
            const renderCharts = () => {
                if (typeof Chart !== 'undefined') {
                    try { renderEnhancedStats(data); } catch (e) {
                        const cc = document.getElementById('enhancedStatsContainer');
                        if (cc) cc.innerHTML = '<p style="text-align:center;color:#6c757d;padding:40px;">Unable to load statistics</p>';
                    }
                } else {
                    setTimeout(renderCharts, 200);
                }
            };
            if (document.readyState === 'complete') renderCharts();
            else { window.addEventListener('load', renderCharts); setTimeout(renderCharts, 500); }

        } catch (err) {
            console.error("Error in renderDashboard:", err);
        }
    };

    document.getElementById("searchInput").addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = contributionsData.filter(c => (c.Member || "").toLowerCase().includes(term));
        currentDisplayCount = 0;
        renderDashboard(filtered);
    });

    // Auto-refresh every 5 minutes
    setInterval(() => fetchData(), CACHE_TTL_MS);

    await fetchData();
    // Preload members list in background so Members page opens fast
    preloadMembersList();
}

// ==================================================
// CHRISTMAS FUND DASHBOARD
// ==================================================
async function initChristmasFundDashboard() {
    const API_URL = "/api/contributions?fund=christmas-fund";
    const FUND_KEY = "christmasFundData";

    let contributionsData = [];
    let goalAmount = 0;
    let currentDisplayCount = 0;

    const heading = document.getElementById("fundHeading");
    if (heading) heading.textContent = "🎄 Christmas Fund Contributions";

    const banner = document.getElementById("motivationalBanner");
    if (banner) banner.style.display = "none";

    const fetchData = async () => {
        try {
            const res = await fetch(API_URL + '&_t=' + Date.now(), { credentials: 'omit', cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            contributionsData = data.contributions || [];
            window._currentContributions = contributionsData;
            window._memberEmails = data.memberEmails || {};
            window._memberPhones = data.memberPhones || {};
            goalAmount = data.goalAmount || 0;
            // NEW: "What We Bought" aggregates
            window._spentOnProducts = Number(data.spentOnProducts) || 0;
            window._productsBoughtCount = Number(data.productsBoughtCount) || 0;
            // LOCAL PREVIEW: override from mock if running on file:// or ?mock=1
            if (window.__LJM_USE_MOCK_PURCHASES__ && window.__LJM_PURCHASES_MOCK__) {
                const mock = window.__LJM_PURCHASES_MOCK__;
                const christmasKey = "Christmas Fund";
                const fundSpent = (mock.fundContribByFund && mock.fundContribByFund[christmasKey]) || 0;
                const fundCount = (mock.purchases || []).filter(p => p.fund === christmasKey).length;
                window._spentOnProducts = fundSpent;
                window._productsBoughtCount = fundCount;
            }
            setCachedFund(FUND_KEY, {
                contributions: contributionsData,
                goalAmount,
                memberEmails: window._memberEmails,
                memberPhones: window._memberPhones,
                spentOnProducts: window._spentOnProducts,
                productsBoughtCount: window._productsBoughtCount
            });
            currentDisplayCount = 0;
            renderDashboard();
            renderTopContributors(contributionsData);
            document.dispatchEvent(new CustomEvent('LJM_DATA_READY', {
                detail: { fund: 'christmas', members: Array.from(new Set(contributionsData.map(c => c.Member))) }
            }));
        } catch (err) {
            console.error("Error fetching Christmas Fund:", err);
            const cached = getCachedFund(FUND_KEY, true);
            if (cached) {
                contributionsData = cached.contributions || [];
                window._currentContributions = contributionsData;
                window._memberEmails = cached.memberEmails || {};
                window._memberPhones = cached.memberPhones || {};
                goalAmount = cached.goalAmount || 0;
                window._spentOnProducts = Number(cached.spentOnProducts) || 0;
                window._productsBoughtCount = Number(cached.productsBoughtCount) || 0;
                // LOCAL PREVIEW: apply mock override when running from file:// or ?mock=1
                if (window.__LJM_USE_MOCK_PURCHASES__ && window.__LJM_PURCHASES_MOCK__) {
                    const mock = window.__LJM_PURCHASES_MOCK__;
                    const christmasKey = "Christmas Fund";
                    window._spentOnProducts = (mock.fundContribByFund && mock.fundContribByFund[christmasKey]) || 0;
                    window._productsBoughtCount = (mock.purchases || []).filter(p => p.fund === christmasKey).length;
                }
                currentDisplayCount = 0;
                renderDashboard();
                renderTopContributors(contributionsData);
            } else {
                // Render error state if API fails and no cached data is available at all
                contributionsData = [];
                goalAmount = 0;
                window._spentOnProducts = 0;
                window._productsBoughtCount = 0;
                initTabs();
                renderDashboard([]);
                const timeline = document.getElementById("timelineContainer");
                if (timeline) {
                    timeline.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-icon">⚠️</div>
                            <h3>Connection Timeout</h3>
                            <p>Unable to retrieve contributions data from the server. Please check your internet or try refreshing.</p>
                        </div>
                    `;
                }
            }
        }
    };

    const renderDashboard = (filteredData = null) => {
        try {
            const data = filteredData || contributionsData;
            const timeline = document.getElementById("timelineContainer");
            if (!timeline) return;
            timeline.innerHTML = "";

            const allContributors = getContributorsAlpha(data);

            if (allContributors.length === 0) {
                timeline.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">💫</div>
                        <h3>No contributions yet</h3>
                        <p>Be the first to contribute to our Christmas Fund!</p>
                    </div>
                `;
            } else {
                const itemsPerPage = 15;
                if (currentDisplayCount === 0) currentDisplayCount = itemsPerPage;
                const currentPage = Math.floor((currentDisplayCount - 1) / itemsPerPage);
                const startIdx = currentPage * itemsPerPage;
                const endIdx = Math.min(startIdx + itemsPerPage, allContributors.length);
                const displayContributors = allContributors.slice(startIdx, endIdx);

                const sectionTitle = document.createElement("h3");
                sectionTitle.className = "section-title contributors-title";
                sectionTitle.textContent = allContributors.length > 15
                    ? `👥 All Contributors · A–Z (${allContributors.length} total)`
                    : "👥 All Contributors · A–Z";
                timeline.appendChild(sectionTitle);

                const grid = document.createElement("div");
                grid.className = "contributors-grid";

                displayContributors.forEach((item, index) => {
                    const card = document.createElement("div");
                    card.className = "contributor-card";
                    const rank = startIdx + index + 1;
                    let medal = "";

                    const safeMember = escapeHtml(item.Member);
                    card.style.cursor = 'pointer';
                    card.setAttribute('role', 'button');
                    card.setAttribute('tabindex', '0');
                    card.onclick = () => openContributorDetailModal(item.Member, data);
                    card.innerHTML = `
                        <div class="contributor-rank">${medal} #${rank}</div>
                        <div class="contributor-avatar">${safeMember.charAt(0).toUpperCase()}</div>
                        <div class="contributor-name">${safeMember}</div>
                        <div class="contributor-amount">₹${item.Total.toLocaleString('en-IN')}</div>
                        <div class="contributor-count">${item.Entries} contribution${item.Entries !== 1 ? 's' : ''}</div>
                    `;
                    grid.appendChild(card);
                });

                timeline.appendChild(grid);

                if (allContributors.length > 15) {
                    const paginationContainer = document.createElement("div");
                    paginationContainer.className = "pagination-container";

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

                    if (endIdx < allContributors.length) {
                        const showMoreBtn = document.createElement("button");
                        showMoreBtn.className = "pagination-nav-btn";
                        showMoreBtn.textContent = `Show More (${allContributors.length - endIdx} remaining)`;
                        showMoreBtn.onclick = () => {
                            currentDisplayCount = Math.min(allContributors.length, currentDisplayCount + itemsPerPage);
                            renderDashboard(filteredData);
                        };
                        paginationContainer.appendChild(showMoreBtn);
                    }

                    if (paginationContainer.children.length > 0) {
                        timeline.appendChild(paginationContainer);
                    }
                }
            }

            // ---- STATS (single source of truth: all from data) ----
            const totalCollected = data.reduce((sum, c) => sum + (Number(c.Amount) || 0), 0);
            const remaining = Math.max(goalAmount - totalCollected, 0);
            const progressPercent = goalAmount > 0 ? Math.min((totalCollected / goalAmount) * 100, 100) : 0;
            const uniqueContributors = new Set(data.map(c => c.Member).filter(Boolean)).size;
            const avgContribution = data.length > 0 ? Math.round(totalCollected / data.length) : 0;

            // ---- TRENDS ----
            const trend = calculateTrend(data);

            // Animated stat values
            animateValue("goalAmount", goalAmount, "🎯 ₹");
            animateValue("totalAmount", totalCollected, "💰 ₹");
            if (remaining > 0) {
                animateValue("remainingAmount", remaining, "⏳ ₹");
            } else {
                document.getElementById("remainingAmount").innerHTML = "🎉 Goal Achieved!";
            }
            animateValue("entryCount", data.length, "📝 ");

            // NEW: "What We Bought" math — Spent & Available Balance
            const spent = Number(window._spentOnProducts) || 0;
            const productsCount = Number(window._productsBoughtCount) || 0;
            const availableBalance = Math.max(totalCollected - spent, 0);

            const spentEl = document.getElementById("spentAmount");
            if (spentEl) animateValue("spentAmount", spent, "🛍️ ₹");
            const spentSub = document.getElementById("spentSubdetail");
            if (spentSub) {
                spentSub.innerHTML = productsCount > 0
                    ? `${productsCount} ${productsCount === 1 ? "item" : "items"} bought · <a href="impact.html" style="color:#667eea; font-weight:700;">See details →</a>`
                    : `<a href="impact.html" style="color:#667eea; font-weight:700;">Nothing bought yet — see all →</a>`;
            }

            const balanceEl = document.getElementById("balanceAmount");
            if (balanceEl) animateValue("balanceAmount", availableBalance, "💼 ₹");
            const balanceSub = document.getElementById("balanceSubdetail");
            if (balanceSub) {
                balanceSub.textContent = spent > 0
                    ? `Collected ₹${Number(totalCollected).toLocaleString("en-IN")} − Spent ₹${spent.toLocaleString("en-IN")}`
                    : "Money in hand right now";
            }

            // Render Trend Badges
            updateTrendIndicator("totalSubdetail", trend);
            updateTrendIndicator("countSubdetail", {
                direction: trend.direction,
                percent: trend.percent,
                icon: trend.icon
            });

            // Sub-details
            const goalSub = document.getElementById("goalSubdetail");
            if (goalSub) goalSub.textContent = "For the glory of God";
            const remainSub = document.getElementById("remainingSubdetail");
            if (remainSub) remainSub.textContent = remaining > 0 ? "Keep giving — we're getting closer!" : "Praise the Lord! 🙌";
            const countSub = document.getElementById("countSubdetail");
            if (countSub) countSub.textContent = "Avg ₹" + avgContribution.toLocaleString('en-IN') + " · " + uniqueContributors + " unique contributors";

            // Progress bar (Christmas gold theme)
            const progressBar = document.getElementById("progressBar");
            if (progressBar) {
                progressBar.style.width = progressPercent + "%";
                progressBar.innerText = Math.round(progressPercent) + "%";
                if (progressPercent < 50) {
                    progressBar.style.background = 'linear-gradient(90deg, #b08d57, #d4af37)';
                } else if (progressPercent < 80) {
                    progressBar.style.background = 'linear-gradient(90deg, #ffd700, #f1c40f)';
                } else if (progressPercent < 100) {
                    progressBar.style.background = 'linear-gradient(90deg, #f1c40f, #f39c12)';
                } else {
                    progressBar.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
                    progressBar.style.boxShadow = '0 0 15px rgba(46,204,113,0.7)';
                }
            }

            // Draw circular KPI progress ring
            window._currentProgressPercent = progressPercent;
            try { drawProgressRing(progressPercent); } catch (e) { console.error("KPI Progress Ring error:", e); }

            // ---- NEW FEATURES ----
            try { renderGoalDonut(totalCollected, goalAmount); } catch (e) { console.error("Donut error:", e); }
            try { renderMilestones(progressPercent); } catch (e) { console.error("Milestones error:", e); }
            try { renderGivingPace(data, goalAmount, totalCollected); } catch (e) { console.error("Pace error:", e); }
            try { renderGivingInsights(data, goalAmount); } catch (e) { console.error("Insights error:", e); }
            try { renderDistributionPie(data); } catch (e) { console.error("Distribution pie error:", e); }
            try { renderTopContributors(data); } catch (e) { console.error("Top contributors error:", e); }
            try { renderSourceChart(data); } catch (e) { console.error("Source chart error:", e); }
            try { renderRecentActivityFeed(data, "recentActivityFeed"); } catch (e) { console.error("Recent activity error:", e); }

            // Enhanced Stats
            const renderCharts = () => {
                if (typeof Chart !== 'undefined') {
                    try { renderEnhancedStats(data); } catch (e) {
                        const cc = document.getElementById('enhancedStatsContainer');
                        if (cc) cc.innerHTML = '<p style="text-align:center;color:#6c757d;padding:40px;">Unable to load statistics</p>';
                    }
                } else {
                    setTimeout(renderCharts, 200);
                }
            };
            if (document.readyState === 'complete') renderCharts();
            else { window.addEventListener('load', renderCharts); setTimeout(renderCharts, 500); }

        } catch (err) {
            console.error("Error in renderDashboard:", err);
        }
    };

    // Search
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const term = e.target.value.toLowerCase().trim();
            if (term === "") {
                currentDisplayCount = 0;
                renderDashboard();
            } else {
                const filtered = contributionsData.filter(c => (c.Member || "").toLowerCase().includes(term));
                currentDisplayCount = 0;
                renderDashboard(filtered);
            }
        });
    }

    setInterval(() => fetchData(), CACHE_TTL_MS);
    await fetchData();
    preloadMembersList();
}

// ==================================================
// SHARED HELPERS
// ==================================================

// Helper: get top contributors
function getTopContributors(data, limit = 6) {
    const memberMap = {};
    data.forEach(item => {
        const member = item.Member || "Anonymous";
        const amount = Number(item.Amount) || 0;
        if (!memberMap[member]) memberMap[member] = { Member: member, Total: 0, Entries: 0 };
        memberMap[member].Total += amount;
        memberMap[member].Entries += 1;
    });
    return Object.values(memberMap).sort((a, b) => b.Total - a.Total).slice(0, limit);
}

// --------------------
// Alphabetical contributor directory — deliberately distinct ordering from the
// Top Contributors leaderboard (which ranks by amount), so the "All Contributors"
// section reads as a lookup directory rather than a duplicate ranking.
function getContributorsAlpha(data) {
    return getTopContributors(data, 1000).sort((a, b) =>
        String(a.Member).localeCompare(String(b.Member), undefined, { sensitivity: "base" })
    );
}

// --------------------
// Recent Activity: chronological feed of individual contributions (not aggregated
// by member), most recent first. The dashboard previously had no per-transaction
// "what just happened" view outside of a member's own detail modal.
function renderRecentActivityFeed(data, containerId, limit = 8) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const sorted = [...data].sort((a, b) => {
        const dA = parseContributionDate(a.Date);
        const dB = parseContributionDate(b.Date);
        if (!dA) return 1; if (!dB) return -1;
        return dB - dA;
    }).slice(0, limit);

    container.innerHTML = "";

    if (sorted.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🕊️</div>
                <h3>No recent activity</h3>
                <p>New contributions will appear here as they come in.</p>
            </div>
        `;
        return;
    }

    sorted.forEach(c => {
        const dateObj = parseContributionDate(c.Date);
        const dateStr = dateObj
            ? dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
            : '';
        const memberName = c.Member || "Anonymous";
        const safeMember = escapeHtml(memberName);
        const isOnline = /verified|online/i.test(c.Category || "");
        const methodIcon = isOnline ? "💳" : "💵";

        const row = document.createElement("div");
        row.className = "activity-row";
        row.tabIndex = 0;
        row.setAttribute("role", "button");
        row.innerHTML = `
            <div class="activity-avatar">${safeMember.charAt(0).toUpperCase()}</div>
            <div class="activity-main">
                <div class="activity-name">${safeMember}</div>
                <div class="activity-meta">${methodIcon} ${escapeHtml(c.Category || 'Contribution')} · ${dateStr}</div>
            </div>
            <div class="activity-amount">₹${(Number(c.Amount) || 0).toLocaleString('en-IN')}</div>
        `;
        row.onclick = () => openContributorDetailModal(memberName, data);
        container.appendChild(row);
    });
}

// --------------------
// Contributor Details Modal (shows timeline log when clicking a user)
function openContributorDetailModal(memberName, allData) {
    const modal = document.getElementById('insightModal');
    if (!modal) return;
    
    // Filter their contributions
    const myContributions = allData.filter(c => c.Member === memberName);
    
    // Sort by date descending
    myContributions.sort((a, b) => {
        const dA = parseContributionDate(a.Date);
        const dB = parseContributionDate(b.Date);
        if(!dA) return 1; if(!dB) return -1;
        return dB - dA;
    });

    const total = myContributions.reduce((sum, c) => sum + (Number(c.Amount) || 0), 0);
    const count = myContributions.length;
    
    const titleEl = document.getElementById('insightModalTitle');
    const bodyEl = document.getElementById('insightModalBody');
    
    if (titleEl) titleEl.textContent = `Giving History: ${memberName}`;
    
    let html = `
        <div class="human-insight" style="margin-bottom: 20px;">
            <div class="insight-metric-grid">
                <div class="metric-item">
                    <span class="label">Total Given</span>
                    <span class="value" style="color:#667eea;font-size:24px;">₹${total.toLocaleString('en-IN')}</span>
                </div>
                <div class="metric-item">
                    <span class="label">Total Entries</span>
                    <span class="value" style="color:#6c757d;font-size:24px;">${count}</span>
                </div>
            </div>
        </div>
    `;
    
    if (myContributions.length > 0) {
        html += '<div class="contributor-detail-list-wrapper" style="max-height: 50vh; overflow-y: auto; padding-right: 5px;"><table class="contributor-detail-list"><thead><tr><th>Date</th><th>Amount</th><th>Method/Notes</th></tr></thead><tbody>';
        myContributions.forEach(c => {
            const dateObj = parseContributionDate(c.Date);
            let timeStr = '';
            if (dateObj) {
                // Determine if we actually have meaningful hours/minutes/seconds
                const hours = dateObj.getHours();
                const mins = dateObj.getMinutes();
                const secs = dateObj.getSeconds();
                if (hours > 0 || mins > 0 || secs > 0) {
                    timeStr = ' <br><span style="font-size:12px;opacity:0.7;">' + dateObj.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', second:'2-digit'}) + '</span>';
                }
            }
            const dateStr = dateObj ? (dateObj.toLocaleDateString('en-US', {day: 'numeric', month: 'short', year: 'numeric'}) + timeStr) : 'Unknown Date';
            html += `<tr>
                <td style="white-space:nowrap;">${dateStr}</td>
                <td style="font-weight:600; color:#2ecc71;">₹${Number(c.Amount).toLocaleString('en-IN')}</td>
                <td><span style="font-size:12px; opacity:0.8;">${escapeHtml(c.Notes || c.Category || '-')}</span></td>
            </tr>`;
        });
        html += '</tbody></table></div>';
    } else {
        html += '<p>No contribution details found.</p>';
    }
    
    if (bodyEl) bodyEl.innerHTML = html;
    
    modal.classList.add('insight-modal-visible');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

// Enhanced Stats Visualization (time series + growth charts)
function renderEnhancedStats(contributions) {
    const enhancedStatsCard = document.getElementById('enhancedStatsContainer');
    if (!enhancedStatsCard || typeof Chart === 'undefined') return;

    const sortedContributions = [...contributions]
        .map(c => ({ ...c, _parsedDate: parseContributionDate(c.Date) }))
        .filter(c => c._parsedDate)
        .sort((a, b) => a._parsedDate - b._parsedDate);

    if (sortedContributions.length === 0) {
        enhancedStatsCard.innerHTML = '<p style="text-align:center;color:#6c757d;padding:40px;">No data available yet</p>';
        return;
    }

    const timeSeriesData = {};
    const contributorGrowthCumulative = {};
    const newContributorsPerMonth = {};
    let uniqueContributors = new Set();
    const firstContributionMonth = {};

    sortedContributions.forEach((c) => {
        const date = c._parsedDate;
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const amount = Number(c.Amount) || 0;

        if (!timeSeriesData[monthKey]) timeSeriesData[monthKey] = { total: 0, count: 0 };
        timeSeriesData[monthKey].total += amount;
        timeSeriesData[monthKey].count += 1;

        const member = c.Member && c.Member.trim() ? c.Member.trim() : null;
        if (member && !firstContributionMonth[member]) {
            firstContributionMonth[member] = monthKey;
            newContributorsPerMonth[monthKey] = (newContributorsPerMonth[monthKey] || 0) + 1;
        }
        if (member) uniqueContributors.add(member);
        contributorGrowthCumulative[monthKey] = uniqueContributors.size;
    });

    const months = Object.keys(timeSeriesData).sort();
    const amounts = months.map(m => timeSeriesData[m].total);
    const contributorCounts = months.map(m => contributorGrowthCumulative[m] || 0);
    const newPerMonth = months.map(m => newContributorsPerMonth[m] || 0);

    const totalContributors = uniqueContributors.size;
    const lastMonthKey = months[months.length - 1];
    const newInLastMonth = lastMonthKey ? (newContributorsPerMonth[lastMonthKey] || 0) : 0;
    const lastMonthLabel = lastMonthKey ? (() => { const [y, m] = lastMonthKey.split('-'); return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long' }); })() : '';
    const totalAmount = contributions.reduce((sum, c) => sum + (Number(c.Amount) || 0), 0);
    const avgContribution = contributions.length > 0 ? Math.round(totalAmount / contributions.length) : 0;
    const largestContribution = contributions.length > 0 ? Math.max(...contributions.map(c => Number(c.Amount) || 0)) : 0;

    const contributorSummaryText = lastMonthLabel && totalContributors > 0
        ? `${totalContributors} people have contributed so far${newInLastMonth > 0 ? `; ${newInLastMonth} first gave in ${lastMonthLabel}.` : '.'}`
        : (totalContributors > 0 ? `${totalContributors} people have contributed so far.` : 'No contributors yet.');

    enhancedStatsCard.innerHTML = `
        <div class="stats-container">
            <h3 class="stats-title">📊 Contribution Trends</h3>
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
            <p class="contributor-growth-summary">${contributorSummaryText}</p>
            <div class="chart-container">
                <canvas id="timeSeriesChart"></canvas>
            </div>
            <div class="chart-container">
                <canvas id="contributorGrowthChart"></canvas>
            </div>
        </div>
    `;

    // Time Series Chart
    const timeCtx = document.getElementById('timeSeriesChart').getContext('2d');
    if (window.timeSeriesChart && typeof window.timeSeriesChart.destroy === 'function') window.timeSeriesChart.destroy();
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
            animation: { duration: 750 },
            plugins: {
                legend: { display: true, position: 'top' },
                title: { display: true, text: 'Contributions Over Time', font: { size: window.innerWidth < 768 ? 14 : 16, weight: 'bold' } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: v => '₹' + v, font: { size: window.innerWidth < 768 ? 10 : 12 } } },
                x: { ticks: { font: { size: window.innerWidth < 768 ? 10 : 12 } } }
            }
        }
    });

    // Contributor Growth Chart: cumulative total + new per month
    const growthCtx = document.getElementById('contributorGrowthChart').getContext('2d');
    if (window.contributorGrowthChart && typeof window.contributorGrowthChart.destroy === 'function') window.contributorGrowthChart.destroy();
    window.contributorGrowthChart = new Chart(growthCtx, {
        type: 'bar',
        data: {
            labels: months.map(m => {
                const [year, month] = m.split('-');
                return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            }),
            datasets: [
                {
                    label: 'Total contributors (by end of month)',
                    data: contributorCounts,
                    backgroundColor: 'rgba(102, 126, 234, 0.7)',
                    borderColor: '#667eea',
                    borderWidth: 2
                },
                {
                    label: 'New contributors this month',
                    data: newPerMonth,
                    backgroundColor: 'rgba(72, 187, 120, 0.7)',
                    borderColor: '#48bb78',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 750 },
            plugins: {
                legend: { display: true, position: 'top' },
                title: { display: true, text: 'Contributor growth: total so far & new each month', font: { size: window.innerWidth < 768 ? 14 : 16, weight: 'bold' } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: window.innerWidth < 768 ? 10 : 12 } } },
                x: { ticks: { font: { size: window.innerWidth < 768 ? 10 : 12 } } }
            }
        }
    });
}

// Render top contributors (cards)
function renderTopContributors(contributions) {
    const grid = document.getElementById("topContributorsGrid");
    if (!grid) return;

    const medals = ["🥇", "🥈", "🥉", "⭐", "⭐", "⭐"];
    const top = getTopContributors(contributions, 6);

    grid.innerHTML = "";
    top.forEach((item, index) => {
        const card = document.createElement("div");
        card.className = "top-card";
        card.style.cursor = "pointer"; // Visual cue
        card.onclick = () => showMemberDeepDive(item.Member);
        
        const hasEmail = window._memberEmails && window._memberEmails[item.Member];
        const hasPhone = window._memberPhones && window._memberPhones[item.Member];
        const isVerified = (window._memberStatus && window._memberStatus[item.Member]) || (hasEmail && hasPhone);
        const verifiedBadge = isVerified ? '<span class="verified-badge-small" title="Verified Profile">✅</span>' : '';
        
        card.innerHTML = `
            <div class="rank-line">
                <span class="medal">${medals[index]}</span>
                <span class="rank-text">Rank #${index + 1}</span>
                ${verifiedBadge}
            </div>
            <div class="amount">₹${item.Total.toLocaleString('en-IN')}</div>
            <div class="amount-label">Total Contribution</div>
            <div class="meta">
                <span>${item.Entries} Contributions</span>
                <span class="member-name">${item.Member}</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

/**
 * MEMBER DEEP DIVE: Shows detailed stats for a specific member
 */
function showMemberDeepDive(name) {
    const contributions = window._currentContributions || [];
    const memberData = contributions.filter(c => (c.Member || "").toLowerCase() === name.toLowerCase());
    
    if (memberData.length === 0) return;

    const total = memberData.reduce((sum, c) => sum + (Number(c.Amount) || 0), 0);
    const monthsPaid = new Set();
    const currentYear = new Date().getFullYear();
    
    memberData.forEach(c => {
        const d = parseContributionDate(c.Date);
        if (d && d.getFullYear() === currentYear) {
            monthsPaid.add(d.getMonth());
        }
        // Also check if 'Month' was explicitly stored in Notes
        const notes = (c.Notes || "").toLowerCase();
        const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
        monthNames.forEach((m, idx) => {
            if (notes.includes(m)) monthsPaid.add(idx);
        });
    });

    const consistency = Math.round((monthsPaid.size / 12) * 100);
    const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    let gridHtml = '<div class="member-month-grid">';
    monthNamesShort.forEach((m, i) => {
        const isPaid = monthsPaid.has(i);
        gridHtml += `
            <div class="month-box ${isPaid ? 'paid' : 'pending'}">
                <div class="month-name">${m}</div>
                <div class="month-status">${isPaid ? '✓' : '—'}</div>
            </div>
        `;
    });
    gridHtml += '</div>';

    let timelineHtml = '<div class="member-deep-timeline">';
    memberData.sort((a,b) => parseContributionDate(b.Date) - parseContributionDate(a.Date)).forEach(c => {
        timelineHtml += `
            <div class="deep-timeline-item">
                <span class="date">${new Date(c.Date).toLocaleDateString()}</span>
                <span class="amt">₹${c.Amount}</span>
                <span class="cat">${c.Category}</span>
            </div>
        `;
    });
    timelineHtml += '</div>';

    const hasEmail = window._memberEmails && window._memberEmails[name];
    const hasPhone = window._memberPhones && window._memberPhones[name];
    const isVerified = (window._memberStatus && window._memberStatus[name]) || (hasEmail && hasPhone);
    const verifiedBadge = isVerified ? '<span class="verified-badge-large">✅ Verified</span>' : '';

    const bodyHtml = `
        <div class="member-profile-header">
            <h3>${name} ${verifiedBadge}</h3>
            <div class="profile-stats">
                <div class="stat">
                    <span class="label">Total Given</span>
                    <span class="valueHighlight">₹${total.toLocaleString('en-IN')}</span>
                </div>
                <div class="stat">
                    <span class="label">Consistency (${currentYear})</span>
                    <span class="valueHighlight">${consistency}%</span>
                </div>
            </div>
        </div>
        <h4 style="margin: 20px 0 10px; font-size: 15px; color: #1e293b;">Yearly Payment Progress</h4>
        ${gridHtml}
        <h4 style="margin: 25px 0 10px; font-size: 15px; color: #1e293b;">Transaction History</h4>
        ${timelineHtml}
        <div style="margin-top: 20px; text-align: center;">
            <button class="cta-button" onclick="document.querySelector('.insight-modal-close').click()" style="padding: 8px 20px; font-size: 14px;">Close Insights</button>
        </div>
    `;

    const modal = document.getElementById('insightModal');
    const titleEl = document.getElementById('insightModalTitle');
    const bodyEl = document.getElementById('insightModalBody');

    if (titleEl) titleEl.textContent = `🙏 ${name}'s Journey`;
    if (bodyEl) bodyEl.innerHTML = bodyHtml;
    
    modal.classList.add('insight-modal-visible');
    document.body.style.overflow = 'hidden';
}

// ─── STAGE WISHLIST LOADER ───
async function loadHomeWishlist() {
    const container = document.getElementById("homeWishlistList");
    if (!container) return;

    try {
        const res = await fetch("/api/wishlist?_t=" + Date.now());
        const data = await res.json();
        const wishlist = Array.isArray(data.wishlist) ? data.wishlist : [];

        if (wishlist.length === 0) {
            container.innerHTML = `<div style="color: var(--text-secondary); font-size: 13px; padding: 20px; text-align: center; grid-column: 1 / -1;">No planned upgrades currently listed.</div>`;
            return;
        }

        container.innerHTML = "";
        wishlist.forEach(item => {
            const card = document.createElement("div");
            card.className = "wishlist-card";
            card.style.borderLeft = item.priority === "High" ? "4px solid var(--danger)" : (item.priority === "Medium" ? "4px solid var(--warning)" : "4px solid var(--success)");
            
            // Build simple Google styling content
            card.innerHTML = `
                <div style="font-size: 11px; font-weight: 700; color: ${item.priority === 'High' ? 'var(--danger)' : 'var(--google-text-secondary)'}; text-transform: uppercase; margin-bottom: 6px;">
                    ${item.priority} Priority
                </div>
                <div style="font-family: var(--font-heading); font-weight: 600; font-size: 15px; color: var(--google-text); margin-bottom: 4px;">
                    ${escapeHtml(item.name)}
                </div>
                <div style="font-weight: 700; color: var(--google-blue); font-size: 14px; margin-bottom: 8px;">
                    Est. Cost: ₹${Number(item.cost).toLocaleString('en-IN')}
                </div>
                <div style="font-size: 12px; color: var(--google-text-secondary); line-height: 1.4;">
                    ${escapeHtml(item.notes || 'No description provided')}
                </div>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error("Failed to load wishlist:", err);
        container.innerHTML = `<div style="color: var(--danger); font-size: 13px; padding: 20px; text-align: center; grid-column: 1 / -1;">Failed to load wishlist.</div>`;
    }
}

function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
