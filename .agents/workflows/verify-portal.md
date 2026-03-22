---
description: Mandatory Verification Workflow for Church Contributions Portal
---

This workflow MUST be followed after any change to the UI, CSS, or `script.js` to ensure zero regressions.

1.  **Automated Health Check**:
    - Open the portal in the browser.
    - Run `f'verify-portal.js'` in the console or inject the script.
    - Confirm the "🛡️ Audit Passed" badge appears.
    - Check the console group "📊 Audit Report" for any warnings.

// turbo
2.  **Full-Portal Browser Audit**:
    - Use the `browser_subagent` to visit the following pages:
        - `index.html?fund=Tech Fund`
        - `index.html?fund=Christmas Fund`
        - `members.html`
        - `members.html?member=[Specific Name]`
    - For each page, verify:
        - No JavaScript errors in the console.
        - All stat cards show accurate, non-zero data (unless it's a new fund).
        - All charts in "Giving Insights" render (no grey placeholders).
        - Search functionality on the members page works in real-time.

3.  **Responsive Validation**:
    - Check the main dashboard on a mobile viewport (375x812).
    - Ensure stat cards stack vertically and text is readable.
    - Verify that tooltips and modal close buttons are accessible via touch pixels.

4.  **Documentation**:
    - Capture screenshots of any updated components.
    - Update `walkthrough.md` with a "Verification Certificate" showing the latest audit results.
