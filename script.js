// ==================================================
// LJM Church Contributions - Main Dashboard Script
// Smart caching, premium UX, instant load
// ==================================================

// --------------------
// Cache configuration (shared across pages via localStorage)
const CACHE_VERSION = 1;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Helper: get cached fund (with TTL enforcement - works on all devices including Android)
function getCachedFund(fundKey) {
    try {
        const raw = localStorage.getItem(fundKey);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (parsed.version !== CACHE_VERSION) {
            localStorage.removeItem(fundKey);
            return null;
        }

        const age = Date.now() - (parsed.lastFetched || 0);
        // Expire if too old OR if age is negative (device clock skew / invalid timestamp)
        if (age < 0 || age > CACHE_TTL_MS) {
            if (age > CACHE_TTL_MS) {
                console.log(`[CACHE] Expired: ${fundKey} (age: ${Math.round(age / 1000)}s)`);
            }
            localStorage.removeItem(fundKey);
            return null;
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
    const techUrl = "https://script.google.com/macros/s/AKfycbwqbSnRsc7mq6kIE_6i9hmnMQz3n37YgCmljJaDeCt-XYGHtTbcthMsjEIbNhzm5qlc/exec?fund=tech-contributions";
    const christmasUrl = "https://script.google.com/macros/s/AKfycbwqbSnRsc7mq6kIE_6i9hmnMQz3n37YgCmljJaDeCt-XYGHtTbcthMsjEIbNhzm5qlc/exec?fund=christmas-fund";
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

// --------------------
// Animated value counter
function animateValue(elementId, targetValue, prefix = '', duration = 1200) {
    const el = document.getElementById(elementId);
    if (!el) return;

    // If target is 0, just set it
    if (targetValue === 0) {
        el.textContent = prefix + '0';
        return;
    }

    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = Math.round(targetValue * eased);
        el.textContent = prefix + current.toLocaleString('en-IN');

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
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

    function escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function getStatCardContent(type) {
        const ctx = window.__insightContext || {};
        const goal = ctx.goalAmount != null ? ctx.goalAmount : 0;
        const total = ctx.totalAmount != null ? ctx.totalAmount : 0;
        const remaining = Math.max(goal - total, 0);
        const count = ctx.entryCount != null ? ctx.entryCount : 0;
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
                let estHtml = `<p><strong>Estimated to Goal</strong> = how many months until we reach the goal, using our current average collection per month (total so far ÷ number of months with data).</p><p>About <strong>${ctx.monthsToGoal != null ? ctx.monthsToGoal : 0}</strong> month(s) at current pace. Roughly <strong>${ctx.moreNeeded != null ? ctx.moreNeeded : 0}</strong> more contributions needed at average rate.</p>`;
                if (ctx.avgPerMonth != null && ctx.avgPerMonth > 0) {
                    estHtml += `<p class="insight-modal-summary">Average: <strong>₹${Math.round(ctx.avgPerMonth).toLocaleString('en-IN')}/month</strong> over ${ctx.monthsWithData != null ? ctx.monthsWithData : 0} month(s) with data.</p>`;
                }
                const months = ctx.monthlyBreakdown;
                if (months && months.length > 0) {
                    estHtml += '<div class="contributor-detail-list-wrapper"><table class="contributor-detail-list"><thead><tr><th>Month</th><th>Collected</th><th>#</th></tr></thead><tbody>';
                    months.forEach((m) => {
                        estHtml += `<tr><td>${escapeHtml(m.label)}</td><td>₹${Number(m.total).toLocaleString('en-IN')}</td><td>${m.count}</td></tr>`;
                    });
                    estHtml += '</tbody></table></div>';
                }
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
        if (statType) {
            const titles = { goal: 'How we calculate: Goal Amount', total: 'How we calculate: Total Collected', remaining: 'How we calculate: Remaining', count: 'How we calculate: Number of Contributions' };
            openModal(titles[statType] || 'Calculation details', getStatCardContent(statType));
        } else if (insightType) {
            const titles = { unique: 'How we calculate: Unique Contributors', avg: 'How we calculate: Average Contribution', bestMonth: 'How we calculate: Most Active Month', estimated: 'How we calculate: Estimated to Goal' };
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
            return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
        }
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    if (typeof value !== 'string') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    const s = value.trim();
    if (!s) return null;

    if (/^-?\d+$/.test(s)) {
        const n = parseInt(s, 10);
        if (n > 0 && n < 100000) {
            const epoch = new Date(1899, 11, 30).getTime();
            const d = new Date(epoch + n * 86400000);
            return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
        }
        if (n > 1e12) {
            const d = new Date(n);
            return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
        }
    }

    // YYYY-MM-DD or YYYY/MM/DD (with or without time after)
    const iso = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (iso) {
        const y = parseInt(iso[1], 10), mo = parseInt(iso[2], 10) - 1, day = parseInt(iso[3], 10);
        const d = new Date(y, mo, day);
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
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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

    const insights = [
        { key: 'unique', icon: '👥', value: uniqueMembers, label: 'Unique Contributors',
            detail: avgPerPerson > 0 ? '₹' + avgPerPerson.toLocaleString('en-IN') + ' avg per person' : '' },
        { key: 'avg', icon: '💰', value: '₹' + avgContribution.toLocaleString('en-IN'), label: 'Average Contribution',
            detail: contributions.length + ' total entries' },
        { key: 'bestMonth', icon: '📅', value: bestMonth ? bestMonth[0] : 'N/A', label: 'Most Active Month',
            detail: bestMonth ? '₹' + bestMonth[1].toLocaleString('en-IN') + ' collected' : '' },
        { key: 'estimated', icon: '🎯',
            value: remaining > 0 ? (monthsToGoal > 0 ? '~' + monthsToGoal + ' mo' : 'Keep going!') : 'Done!',
            label: remaining > 0 ? 'Estimated to Goal' : 'Goal Reached! 🎉',
            detail: remaining > 0 ? moreNeeded + ' more contributions needed at avg rate' : 'Praise the Lord!' }
    ];

    window.__insightContext = {
        goalAmount, totalAmount, remaining, entryCount: contributions.length,
        uniqueMembers, avgContribution, avgPerPerson, bestMonth,
        monthsToGoal, moreNeeded, monthsWithData: Object.keys(byMonth).length,
        contributorList, monthlyBreakdown, avgPerMonth
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
// Distribution Pie Chart (contribution share by member)
function renderDistributionPie(contributions) {
    const canvas = document.getElementById('distributionPieChart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (!contributions || contributions.length === 0) return;

    const memberMap = {};
    contributions.forEach(c => {
        const member = c.Member || 'Anonymous';
        memberMap[member] = (memberMap[member] || 0) + (Number(c.Amount) || 0);
    });

    // Sort by amount, show top 8 + "Others"
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
            animation: { duration: 700 },
            plugins: {
                legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 16 } },
                title: {
                    display: true,
                    text: '🥧 Contribution Share by Member',
                    font: { size: window.innerWidth < 768 ? 14 : 16, weight: 'bold' }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = Math.round((context.raw / total) * 100);
                            return context.label + ': ₹' + context.raw.toLocaleString('en-IN') + ' (' + pct + '%)';
                        }
                    }
                }
            }
        }
    });
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
            apiUrl = "https://script.google.com/macros/s/AKfycbwqbSnRsc7mq6kIE_6i9hmnMQz3n37YgCmljJaDeCt-XYGHtTbcthMsjEIbNhzm5qlc/exec?fund=christmas-fund";
            fundKey = "christmasFundData";
        } else {
            apiUrl = "https://script.google.com/macros/s/AKfycbwqbSnRsc7mq6kIE_6i9hmnMQz3n37YgCmljJaDeCt-XYGHtTbcthMsjEIbNhzm5qlc/exec?fund=tech-contributions";
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

    // --------------------
    // Modal for "how we calculate" (stat and insight cards)
    initInsightModal();

    // --------------------
    // Initialize dashboard
    console.log("Initializing dashboard for fund:", selectedFund);

    try {
        if (selectedFund === "christmasfund") {
            await initChristmasFundDashboard();
        } else {
            await initDashboard();
        }

        const heading = document.getElementById("fundHeading");
        if (heading) {
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
async function initDashboard() {
    const API_URL = "https://script.google.com/macros/s/AKfycbwqbSnRsc7mq6kIE_6i9hmnMQz3n37YgCmljJaDeCt-XYGHtTbcthMsjEIbNhzm5qlc/exec?fund=tech-contributions";
    const FUND_KEY = "techFundData";

    let contributionsData = [];
    let goalAmount = 0;
    let currentDisplayCount = 0;

    const heading = document.getElementById("fundHeading");
    if (heading) heading.textContent = "💻 Tech Fund Contributions";

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
            goalAmount = data.goalAmount || 0;
            setCachedFund(FUND_KEY, { contributions: contributionsData, goalAmount });
            currentDisplayCount = 0;
            renderDashboard();
            renderTopContributors(contributionsData);
        } catch (err) {
            console.error("Error fetching Tech Fund:", err);
            const cached = getCachedFund(FUND_KEY);
            if (cached) {
                contributionsData = cached.contributions || [];
                goalAmount = cached.goalAmount || 0;
                currentDisplayCount = 0;
                renderDashboard();
                renderTopContributors(contributionsData);
            }
        }
    };

    const renderDashboard = (filteredData = null) => {
        try {
            const data = filteredData || contributionsData;
            const timeline = document.getElementById("timelineContainer");
            if (!timeline) return;
            timeline.innerHTML = "";

            const contributors = getTopContributors(data, 1000);

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
                    ? `👥 All Contributors (${contributors.length} total)`
                    : "👥 All Contributors";
                timeline.appendChild(sectionTitle);

                const grid = document.createElement("div");
                grid.className = "contributors-grid";

                displayContributors.forEach((contributor, index) => {
                    const card = document.createElement("div");
                    card.className = "contributor-card";
                    const rank = startIdx + index + 1;
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

            // Animated stat values
            animateValue("goalAmount", goalAmount, "🎯 ₹");
            animateValue("totalAmount", totalCollected, "💰 ₹");
            if (remaining > 0) {
                animateValue("remainingAmount", remaining, "⏳ ₹");
            } else {
                document.getElementById("remainingAmount").innerHTML = "🎉 Goal Achieved!";
            }
            animateValue("entryCount", data.length, "📝 ");

            // Sub-details for stat cards
            const goalSub = document.getElementById("goalSubdetail");
            if (goalSub) goalSub.textContent = "For the glory of God";
            const totalSub = document.getElementById("totalSubdetail");
            if (totalSub) totalSub.textContent = Math.round(progressPercent) + "% of goal achieved";
            const remainSub = document.getElementById("remainingSubdetail");
            if (remainSub) remainSub.textContent = remaining > 0 ? "Keep giving — we're getting closer!" : "Praise the Lord! 🙌";
            const countSub = document.getElementById("countSubdetail");
            if (countSub) countSub.textContent = "Avg ₹" + avgContribution.toLocaleString('en-IN') + " · " + uniqueContributors + " givers";

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

            // Top contributors
            try { renderTopContributors(data); } catch (e) { console.error("Top contributors error:", e); }

            // Enhanced Stats (time series + growth charts)
            const renderCharts = () => {
                if (typeof Chart !== 'undefined') {
                    try { renderEnhancedStats(data); } catch (e) {
                        const cc = document.querySelector('.chart-card');
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
    const API_URL = "https://script.google.com/macros/s/AKfycbwqbSnRsc7mq6kIE_6i9hmnMQz3n37YgCmljJaDeCt-XYGHtTbcthMsjEIbNhzm5qlc/exec?fund=christmas-fund";
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
            goalAmount = data.goalAmount || 0;
            setCachedFund(FUND_KEY, { contributions: contributionsData, goalAmount });
            currentDisplayCount = 0;
            renderDashboard();
            renderTopContributors(contributionsData);
        } catch (err) {
            console.error("Error fetching Christmas Fund:", err);
            const cached = getCachedFund(FUND_KEY);
            if (cached) {
                contributionsData = cached.contributions || [];
                goalAmount = cached.goalAmount || 0;
                currentDisplayCount = 0;
                renderDashboard();
                renderTopContributors(contributionsData);
            }
        }
    };

    const renderDashboard = (filteredData = null) => {
        try {
            const data = filteredData || contributionsData;
            const timeline = document.getElementById("timelineContainer");
            if (!timeline) return;
            timeline.innerHTML = "";

            const allContributors = getTopContributors(data, 1000);

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
                    ? `👥 All Contributors (${allContributors.length} total)`
                    : "👥 All Contributors";
                timeline.appendChild(sectionTitle);

                const grid = document.createElement("div");
                grid.className = "contributors-grid";

                displayContributors.forEach((item, index) => {
                    const card = document.createElement("div");
                    card.className = "contributor-card";
                    const rank = startIdx + index + 1;
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

            // Animated stat values
            animateValue("goalAmount", goalAmount, "🎯 ₹");
            animateValue("totalAmount", totalCollected, "💰 ₹");
            if (remaining > 0) {
                animateValue("remainingAmount", remaining, "⏳ ₹");
            } else {
                document.getElementById("remainingAmount").innerHTML = "🎉 Goal Achieved!";
            }
            animateValue("entryCount", data.length, "📝 ");

            // Sub-details
            const goalSub = document.getElementById("goalSubdetail");
            if (goalSub) goalSub.textContent = "For the glory of God";
            const totalSub = document.getElementById("totalSubdetail");
            if (totalSub) totalSub.textContent = Math.round(progressPercent) + "% of goal achieved";
            const remainSub = document.getElementById("remainingSubdetail");
            if (remainSub) remainSub.textContent = remaining > 0 ? "Keep giving — we're getting closer!" : "Praise the Lord! 🙌";
            const countSub = document.getElementById("countSubdetail");
            if (countSub) countSub.textContent = "Avg ₹" + avgContribution.toLocaleString('en-IN') + " · " + uniqueContributors + " givers";

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

            // ---- NEW FEATURES ----
            try { renderGoalDonut(totalCollected, goalAmount); } catch (e) { console.error("Donut error:", e); }
            try { renderMilestones(progressPercent); } catch (e) { console.error("Milestones error:", e); }
            try { renderGivingPace(data, goalAmount, totalCollected); } catch (e) { console.error("Pace error:", e); }
            try { renderGivingInsights(data, goalAmount); } catch (e) { console.error("Insights error:", e); }
            try { renderDistributionPie(data); } catch (e) { console.error("Distribution pie error:", e); }
            try { renderTopContributors(data); } catch (e) { console.error("Top contributors error:", e); }

            // Enhanced Stats
            const renderCharts = () => {
                if (typeof Chart !== 'undefined') {
                    try { renderEnhancedStats(data); } catch (e) {
                        const cc = document.querySelector('.chart-card');
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

// Enhanced Stats Visualization (time series + growth charts)
function renderEnhancedStats(contributions) {
    const chartCard = document.querySelector('.chart-card');
    if (!chartCard || typeof Chart === 'undefined') return;

    const sortedContributions = [...contributions]
        .map(c => ({ ...c, _parsedDate: parseContributionDate(c.Date) }))
        .filter(c => c._parsedDate)
        .sort((a, b) => a._parsedDate - b._parsedDate);

    if (sortedContributions.length === 0) {
        chartCard.innerHTML = '<p style="text-align:center;color:#6c757d;padding:40px;">No data available yet</p>';
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

    chartCard.innerHTML = `
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
        card.innerHTML = `
            <div class="rank-line">
                <span class="medal">${medals[index]}</span>
                <span class="rank-text">Rank #${index + 1}</span>
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
