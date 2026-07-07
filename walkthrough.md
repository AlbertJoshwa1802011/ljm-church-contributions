# Walkthrough - Stable Branch, Webhook Fix & Deployment Automation

We have completed the setup for automatic deployments, resolved the double-entry callback bug, and added a comprehensive test suite.

## Changes Completed

### 1. Created `stable-production` Branch
* Stashed work-in-progress on `feat/admin-dashboard`.
* Downloaded exact frontend files from your live `pages.dev` URL.
* Checked them into `stable-production` to serve as a 100% accurate rollback/stable baseline.

### 2. Set Up Automatic Deployments (GitHub Actions)
* Created `.github/workflows/deploy.yml` on the `main` branch.
* Whenever you merge a branch to `main`, GitHub Actions will automatically deploy the latest files to your Cloudflare Pages project.

### 3. Fixed Razorpay Webhook Double-Entries
* Overwrote our local code with your latest `payment-webhook.gs` code to keep them in sync.
* Modified `isDuplicatePayment()` to search for duplicate payment IDs dynamically in the headers (matching the dynamic writing logic). This fixes the bug where it was checking the wrong hardcoded column.

### 4. Added Comprehensive Test Suite
* Created `test-webhook.gs` containing unit tests for:
  - Fund Name Normalization (`test 1`)
  - HMAC SHA256 Signature Verification (`test 2`)
  - Duplicate Payment Idempotency Check (`test 3` using a mock sheet)

---

## What You Need to Do Next

### 1. Update your Google Sheet Apps Script
Open your Google Sheet Apps Script editor and copy-paste the contents of the following files:
* Replace your existing `payment-webhook.gs` with the code in [payment-webhook.gs](file:///Users/albert-18677/Documents/church-contributions/payment-webhook.gs).
* Create a new file named `test-webhook` and paste the contents of [test-webhook.gs](file:///Users/albert-18677/Documents/church-contributions/test-webhook.gs).

### 2. Run the Unit Tests
In the Apps Script editor:
1. Select `runAllWebhookTests` from the top dropdown list.
2. Click **Run**.
3. View the logs to confirm all test cases pass successfully.

### 3. Deploy a New Version in Apps Script
Once the tests pass:
1. Click **Deploy** -> **Manage deployments**.
2. Edit the current active deployment and select **New version**.
3. Click **Deploy**. (This ensures the webhook URL is using the fixed code).
