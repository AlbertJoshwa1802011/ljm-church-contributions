/**
 * RAZORPAY WEBHOOK & MONTHLY EMAIL REPORT HANDLER
 * 
 * Instructions:
 * 1. Copy this code and append it to your existing App Script project.
 * 2. Set your Razorpay Webhook Secret in the RAZORPAY_WEBHOOK_SECRET variable below.
 * 3. Deploy it as a Web App (Choose "Execute as: Me", "Who has access: Anyone").
 * 4. Add the Web App URL to your Razorpay Dashboard -> Webhooks settings.
 * 5. Set Razorpay webhook events to listen for: "payment.captured".
 * 
 * To enable Monthly Reports:
 * 1. Open the App Script editor.
 * 2. Go to Triggers (clock icon on the left).
 * 3. Add Trigger -> Choose function `sendMonthlyReport` -> Time-driven -> Month timer -> 1st day of month.
 */

// --- SECURITY CONFIGURATION ---
// We now store sensitive information securely in Google's PropertiesService
// Run `setupSecurityProperties()` once from the Apps Script editor to initialize them.
const SHEET_ID = "1BsuLjPmFrW85AnZgmicrCj0vWlbQ4OH369PdBVA3zyE"; 

/**
 * Helper to fetch secure environment variables
 */
function getEnv(key) {
  const val = PropertiesService.getScriptProperties().getProperty(key);
  // Fallback for ADMIN_EMAIL if PropertiesService isn't set up yet
  if (!val && key === "ADMIN_EMAIL") return "albertjoshrock101@gmail.com";
  return val;
}

/**
 * Run this function ONCE from the Apps Script editor to securely store your keys.
 * Doing this removes hardcoded secrets from your script logic (Best Practice).
 */
function setupSecurityProperties() {
  PropertiesService.getScriptProperties().setProperties({
    "ADMIN_EMAIL": "albertjoshrock101@gmail.com",
    "RAZORPAY_WEBHOOK_SECRET": "YOUR_WEBHOOK_SECRET_HERE",
    "RAZORPAY_KEY_ID": "YOUR_LIVE_KEY_ID_HERE", // Used for Server-to-Server verification
    "RAZORPAY_KEY_SECRET": "YOUR_LIVE_KEY_SECRET_HERE" 
  });
  Logger.log("✅ Security properties established successfully. You can now clear the dummy values from the code here if you want.");
}

// --- SMART NOTIFICATION CONFIGURATION ---
const NOTIFICATION_CONFIG = {
  SMS_ENABLED: false,             // Set to true once you have a provider (e.g., Twilio)
  WHATSAPP_ENABLED: false,        // Set to true once you have a provider
  PROVIDER_API_KEY: "YOUR_API_KEY_HERE",
  TWILIO_SID: "YOUR_TWILIO_SID",
  TWILIO_TOKEN: "YOUR_TWILIO_TOKEN",
  TWILIO_PHONE: "YOUR_TWILIO_PHONE" // e.g., "+1234567890"
};

/**
 * Handle incoming Webhook from Razorpay
 */
function doPost(e) {
  try {
    const rawBody = e.postData.contents;
    
    // --- SECURITY: Strict Payload Size Limit (Anti-DDoS) ---
    if (rawBody.length > 20000) {
      console.warn("Payload size exceeded limit.", rawBody.length);
      return ContentService.createTextOutput("Payload too large").setMimeType(ContentService.MimeType.TEXT);
    }

    // --- SECURITY: Basic Webhook Secret Verification ---
    const urlSecret = e.parameter.secret;
    const expectedSecret = getEnv("RAZORPAY_WEBHOOK_SECRET");
    
    if (expectedSecret && expectedSecret !== "YOUR_WEBHOOK_SECRET_HERE") {
      if (urlSecret !== expectedSecret) {
        console.error("Unauthorized: Secret mismatch.");
        return ContentService.createTextOutput("Unauthorized").setMimeType(ContentService.MimeType.TEXT);
      }
    } else {
      console.warn("Webhook secret not configured in PropertiesService. Skipping basic URL secret check.");
    }

    const payload = JSON.parse(rawBody);
    console.log("Payload Event: " + payload.event);

    if (payload.event === "payment.captured") {
      const paymentEntity = payload.payload.payment.entity;
      const paymentId = paymentEntity.id;
      const expectedAmount = paymentEntity.amount; // in paise
      
      // --- SECURITY: Server-to-Server Payment Verification ---
      // This eliminates the risk of spoofed webhooks by calling Razorpay directly
      // using the secure Key Secret to verify the payment actually happened.
      const isGenuine = verifyRazorpayPayment(paymentId, expectedAmount);
      if (!isGenuine) {
        console.error(`🚨 SPOOF ATTEMPT DETECTED! Payment verification failed for ID: ${paymentId}`);
        return ContentService.createTextOutput("Verification Failed").setMimeType(ContentService.MimeType.TEXT);
      }

      const amountPaid = expectedAmount / 100; // Razorpay amounts are in paise
      const rawDate = new Date(paymentEntity.created_at * 1000);
      const paymentDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
      const method = paymentEntity.method;
      const upiId = paymentEntity.vpa ? String(paymentEntity.vpa).substring(0, 100) : ""; 
      const contact = paymentEntity.contact ? String(paymentEntity.contact).substring(0, 50) : "";
      const contributorEmail = paymentEntity.email ? String(paymentEntity.email).substring(0, 100) : ""; 

      // Data sanitization
      const notes = paymentEntity.notes || {};
      const rawMemberName = notes.memberName || "Online Contributor";
      const memberName = String(rawMemberName).substring(0, 200).replace(/[=+\-@>]/g, ""); // Prevent formula injection
      let fundName = notes.fundName || "tech-contributions"; 
      
      // Auto-map aliases
      if (fundName.toLowerCase().includes("tech")) fundName = "tech-contributions";
      if (fundName.toLowerCase().includes("christmas")) fundName = "christmas-fund";

      console.log(`Processing payment for ${memberName} (${amountPaid}) into ${fundName}`);

      const ss = SpreadsheetApp.openById(SHEET_ID);
      const sheet = ss.getSheetByName(fundName);
      
      if (sheet) {
        // --- SECURITY: Idempotency Check (Prevent Duplicates) ---
        if (isDuplicatePayment(sheet, paymentId)) {
          console.warn(`Idempotency trigger: Payment ${paymentId} already exists in ${fundName}. Skipping.`);
          return ContentService.createTextOutput("Duplicate payment ignored").setMimeType(ContentService.MimeType.TEXT);
        }

        const proofOfPayment = `ID: ${paymentId} | Method: ${method} ${upiId ? '('+upiId+')' : ''} | Contact: ${contact}`;
        
        // Find proper last row (avoid jumping to 1001 if formulas exist)
        const lastRow = getRealLastRow(sheet);
        const nextRow = lastRow + 1;
        
        let newRow = [
          memberName, 
          amountPaid, 
          paymentDate, 
          "Online (Verified)", 
          proofOfPayment
        ];
        
        // Write the row
        sheet.getRange(nextRow, 1, 1, newRow.length).setValues([newRow]);
        
        // Color-code the new row (Light Purple for Razorpay)
        sheet.getRange(nextRow, 1, 1, sheet.getLastColumn()).setBackground("#f3e5f5");
        
        console.log(`Row successfully added to row ${nextRow}`);
        
        // --- Immediate Email Alerts ---
        const adminEmail = getEnv("ADMIN_EMAIL");
        try {
          if (adminEmail) {
            MailApp.sendEmail({
              to: adminEmail,
            subject: `New Contribution Received: ₹${amountPaid} from ${memberName}`,
            htmlBody: `
              <div style="font-family: Arial, sans-serif;">
                <h2>New Contribution Alert</h2>
                <p>A new payment has been successfully recorded for the <strong>${fundName}</strong>.</p>
                <ul>
                  <li><strong>Member:</strong> ${memberName}</li>
                  <li><strong>Amount:</strong> ₹${amountPaid}</li>
                  <li><strong>Razorpay ID:</strong> ${paymentId}</li>
                  <li><strong>Method:</strong> ${method} ${upiId ? '('+upiId+')' : ''}</li>
                  <li><strong>Contributor Contact:</strong> ${contact}</li>
                  <li><strong>Contributor Email:</strong> ${contributorEmail}</li>
                  <li><strong>Date:</strong> ${paymentDate.toLocaleString()}</li>
                </ul>
                <p><a href="https://docs.google.com/spreadsheets/d/${SHEET_ID}">View Google Sheet</a></p>
              </div>
            `
            });
            console.log("Email alert sent to admin: " + adminEmail);
          }

          // Send to Contributor (if email is available)
          if (contributorEmail) {
            MailApp.sendEmail({
              to: contributorEmail,
              subject: `Thank you for your contribution to LJM Church!`,
              htmlBody: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                  <h2 style="color: #673ab7;">Thank You, ${memberName}!</h2>
                  <p>We have received your contribution of <strong>₹${amountPaid}</strong> towards the <strong>${fundName}</strong>.</p>
                  <p>Your support helps us continue our mission and maintain our church activities.</p>
                  <hr>
                  <p style="font-size: 14px;"><strong>Transaction Details:</strong></p>
                  <ul>
                    <li><strong>Amount Paid:</strong> ₹${amountPaid}</li>
                    <li><strong>Payment ID:</strong> ${paymentId}</li>
                    <li><strong>Date:</strong> ${paymentDate.toLocaleString()}</li>
                  </ul>
                  <p>May God bless you for your generosity!</p>
                  <hr>
                  <p style="font-size: 12px; color: #777;">This is an automated confirmation of your contribution via LJM Church Online Portal.</p>
                </div>
              `
            });
            console.log("Confirmation email sent to contributor: " + contributorEmail);
          }

          // --- SMART: SMS/WhatsApp Notifications ---
          if (contact) {
            const message = `Praise the Lord ${memberName}! We received your contribution of ₹${amountPaid} for ${fundName}. ID: ${paymentId}. Thank you!`;
            
            if (NOTIFICATION_CONFIG.SMS_ENABLED) {
              sendSMSNotification(contact, message);
            }
            if (NOTIFICATION_CONFIG.WHATSAPP_ENABLED) {
              sendWhatsAppNotification(contact, message);
            }
          }
        } catch (mailErr) {
          console.error("Failed to send email/SMS alerts: ", mailErr.toString());
        }

        // Log to a separate "audit_log" sheet if it exists
        const auditSheet = ss.getSheetByName("audit_log");
        if (auditSheet) {
          const auditNextRow = auditSheet.getLastRow() + 1;
          auditSheet.getRange(auditNextRow, 1, 1, 6).setValues([[new Date(), paymentId, memberName, amountPaid, fundName, JSON.stringify(payload)]]);
        }
      } else {
        console.error("Error: Sheet '" + fundName + "' not found.");
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    console.error("General Error in doPost: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}


/**
 * Sends a monthly email report to the admin summing up recent tech contributions
 * Run this automatically via a Time-Driven Trigger on the 1st of every month.
 */
function sendMonthlyReport() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName("tech-contributions");
  
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  const dateIdx = headers.indexOf('date');
  const amountIdx = headers.indexOf('amount');
  const memberIdx = headers.indexOf('member');
  const notesIdx = headers.indexOf('notes');
  
  if (dateIdx < 0 || amountIdx < 0) return;
  
  // Calculate prior month
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const priorMonthIndex = lastMonth.getMonth();
  const priorYear = lastMonth.getFullYear();

  let monthlyTotal = 0;
  let onlineTotal = 0;
  let contributionDetails = "";
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowDateObj = new Date(row[dateIdx]);
    
    if (rowDateObj.getMonth() === priorMonthIndex && rowDateObj.getFullYear() === priorYear) {
      const amount = Number(row[amountIdx]) || 0;
      monthlyTotal += amount;
      
      const member = row[memberIdx] ? row[memberIdx].toString() : "Unknown";
      const notes = row[notesIdx] ? row[notesIdx].toString() : "";
      
      let typeLabel = "Manual";
      if (notes.toLowerCase().includes("razorpay")) {
        onlineTotal += amount;
        typeLabel = "Online/UPI";
      }
      
      contributionDetails += `<li>${member}: ₹${amount} (${typeLabel})</li>`;
    }
  }

  const monthName = lastMonth.toLocaleString('default', { month: 'long' });
  
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Monthly Contribution Report - ${monthName} ${priorYear}</h2>
      <p>Hello,</p>
      <p>Here is the automated contribution report for the past month covering the Tech Fund.</p>
      
      <h3>Summary</h3>
      <ul>
        <li><strong>Total Collected:</strong> ₹${monthlyTotal}</li>
        <li><strong>Online/UPI Contributions:</strong> ₹${onlineTotal}</li>
        <li><strong>Manual Contributions:</strong> ₹${monthlyTotal - onlineTotal}</li>
      </ul>
      
      <h3>Details</h3>
      <ul>
        ${contributionDetails || "<li>No contributions found for this month.</li>"}
      </ul>
      
      <hr>
      <p style="font-size: 12px; color: #777;">This is an automatically generated email from your Church Contributions system.</p>
    </div>
  `;

  const adminEmail = getEnv("ADMIN_EMAIL");
  if (adminEmail) {
    MailApp.sendEmail({
      to: adminEmail,
      subject: `Monthly Contribution Report - ${monthName} ${priorYear}`,
      htmlBody: emailHtml
    });
  }
}

/**
 * Run this manually from the Apps Script editor to test if your Email permissions are working.
 */
function testManualEmail() {
  const email = Session.getActiveUser().getEmail();
  MailApp.sendEmail({
    to: email,
    subject: "Test Email from LJM Church Script",
    body: "If you are reading this, your Apps Script is authorized to send emails! ✅"
  });
  Logger.log("Test email sent to: " + email);
}

/**
 * Add a custom menu to the spreadsheet.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('LJM Church Extras')
    .addItem('Generate Monthly Report Now', 'sendMonthlyReport')
    .addItem('Test Email Permissions', 'testManualEmail')
    .addToUi();
}

/**
 * FIX: Find the last row that actually has content in the Member/Amount columns,
 * instead of just picking up the last row with a formula.
 */
function getRealLastRow(sheet) {
  const range = sheet.getRange("A:B"); // Check both Member and Amount columns
  const values = range.getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    // Check if either Member name or Amount exists
    if ((values[i][0] && values[i][0].toString().trim() !== "") || 
        (values[i][1] && values[i][1].toString().trim() !== "")) {
      return i + 1;
    }
  }
  return 0;
}

/**
 * Run this from the Apps Script editor to see where the next row would be added.
 */
function debugRowPlacement() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const funds = ["tech-contributions", "christmas-fund"];
  
  funds.forEach(fundName => {
    const sheet = ss.getSheetByName(fundName);
    if (sheet) {
      const lastRow = getRealLastRow(sheet);
      Logger.log(`Sheet '${fundName}' real last row: ${lastRow}. Next entry will be on: ${lastRow + 1}`);
    } else {
      Logger.log(`Sheet '${fundName}' not found.`);
    }
  });
}

/**
 * --- SECURITY FEATURE: Server-to-Server Verification ---
 * Verify with Razorpay API that this payment ID actually exists and has the expected amount.
 * This prevents webhook spoofing.
 */
function verifyRazorpayPayment(paymentId, expectedAmount) {
  try {
    const keyId = getEnv("RAZORPAY_KEY_ID");
    const keySecret = getEnv("RAZORPAY_KEY_SECRET");
    
    // Fallback if not configured yet
    if (!keyId || !keySecret || keyId === "YOUR_LIVE_KEY_ID_HERE") {
      console.warn("Server-to-Server verification skipped (Keys not configured). Trusting webhook payload.");
      return true; // Weak security, but keeps system running if keys aren't added
    }

    const url = "https://api.razorpay.com/v1/payments/" + paymentId;
    const options = {
      "method": "get",
      "headers": {
        "Authorization": "Basic " + Utilities.base64Encode(keyId + ":" + keySecret)
      },
      "muteHttpExceptions": true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
      console.error("Razorpay API returned " + response.getResponseCode());
      return false;
    }
    
    // Verify payload strictly
    const data = JSON.parse(response.getContentText());
    if (data.status === "captured" && data.amount === expectedAmount) {
      return true;
    }
    
    return false;
  } catch(e) {
    console.error("API Verification Error: " + e.toString());
    return false;
  }
}

/**
 * --- SECURITY FEATURE: Idempotency Check ---
 * Prevents double-counting if Razorpay triggers the exact same webhook twice.
 */
function isDuplicatePayment(sheet, paymentId) {
  try {
    const numRows = sheet.getLastRow();
    if (numRows < 2) return false;
    
    // Optimisation: only check the last 50 entries
    const startRow = Math.max(2, numRows - 50);
    const numRowsToCheck = numRows - startRow + 1;
    
    // Assuming Column E (5) is proofOfPayment which contains the ID
    const values = sheet.getRange(startRow, 5, numRowsToCheck, 1).getValues(); 
    
    for (let i = 0; i < values.length; i++) {
      if (values[i][0].toString().includes(paymentId)) {
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error("Idempotency Check Error: " + err.toString());
    return false; // Fail open
  }
}

/**
 * SMS Notification Wrapper (Twilio Placeholder)
 */
function sendSMSNotification(to, message) {
  try {
    if (!NOTIFICATION_CONFIG.TWILIO_SID || NOTIFICATION_CONFIG.TWILIO_SID === "YOUR_TWILIO_SID") {
      console.warn("SMS triggered but Twilio SID not configured.");
      return;
    }
    
    console.log("[MOCK] SMS would be sent to " + to + ": " + message);
  } catch (err) {
    console.error("Error in sendSMSNotification: " + err.toString());
  }
}

/**
 * WhatsApp Notification Wrapper Placeholder
 */
function sendWhatsAppNotification(to, message) {
  try {
    console.log("[MOCK] WhatsApp would be sent to " + to + ": " + message);
  } catch (err) {
    console.error("Error in sendWhatsAppNotification: " + err.toString());
  }
}
