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

const RAZORPAY_WEBHOOK_SECRET = "YOUR_WEBHOOK_SECRET_HERE"; 
const SHEET_ID = "1BsuLjPmFrW85AnZgmicrCj0vWlbQ4OH369PdBVA3zyE"; // The same sheet ID
const ADMIN_EMAIL = Session.getActiveUser().getEmail(); // Or replace with your explicit email "example@gmail.com"

/**
 * Handle incoming Webhook from Razorpay
 */
function doPost(e) {
  try {
    const rawBody = e.postData.contents;
    const signature = e.parameter['razorpay_signature'] || e.contextPath || ""; // Webhooks usually pass it in headers, GAS receives headers via e.postData or we might have to use manual checks, wait, Google App Script doPost headers are in `e.postData` but actual headers are not always fully exposed in simple parameters.
    // Actually, Razorpay passes the signature in the 'x-razorpay-signature' header. 
    // Wait, let's look at GAS: e.postData.type, e.postData.contents. Headers are not exposed directly in `e`. 
    // Since Google Apps Script doesn't reliably expose headers in `doPost(e)` for standard web apps without Cloud Endpoints, 
    // Razorpay allows adding secret inside the payload, or we can use the URL query parameter `?sig=` for verification if we append it to the webhook URL.
    // However, as standard practice in GAS, we will just parse the entity. If signature isn't available in headers, we must verify the payload contents manually using an order ID API check or pass a secret token in the Webhook URL.
    
    // Better secure approach for GS webhook:
    const urlSecret = e.parameter.secret;
    console.log("Webhook received. Secret in URL: " + urlSecret);
    
    if (urlSecret !== RAZORPAY_WEBHOOK_SECRET) {
      console.error("Unauthorized: Secret mismatch. Received: " + urlSecret + ", Expected: " + RAZORPAY_WEBHOOK_SECRET);
      return ContentService.createTextOutput("Unauthorized: Secret mismatch").setMimeType(ContentService.MimeType.TEXT);
    }

    const payload = JSON.parse(rawBody);
    console.log("Payload Event: " + payload.event);

    if (payload.event === "payment.captured") {
      const paymentEntity = payload.payload.payment.entity;
      
      const amountPaid = paymentEntity.amount / 100; // Razorpay amounts are in paise
      const paymentDate = new Date(paymentEntity.created_at * 1000);
      const paymentId = paymentEntity.id;
      const method = paymentEntity.method;
      const upiId = paymentEntity.vpa || ""; // UPI ID if available
      const contact = paymentEntity.contact || "";

      // We pass notes when creating the payment order in frontend
      const notes = paymentEntity.notes || {};
      const memberName = notes.memberName || "Online Contributor";
      let fundName = notes.fundName || "tech-contributions"; 
      
      // Auto-map aliases
      if (fundName.toLowerCase().includes("tech")) fundName = "tech-contributions";
      if (fundName.toLowerCase().includes("christmas")) fundName = "christmas-fund";

      console.log(`Processing payment for ${memberName} (${amountPaid}) into ${fundName}`);

      const ss = SpreadsheetApp.openById(SHEET_ID);
      const sheet = ss.getSheetByName(fundName);
      
      if (sheet) {
        const proofOfPayment = `ID: ${paymentId} | Method: ${method} ${upiId ? '('+upiId+')' : ''} | Contact: ${contact}`;
        
        // --- FIX: Find proper last row (avoid jumping to 1001) ---
        const lastRow = sheet.getLastRow();
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
        
        // --- STYLE: Color-code the new row (Light Purple for Razorpay) ---
        sheet.getRange(nextRow, 1, 1, sheet.getLastColumn()).setBackground("#f3e5f5");
        
        console.log(`Row successfully added to row ${nextRow}`);
        
        // --- NEW: Immediate Email Alert for this payment ---
        try {
          MailApp.sendEmail({
            to: ADMIN_EMAIL,
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
                  <li><strong>Date:</strong> ${paymentDate.toLocaleString()}</li>
                </ul>
                <p><a href="https://docs.google.com/spreadsheets/d/${SHEET_ID}">View Google Sheet</a></p>
              </div>
            `
          });
          console.log("Email alert sent to " + ADMIN_EMAIL);
        } catch (mailErr) {
          console.error("Failed to send immediate alert: ", mailErr.toString());
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

  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: `Monthly Contribution Report - ${monthName} ${priorYear}`,
    htmlBody: emailHtml
  });
}
