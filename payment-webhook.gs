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
 * TEST CONNECTION: Run this from the Apps Script editor 
 * to check if the script can see your spreadsheet.
 */
function testSpreadsheetConnection() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheets = ss.getSheets().map(s => s.getName());
    Logger.log("✅ Success! Connected to: " + ss.getName());
    Logger.log("Available Sheets: " + sheets.join(", "));
  } catch (e) {
    Logger.log("❌ Error connecting to spreadsheet: " + e.toString());
    Logger.log("Make sure SHEET_ID is correct and you have shared the sheet with the email running this script.");
  }
}

/**
 * Helper to fetch secure environment variables
 */
function getEnv(key) {
  const val = PropertiesService.getScriptProperties().getProperty(key);
  // Fallback for ADMIN_EMAIL if PropertiesService isn't set up yet
  if (!val && key === "ADMIN_EMAIL") return "albertjoshrock101@gmail.com,thinkmuthu@gmail.com,augustinraja261@gmail.com";
  return val;
}

/**
 * Run this function ONCE from the Apps Script editor to securely store your keys.
 * Doing this removes hardcoded secrets from your script logic (Best Practice).
 */
function setupSecurityProperties() {
  PropertiesService.getScriptProperties().setProperties({
    "ADMIN_EMAIL": "albertjoshrock101@gmail.com,thinkmuthu@gmail.com,augustinraja261@gmail.com",
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
    // --- SECURITY: Payload Verification ---
    const headerSignature = e.parameter['x-razorpay-signature'] || (e.headers && e.headers['X-Razorpay-Signature']);
    const expectedSecret = getEnv("RAZORPAY_WEBHOOK_SECRET");
    const isLocalTest = e.parameter && e.parameter.isLocalTest === "true";
    
    if (expectedSecret && expectedSecret !== "YOUR_WEBHOOK_SECRET_HERE" && !isLocalTest) {
      // 1. Check for Query Parameter 'secret' (Legacy/Simple)
      const urlSecret = e.parameter.secret;
      
      // 2. Check for Standard Header-based Signature (Industry Standard)
      const isSignatureValid = headerSignature ? verifySignature(rawBody, headerSignature, expectedSecret) : false;
      
      if (urlSecret !== expectedSecret && !isSignatureValid) {
        console.error("Unauthorized: Both URL secret and Header signature failed.");
        return ContentService.createTextOutput("Unauthorized").setMimeType(ContentService.MimeType.TEXT);
      }
      console.log(`Verified successfully via ${isSignatureValid ? 'Header Signature' : 'URL Secret'}`);
    } else {
      console.warn("Webhook secret not configured in PropertiesService. Skipping security check (UNSAFE).");
    }
    
    const payload = JSON.parse(rawBody);
    console.log(`Processing Webhook Event: ${payload.event} (ID: ${payload.payload?.payment?.entity?.id || 'N/A'})`);
    
    if (payload.event === "payment.captured") {
      const paymentEntity = payload.payload.payment.entity;
      const paymentId = paymentEntity.id;
      const expectedAmount = paymentEntity.amount; // in paise
      
      // --- SECURITY: Server-to-Server Payment Verification ---
      // Skip API check for local tests since test IDs don't exist in Razorpay
      const isGenuine = isLocalTest || verifyRazorpayPayment(paymentId, expectedAmount);
      if (!isGenuine) {
        console.error(`🚨 SPOOF ATTEMPT DETECTED! Payment verification failed for ID: ${paymentId}`);
        return ContentService.createTextOutput("Verification Failed").setMimeType(ContentService.MimeType.TEXT);
      }
      const amountPaid = expectedAmount / 100; // Razorpay amounts are in paise
      const rawDate = new Date(paymentEntity.created_at * 1000);
      const paymentDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
      const method = paymentEntity.method;
      const upiId = paymentEntity.vpa ? String(paymentEntity.vpa).substring(0, 100) : ""; 
      const contributorEmail = paymentEntity.email ? String(paymentEntity.email).substring(0, 100) : "";
      const contributorPhone = paymentEntity.contact ? String(paymentEntity.contact).substring(0, 50) : "";
      
      // Data sanitization
      const notes = paymentEntity.notes || {};
      const rawMemberName = notes.memberName || "Online Contributor";
      const memberName = String(rawMemberName).substring(0, 200).replace(/[=+\-@>]/g, ""); // Prevent formula injection
      const memberEmail = notes.memberEmail || contributorEmail || ""; // Use note or direct email
      const contact = notes.memberPhone || contributorPhone || ""; // Use note or Razorpay-level contact
      const monthFor = notes.month || (new Date().toLocaleString('default', { month: 'long' }));
      
      // Auto-map aliases with robust normalization
      const fundName = normalizeFundName(notes.fundName);
      
      console.log(`Mapping contribution to sheet: ${fundName} for member: ${memberName} (${memberEmail}) | Phone: ${contact} (Amount: ${amountPaid})`);
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
        
        console.log(`Writing to sheet: ${fundName} | Row: ${nextRow}`);
        
        // --- DYNAMIC COLUMN MAPPING ---
        // Read ALL columns in row 1 so existing Email/Phone headers are never missed
        const totalCols = Math.max(sheet.getLastColumn(), sheet.getMaxColumns(), 7);
        const headerRange = sheet.getRange(1, 1, 1, totalCols);
        const rawHeaders = headerRange.getValues()[0].map(h => h.toString().toLowerCase().trim());
        // Trim trailing empty headers to avoid bloated row arrays
        let lastNonEmpty = rawHeaders.length - 1;
        while (lastNonEmpty >= 0 && rawHeaders[lastNonEmpty] === "") lastNonEmpty--;
        const currentHeaders = rawHeaders.slice(0, lastNonEmpty + 1);
        
        // Ensure Email column exists
        let emailColIdx = currentHeaders.indexOf("email");
        if (emailColIdx === -1) {
          emailColIdx = currentHeaders.length;
          sheet.getRange(1, emailColIdx + 1).setValue("Email").setFontWeight("bold");
          currentHeaders.push("email");
        }

        // Ensure Phone column exists
        let phoneColIdx = currentHeaders.indexOf("phone");
        if (phoneColIdx === -1) {
          phoneColIdx = currentHeaders.length;
          sheet.getRange(1, phoneColIdx + 1).setValue("Phone").setFontWeight("bold");
          currentHeaders.push("phone");
        }

        // Ensure Proof/ID column exists
        let proofColIdx = currentHeaders.indexOf("proof/id");
        if (proofColIdx === -1) {
          proofColIdx = currentHeaders.findIndex(h => h.includes("proof"));
        }
        if (proofColIdx === -1) {
          proofColIdx = currentHeaders.length;
          sheet.getRange(1, proofColIdx + 1).setValue("Proof/ID").setFontWeight("bold");
          currentHeaders.push("proof/id");
        }

        let newRow = new Array(currentHeaders.length).fill("");
        
        currentHeaders.forEach((h, idx) => {
          if (h === "member name" || h === "member") newRow[idx] = memberName;
          else if (h === "amount") newRow[idx] = amountPaid;
          else if (h === "date" || h === "entry date") newRow[idx] = paymentDate;
          else if (h === "category") newRow[idx] = "Online (Verified)";
          else if (h === "notes") newRow[idx] = `${monthFor}: Online Payment Received`;
          else if (h === "proof/id" || h.includes("proof")) newRow[idx] = proofOfPayment;
          else if (h === "email") newRow[idx] = memberEmail;
          else if (h === "phone" || h === "contact" || h === "mobile") newRow[idx] = contact;
        });
        
        // Write the row and clear any validation that might block script entries
        const targetRange = sheet.getRange(nextRow, 1, 1, newRow.length);
        targetRange.setDataValidation(null); 
        targetRange.setValues([newRow]);
        
        // Color-code the new row (Light Purple for Razorpay)
        sheet.getRange(nextRow, 1, 1, sheet.getLastColumn()).setBackground("#f3e5f5");
        
        console.log(`Row successfully added to row ${nextRow}`);
        
        // --- MEMBER TRACKING: Update or Create Member Profile ---
        updateMemberProfile(ss, {
          name: memberName,
          email: memberEmail,
          phone: contact,
          lastContribution: paymentDate,
          fund: fundName
        });
        
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
                  <li><strong>Contributor Email:</strong> ${memberEmail}</li>
                  <li><strong>Date:</strong> ${paymentDate.toLocaleString()}</li>
                </ul>
                <p><a href="https://docs.google.com/spreadsheets/d/${SHEET_ID}">View Google Sheet</a></p>
              </div>
            `
            });
            console.log("Email alert sent to admin: " + adminEmail);
          }
          // Send to Contributor (if email is available)
          if (memberEmail) {
            MailApp.sendEmail({
              to: memberEmail,
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
            console.log("Confirmation email sent to contributor: " + memberEmail);
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
    
    // Find the "Proof" column dynamically from row 1 headers
    const headerValues = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headers = headerValues.map(h => h.toString().toLowerCase().trim());
    let proofColIdx = headers.findIndex(h => h.includes("proof") || h === "proof/id");
    
    // Fallback to column 6 (F) if header not found
    const colToSearch = proofColIdx >= 0 ? proofColIdx + 1 : 6;
    
    // Optimisation: only check the last 50 entries
    const startRow = Math.max(2, numRows - 50);
    const numRowsToCheck = numRows - startRow + 1;
    
    const values = sheet.getRange(startRow, colToSearch, numRowsToCheck, 1).getValues(); 
    
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
 * Helper to verify Razorpay HMAC SHA256 Signature
 */
function verifySignature(payload, signature, secret) {
  try {
    const expectedSignature = Utilities.computeHmacSignature(
      Utilities.MacAlgorithm.HMAC_SHA_256,
      payload,
      secret
    ).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
    
    return expectedSignature === signature;
  } catch (err) {
    console.error("Signature verification error: " + err.toString());
    return false;
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
 * --- MEMBER PROFILES: Database Sync ---
 * Ensures the 'members' sheet exists and updates member contribution history.
 */
function updateMemberProfile(ss, memberData) {
  try {
    let sheet = ss.getSheetByName("members-list") || ss.getSheetByName("members");
    
    // 1. Ensure sheet exists with headers
    if (!sheet) {
      sheet = ss.insertSheet("members");
      const headers = ["Member Name", "Email", "Phone", "First Join Date", "Last Contribution Date", "Recurring Reminders", "Total Contributions", "Reminders Sent"];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#e8f5e9");
      sheet.setFrozenRows(1);
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().toLowerCase().trim());
    const nameIdx = headers.indexOf("member name");
    const emailIdx = headers.indexOf("email");
    const phoneIdx = headers.findIndex(h => h === "phone" || h === "mobile");
    const firstJoinIdx = headers.indexOf("first join date");
    const lastContribIdx = headers.indexOf("last contribution date");
    const recurringIdx = headers.indexOf("recurring reminders");
    const totalIdx = headers.indexOf("total contributions");
    
    let memberRowIdx = -1;
    
    // 2. Search for existing member (by Name or Email)
    for (let i = 1; i < data.length; i++) {
      if (data[i][nameIdx] === memberData.name || (memberData.email && data[i][emailIdx] === memberData.email)) {
        memberRowIdx = i + 1;
        break;
      }
    }
    
    if (memberRowIdx > 0) {
      // 3a. Update Existing Member
      const currentTotal = Number(sheet.getRange(memberRowIdx, totalIdx + 1).getValue()) || 0;
      sheet.getRange(memberRowIdx, lastContribIdx + 1).setValue(memberData.lastContribution);
      sheet.getRange(memberRowIdx, totalIdx + 1).setValue(currentTotal + 1);
      
      // Update email/phone if they were missing or changed
      if (memberData.email) sheet.getRange(memberRowIdx, emailIdx + 1).setValue(memberData.email);
      if (memberData.phone) sheet.getRange(memberRowIdx, phoneIdx + 1).setValue(memberData.phone);
      
      console.log(`Updated profile for member: ${memberData.name}`);
    } else {
      // 3b. Create New Member
      const newRow = [];
      newRow[nameIdx] = memberData.name;
      newRow[emailIdx] = memberData.email || "";
      newRow[phoneIdx] = memberData.phone || "";
      newRow[firstJoinIdx] = memberData.lastContribution;
      newRow[lastContribIdx] = memberData.lastContribution;
      newRow[recurringIdx] = "Yes"; // Default to opted-in
      newRow[totalIdx] = 1;
      
      sheet.appendRow(newRow);
      console.log(`Created new profile for member: ${memberData.name}`);
    }
    
  } catch (err) {
    console.error("Error in updateMemberProfile: " + err.toString());
  }
}

/**
 * Normalizes input fund names to system standard fund sheet names.
 */
function normalizeFundName(fundName) {
  const normalFund = (fundName || "tech-contributions").toLowerCase().trim();
  if (normalFund.includes("tech")) return "tech-contributions";
  if (normalFund.includes("christmas")) return "christmas-fund";
  return "tech-contributions"; // Safe Default
}
