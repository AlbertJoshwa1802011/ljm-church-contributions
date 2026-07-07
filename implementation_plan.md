# Razorpay Webhook Duplicate Fix & Test Suite Implementation Plan

We will fix the duplicate payment entries issue in the Razorpay webhook and add a comprehensive test suite directly in Apps Script to verify all parts of the webhook logic.

## User Review Required

No breaking changes are expected. The bug fix adjusts the column index checked during duplicate detection.

## Proposed Changes

### [Apps Script Backend]

#### [MODIFY] [payment-webhook.gs](file:///Users/albert-18677/Documents/church-contributions/payment-webhook.gs)
- Correct the column index checked in `isDuplicatePayment(sheet, paymentId)` from column `5` (Notes) to column `6` (Proof/ID / transaction ID).
- Refactor the function to make it robust and easy to test.

#### [NEW] [test-webhook.gs](file:///Users/albert-18677/Documents/church-contributions/test-webhook.gs)
- Create a complete in-editor test suite containing:
  - `testIsDuplicatePayment()`: Unit tests for duplicate checking using mock sheet behavior.
  - `testVerifySignature()`: Unit tests for checking signature verification.
  - `testNormalizeFund()`: Unit tests for fund mapping rules.
  - A main test runner `runAllTests()` that outputs results to the console.

## Verification Plan

### Manual Verification
- We will execute the test suite locally or verify that the logic is correct via unit/mock tests.
