/**
 * WEBHOOK DIAGNOSTIC TOOL
 * 
 * Use this to verify that your script is correctly configured to write to the sheet.
 * Copy this into your Apps Script editor and click "Run".
 */

function runManualWebhookTest() {
  const SHEET_ID = "1BsuLjPmFrW85AnZgmicrCj0vWlbQ4OH369PdBVA3zyE";
  const TEST_FUND = "tech-contributions";
  const TEST_PAYMENT_ID = "test_diag_" + Date.now();
  
  console.log("🚀 Starting Manual Webhook Logic Test...");
  
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(TEST_FUND);
    
    if (!sheet) {
      console.error(`❌ ERROR: Sheet named '${TEST_FUND}' not found! Please check the name in your spreadsheet.`);
      return;
    }
    
    // Simulate the data row
    const testRow = [
      "Test User (Diagnoser)",
      1.00,
      new Date().toLocaleString(),
      "Online (Manual Test)",
      `ID: ${TEST_PAYMENT_ID} | Method: manual_diag | Contact: test`
    ];
    
    // Attempt to write
    const lastRow = getRealLastRow(sheet);
    const nextRow = lastRow + 1;
    sheet.getRange(nextRow, 1, 1, testRow.length).setValues([testRow]);
    sheet.getRange(nextRow, 1, 1, testRow.length).setBackground("#e8f5e9"); // Light green for test
    
    console.log(`✅ SUCCESS: Test row added to sheet '${TEST_FUND}' at row ${nextRow}.`);
    console.log("Check your Google Sheet now. If the row appeared, your sheet access logic is WORKING.");
    
    // Check PropertiesService
    const secret = PropertiesService.getScriptProperties().getProperty("RAZORPAY_WEBHOOK_SECRET");
    const keyId = PropertiesService.getScriptProperties().getProperty("RAZORPAY_KEY_ID");
    
    if (!secret || secret === "YOUR_WEBHOOK_SECRET_HERE") {
      console.warn("⚠️ WARNING: RAZORPAY_WEBHOOK_SECRET is NOT set correctly in Script Properties.");
    } else {
      console.log("✅ RAZORPAY_WEBHOOK_SECRET is set.");
    }
    
    if (!keyId || keyId === "YOUR_LIVE_KEY_ID_HERE") {
      console.warn("⚠️ WARNING: RAZORPAY_KEY_ID is NOT set correctly. Payment verification will be skipped.");
    } else {
      console.log("✅ RAZORPAY_KEY_ID is set.");
    }
    
  } catch (err) {
    console.error("❌ CRITICAL ERROR during test: " + err.toString());
  }
}
