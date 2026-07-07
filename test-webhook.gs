/**
 * WEBHOOK LOGIC TEST SUITE
 * 
 * Instructions:
 * 1. Copy this file into your Google Apps Script project (e.g., as `test-webhook.gs`).
 * 2. Select `runAllWebhookTests` from the function dropdown at the top and click "Run".
 * 3. View the Execution Log to see test results.
 */

function runAllWebhookTests() {
  Logger.log("🧪 STARTING WEBHOOK UNIT TESTS...");
  
  let passed = 0;
  let failed = 0;
  
  function assert(condition, message) {
    if (condition) {
      Logger.log("  ✅ PASS: " + message);
      passed++;
    } else {
      Logger.log("  ❌ FAIL: " + message);
      failed++;
    }
  }

  // --- TEST 1: Fund Name Normalization ---
  try {
    assert(normalizeFundName("Tech Fund") === "tech-contributions", "Tech Fund maps to tech-contributions");
    assert(normalizeFundName("tech-contributions") === "tech-contributions", "tech-contributions maps to tech-contributions");
    assert(normalizeFundName("Christmas Fund") === "christmas-fund", "Christmas Fund maps to christmas-fund");
    assert(normalizeFundName("christmas") === "christmas-fund", "christmas maps to christmas-fund");
    assert(normalizeFundName("") === "tech-contributions", "Empty fund defaults to tech-contributions");
    assert(normalizeFundName(null) === "tech-contributions", "Null fund defaults to tech-contributions");
  } catch (e) {
    Logger.log("❌ Exception in Test 1: " + e.toString());
    failed++;
  }

  // --- TEST 2: Signature Verification ---
  try {
    const secret = "test_webhook_secret";
    const payload = '{"event":"payment.captured"}';
    
    // Calculate expected signature using standard hmac
    const expectedSig = Utilities.computeHmacSignature(
      Utilities.MacAlgorithm.HMAC_SHA_256,
      payload,
      secret
    ).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
    
    assert(verifySignature(payload, expectedSig, secret) === true, "Valid signature verifies correctly");
    assert(verifySignature(payload, "invalid_signature", secret) === false, "Invalid signature fails verification");
    assert(verifySignature(payload, expectedSig, "wrong_secret") === false, "Wrong secret fails verification");
  } catch (e) {
    Logger.log("❌ Exception in Test 2: " + e.toString());
    failed++;
  }

  // --- TEST 3: Duplicate Payment Idempotency Check ---
  try {
    // Create Mock Sheet
    const mockSheet = {
      lastRow: 10,
      getLastRow: function() { return this.lastRow; },
      getLastColumn: function() { return 6; },
      
      // Mock getRange behavior
      getRange: function(row, col, numRows, numCols) {
        return {
          row: row,
          col: col,
          numRows: numRows,
          getValues: function() {
            // If checking header row (row 1)
            if (row === 1) {
              return [["Member Name", "Amount", "Date", "Category", "Notes", "Proof/ID"]];
            }
            
            // Return dummy transactions where "pay_duplicate_123" already exists
            return [
              ["ID: pay_original_999 | Method: upi"],
              ["ID: pay_duplicate_123 | Method: card"],
              ["ID: pay_another_456 | Method: netbanking"]
            ];
          }
        };
      }
    };

    assert(isDuplicatePayment(mockSheet, "pay_duplicate_123") === true, "Identifies existing duplicate payment ID");
    assert(isDuplicatePayment(mockSheet, "pay_new_payment_789") === false, "Identifies new unique payment ID");
  } catch (e) {
    Logger.log("❌ Exception in Test 3: " + e.toString());
    failed++;
  }

  Logger.log(`\n📊 TEST SUMMARY:`);
  Logger.log(`   Passed: ${passed}`);
  Logger.log(`   Failed: ${failed}`);
  
  if (failed === 0) {
    Logger.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  } else {
    Logger.log("🚨 SOME TESTS FAILED. Please review the execution log.");
  }
}
