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

const API_URL = "https://script.google.com/macros/s/AKfycbyn7BAXvOI-GRNI3DfFBXc6tBAgcuwlKu2PWgJ-JKi-ShZEP-eOnzmvxC01AjGsevQd/exec?fund=tech-contributions";

function fetchMemberData(memberName) {
    fetch(API_URL, { credentials: "omit" })
        .then(res => res.json())
        .then(data => {
            const contributions = data.contributions || [];
            const memberData = contributions.filter(
                c => (c.Member || "").toLowerCase() === memberName.toLowerCase()
            );

            renderMemberDashboard(memberName, memberData);
        })
        .catch(err => console.error("Error:", err));
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
    document.getElementById("totalGiven").innerText = "₹" + total;
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
            <strong>₹${amt}</strong>
        `;
        fundSummary.appendChild(row);
    });

    // Timeline
    const timeline = document.getElementById("memberTimeline");
    timeline.innerHTML = "";

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
