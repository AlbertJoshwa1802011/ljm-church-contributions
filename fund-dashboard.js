class FundDashboard {
    constructor(apiUrl, fundName) {
        this.apiUrl = apiUrl;
        this.fundName = fundName;
        this.contributions = [];
        this.goalAmount = 0;
        this.showCount = 6;        // initial number of timeline cards
        this.currentDisplayCount = this.showCount;

        this.init();
    }

    init() {
        // Fetch data
        this.fetchData();

        // Setup search input
        const searchInput = document.getElementById("searchInput");
        if(searchInput){
            searchInput.addEventListener("input", e => {
                const term = e.target.value.toLowerCase();
                const filtered = this.contributions.filter(c => (c.Member || "").toLowerCase().includes(term));
                this.currentDisplayCount = this.showCount;
                this.renderTimeline(filtered);
            });
        }

        // Auto-refresh every 60 seconds
        setInterval(() => this.fetchData(), 60000);
    }

    async fetchData() {
        try {
            const res = await fetch(`${this.apiUrl}?fund=${encodeURIComponent(this.fundName)}`);
            const data = await res.json();
            if(data.error){
                console.error("Error fetching fund:", data.error);
                return;
            }
            this.contributions = data.contributions || [];
            this.goalAmount = data.goalAmount || 0;
            this.currentDisplayCount = this.showCount;
            this.renderDashboard();
        } catch(err) {
            console.error("Error fetching data:", err);
        }
    }

    renderDashboard() {
        this.renderTimeline();
        this.renderStats();
        this.renderProgress();
        this.renderPieChart();
    }

    renderTimeline(filteredData=null) {
        const data = filteredData || this.contributions;
        const timeline = document.getElementById("timelineContainer");
        timeline.innerHTML = "";

        // Remove old Show More button
        const oldBtn = document.getElementById("showMoreBtn");
        if(oldBtn) oldBtn.remove();

        // Sort by date descending
        data.sort((a,b) => new Date(b.Date) - new Date(a.Date));

        const recordsToShow = data.slice(0, this.currentDisplayCount);

        recordsToShow.forEach(item => {
            const card = document.createElement("div");
            card.className = "timeline-card";
            card.innerHTML = `
                <div class="date">${new Date(item.Date).toLocaleDateString()}</div>
                <div class="amount">₹${item.Amount}</div>
                <div class="category">${item.Category}</div>
                <div class="notes">${item.Notes || ""}</div>
                <div class="member">${item.Member || "Anonymous"}</div>
            `;
            timeline.appendChild(card);
        });

        // Show More / Hide button
        if(data.length > this.showCount){
            const btn = document.createElement("button");
            btn.id = "showMoreBtn";
            btn.innerText = this.currentDisplayCount >= data.length ? "Hide" : "Show More";
            btn.className = "show-more-btn";
            btn.addEventListener("click", () => {
                if(this.currentDisplayCount >= data.length){
                    this.currentDisplayCount = this.showCount;
                } else {
                    this.currentDisplayCount += this.showCount;
                }
                this.renderTimeline(filteredData);
                btn.scrollIntoView({behavior: "smooth"});
            });
            timeline.parentNode.insertBefore(btn, timeline.nextSibling);
        }
    }

    renderStats() {
        const total = this.contributions.reduce((acc,c) => acc + Number(c.Amount || 0),0);
        document.getElementById("goalAmount").innerText = "💰 ₹" + this.goalAmount;
        document.getElementById("totalAmount").innerText = "📊 ₹" + total;
        document.getElementById("remainingAmount").innerText = "⏳ ₹" + Math.max(this.goalAmount - total, 0);
        document.getElementById("entryCount").innerText = "📝 " + this.contributions.length;
    }

    renderProgress() {
        const total = this.contributions.reduce((acc,c) => acc + Number(c.Amount || 0),0);
        const percent = this.goalAmount > 0 ? Math.min((total / this.goalAmount) * 100, 100) : 0;

        const progressBar = document.getElementById("progressBar");
        progressBar.style.width = percent + "%";
        progressBar.innerText = Math.round(percent) + "%";

        // Dynamic gradient
        if(percent < 50){
            progressBar.style.background = 'linear-gradient(90deg, #b08d57, #d4af37)';
        } else if(percent < 80){
            progressBar.style.background = 'linear-gradient(90deg, #ffd700, #f1c40f)';
        } else if(percent < 100){
            progressBar.style.background = 'linear-gradient(90deg, #f1c40f, #f39c12)';
        } else {
            progressBar.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
            progressBar.style.boxShadow = '0 0 15px rgba(46,204,113,0.7)';
        }
    }

    renderPieChart() {
        const categoryMap = {};
        this.contributions.forEach(c => {
            const cat = c.Category || "Other";
            const amt = Number(c.Amount || 0);
            categoryMap[cat] = (categoryMap[cat] || 0) + amt;
        });

        const ctx = document.getElementById('categoryPieChart').getContext('2d');
        if(window.pieChart) window.pieChart.destroy();
        window.pieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(categoryMap),
                datasets: [{
                    data: Object.values(categoryMap),
                    backgroundColor: ['#2c7be5','#00b74a','#f6c23e','#e74a3b','#8e44ad','#fd7e14']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend:{ position:'bottom' },
                    title:{ display:true, text:`Contributions by Category (${this.fundName})` }
                }
            }
        });
    }
}
