/**
 * Church Contributions Portal - Automated Health Check
 * This script performs a comprehensive audit of the portal's status.
 */

(function() {
    console.log("%c 🛡️ Portal Health Check Started...", "background: #1e293b; color: #38bdf8; padding: 4px 8px; font-weight: bold; border-radius: 4px;");

    const results = {
        passed: [],
        failed: [],
        warnings: []
    };

    function check(name, condition, type = 'fail') {
        if (condition) {
            results.passed.push(name);
        } else {
            if (type === 'fail') results.failed.push(name);
            else results.warnings.push(name);
        }
    }

    // 1. Core Dependencies
    check("Chart.js is loaded", typeof Chart !== 'undefined');
    check("Dashboard Data is exposed", typeof window._currentContributions !== 'undefined' || document.title.includes("Members") || document.title.includes("About"), 'warn');

    // 2. DOM Integrity (Main Dashboard)
    if (window.location.href.includes("index.html")) {
        check("Stat Card: Goal", document.querySelector('[data-stat-type="goal"]'));
        check("Stat Card: Collected", document.querySelector('[data-stat-type="collected"]'));
        check("Stat Card: Remaining", document.querySelector('[data-stat-type="remaining"]'));
        check("Stat Card: Count", document.querySelector('[data-stat-type="count"]'));
        check("Timeline Container exists", document.getElementById("timelineContainer"));
        check("Insights Modal exists", document.getElementById("insightModal"));
        
        // Chart Canvases
        check("Bar Chart Canvas", document.getElementById("barChart"));
        check("Pie Chart Canvas", document.getElementById("pieChart"));
        check("Channel Pie Canvas", document.getElementById("sourcePieChart"));
    }

    // 3. Members Page integrity
    if (window.location.href.includes("members.html")) {
        check("Members List Grid", document.getElementById("membersList"));
        check("Search Input", document.getElementById("memberSearch"));
    }

    // 4. Performance Check
    const latency = window.performance ? performance.now() : 0;
    check("Reasonable load time", latency < 5000, 'warn');

    // Report Results
    console.group("%c 📊 Audit Report", "font-weight: bold; color: #10b981;");
    console.log(`✅ Passed: ${results.passed.length}`);
    if (results.passed.length > 0) console.table(results.passed);
    
    if (results.failed.length > 0) {
        console.log(`❌ Failed: ${results.failed.length}`);
        console.table(results.failed);
    } else {
        console.log("🚀 No Critical Failures Found!");
    }

    if (results.warnings.length > 0) {
        console.log(`⚠️ Warnings: ${results.warnings.length}`);
        console.table(results.warnings);
    }
    console.groupEnd();

    // Visual feedback for the tester
    const badge = document.createElement("div");
    badge.id = "portal-audit-badge";
    badge.innerHTML = results.failed.length === 0 ? "🛡️ Audit Passed" : `❌ Audit Failed (${results.failed.length})`;
    Object.assign(badge.style, {
        position: "fixed", bottom: "20px", right: "20px", padding: "12px 20px",
        background: results.failed.length === 0 ? "#10b981" : "#ef4444", color: "#fff",
        borderRadius: "30px", fontSize: "14px", fontWeight: "bold", z-index: "99999",
        boxShadow: "0 10px 25px rgba(0,0,0,0.2)", pointerEvents: "none", transition: "all 0.5s ease"
    });
    document.body.appendChild(badge);
    setTimeout(() => badge.style.opacity = "0", 3000);
})();
