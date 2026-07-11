# Feature Documentation: Recurring Reminders & Member Profiles

This document explains the implementation of the "Smart Recurring Reminders" and "Member Profiles" systems added in Phase 1.

## 1. Member Profile Tracking (`payment-webhook.gs`)
**Goal**: Automatically maintain a database of contributors.

### Logic
*   Every time a Razorpay payment is captured, the `updateMemberProfile` function is called.
*   It checks for a sheet named `members`. If it doesn't exist, it creates one with headers: `Member Name`, `Email`, `Phone`, `First Join Date`, `Last Contribution Date`, `Recurring Reminders`, `Total Contributions`.
*   It matches the member by **Name** or **Email**.
*   **New Members**: A new row is appended with `Recurring Reminders` set to "Yes" by default.
*   **Existing Members**: The `Last Contribution Date` and `Total Contributions` count are updated.

---

## 2. Smart Reminder System (`reminder-system.gs`)
**Goal**: Polite monthly nudges for faithful members.

### Logic
*   **Frequency**: Designed to run once daily via a Google Apps Script **Time-driven trigger**.
*   **Scanning**: Scans the `members` sheet for anyone where `Recurring Reminders == "Yes"`.
*   **Threshold**: Calculates the days since `Last Contribution Date`. If >= 30 days, a reminder is triggered.
*   **Channels**:
    *   **Email**: Sends a premium-styled HTML email with a direct link to the contribution portal.
    *   **WhatsApp**: Triggers the `sendWhatsAppNotification` hook (placeholder/API) with a polite message.

---

## 3. Admin Dashboard (`admin.html`)
**Goal**: centralized management for the church office.

### Features
*   **Analytics**: Real-time charts for giving trends and fund distribution.
*   **Member List**: View contribution frequency and subscription status.
*   **Theme**: Modern dark-mode interface (Premium aesthetic).

---

## Security & Safety
1.  **Production Guardrails**: All database updates use strict `Sheet.getRange()` logic to avoid overwriting production data.
2.  **Idempotency**: The system continues to use Razorpay Payment IDs to prevent duplicate entries in the contribution logs.
