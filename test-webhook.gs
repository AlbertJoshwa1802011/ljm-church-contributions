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

  // --- TEST 4: E2E doPost Integration Test ---
  let originalSpreadsheetApp = null;
  try {
    // 1. Mock global SpreadsheetApp
    originalSpreadsheetApp = SpreadsheetApp;
    
    let writtenRow = null;
    let validationCleared = false;
    let backgroundSet = false;
    
    SpreadsheetApp = {
      openById: function(id) {
        return {
          getName: function() { return "LJM Church contributions mock"; },
          getSheetByName: function(name) {
            // Mock tech-contributions sheet
            if (name === "tech-contributions") {
              return {
                getLastRow: function() { return 2; },
                getMaxColumns: function() { return 7; },
                getLastColumn: function() { return 6; },
                getRange: function(row, col, numRows, numCols) {
                  return {
                    getValues: function() {
                      if (row === 1) {
                        return [["Member Name", "Amount", "Date", "Category", "Notes", "Proof/ID", "Email", "Phone"]];
                      }
                      return [["Muthukumar", 500, "2026-07-07 18:16:02", "Online (Verified)", "July: Online Payment Received", "ID: pay_old_123", "thinkmuthu@gmail.com", "9940940326"]];
                    },
                    setDataValidation: function(val) {
                      validationCleared = true;
                    },
                    setValues: function(vals) {
                      writtenRow = vals[0];
                    },
                    setBackground: function(color) {
                      backgroundSet = true;
                    },
                    setValue: function(val) {
                      // Mock setValue for headers
                    }
                  };
                }
              };
            }
            
            // Mock members sheet
            if (name === "members" || name === "members-list") {
              return {
                getLastRow: function() { return 2; },
                getLastColumn: function() { return 8; },
                getDataRange: function() {
                  return {
                    getValues: function() {
                      return [
                        ["Member Name", "Email", "Phone", "First Join Date", "Last Contribution Date", "Recurring Reminders", "Total Contributions", "Reminders Sent"],
                        ["Test Member", "test_member@gmail.com", "+919999999999", "2026-07-07 11:40:00", "2026-07-07 11:40:00", "Yes", 1, 0]
                      ];
                    }
                  };
                },
                getRange: function(r, c) {
                  return {
                    getValue: function() { return 1; },
                    setValue: function() {}
                  };
                }
              };
            }
            return null;
          }
        };
      }
    };
    
    // 2. Prepare mock request payload
    const mockRequest = {
      postData: {
        contents: JSON.stringify({
          event: "payment.captured",
          payload: {
            payment: {
              entity: {
                id: "pay_test_999",
                amount: 150000, // 1500 INR in paise
                created_at: 1783448400, // Unix timestamp for 2026-07-07 18:20:00 UTC
                method: "upi",
                vpa: "albert@okaxis",
                email: "test_contributor@gmail.com",
                contact: "+919999999999",
                notes: {
                  memberName: "Test Member",
                  memberEmail: "test_member@gmail.com",
                  fundName: "Tech Fund",
                  month: "July"
                }
              }
            }
          }
        })
      },
      parameter: {
        isLocalTest: "true"
      }
    };
    
    // 3. Call doPost
    const response = doPost(mockRequest);
    const responseData = JSON.parse(response.getContent());
    
    assert(responseData.status === "success", "doPost returned success status");
    assert(writtenRow !== null, "doPost wrote a row to the mock sheet");
    if (writtenRow) {
      assert(writtenRow[0] === "Test Member", "Correct member name written");
      assert(writtenRow[1] === 1500, "Correct amount (converted from paise) written");
      assert(writtenRow[3] === "Online (Verified)", "Correct Category written");
      assert(writtenRow[4] === "July: Online Payment Received", "Correct Notes with month prefix written");
      assert(writtenRow[5].includes("pay_test_999"), "Razorpay payment ID correctly written inside Proof/ID column");
      assert(writtenRow[6] === "test_member@gmail.com", "Correct Email written");
      assert(writtenRow[7] === "+919999999999", "Correct Phone number written");
    }
    
  } catch (e) {
    Logger.log("❌ Exception in Test 4: " + e.toString());
    failed++;
  } finally {
    // 4. Restore original SpreadsheetApp
    if (originalSpreadsheetApp) {
      SpreadsheetApp = originalSpreadsheetApp;
    }
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
