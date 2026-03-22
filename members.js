document.addEventListener("DOMContentLoaded", () => {
    fetchMembers();
});

const API_URL =
  "https://script.google.com/macros/s/AKfycbzSyqYH-JR_JiJzkAxgxPEH1dPq8XPcQ3eUxtBx7HA76eTfReMlZq8GCPnOidotKkuW/exec?fund=tech-contributions";

let allMembers = [];
let memberEmails = {}; // Store mapping

function fetchMembers() {
    fetch(API_URL, { credentials: "omit" })
        .then(res => res.json())
        .then(data => {
            const contributions = data.contributions || [];
            memberEmails = data.memberEmails || {}; // Update mapping
            extractMembers(contributions);
            renderMembers(allMembers);
        })
        .catch(err => console.error(err));
}

function extractMembers(contributions) {
    const set = new Set();

    contributions.forEach(c => {
        if (c.Member) {
            set.add(c.Member.trim());
        }
    });

    allMembers = Array.from(set).sort();
}

function renderMembers(list) {
    const grid = document.getElementById("membersGrid");
    grid.innerHTML = "";

    list.forEach(name => {
        const email = memberEmails[name] || "";
        const card = document.createElement("div");
        card.className = "member-card";
        card.innerHTML = `
            <div class="member-avatar">🙏</div>
            <div class="member-name">${name}</div>
            ${email ? `<div class="member-email" style="font-size: 11px; opacity: 0.7; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${email}</div>` : ''}
        `;
        card.onclick = () => {
            window.location.href =
                `member.html?name=${encodeURIComponent(name)}`;
        };
        grid.appendChild(card);
    });
}

// Search
document.getElementById("memberSearch").addEventListener("input", e => {
    const term = e.target.value.toLowerCase();
    const filtered = allMembers.filter(m =>
        m.toLowerCase().includes(term)
    );
    renderMembers(filtered);
});
