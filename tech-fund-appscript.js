/**
 * Tech Fund Google Apps Script
 * 
 * This script reads from a Google Sheet and returns JSON data
 * in the same format as the Christmas Fund for consistency.
 * 
 * Sheet Format Required:
 * - Sheet name: "tech-contributions"
 * - Headers: Member | Amount | Date | Category | Notes
 * - Config sheet: "config" with goalAmount
 * 
 * Usage:
 * 1. Replace SHEET_ID with your Google Sheet ID
 * 2. Deploy as Web App
 * 3. Use the Web App URL in your website
 */

function doGet() {
  const SHEET_ID = "1BsuLjPmFrW85AnZgmicrCj0vWlbQ4OH369PdBVA3zyE"; // Tech Fund Sheet ID
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // --- Tech Fund Contributions Sheet ---
  const sheet = ss.getSheetByName("tech-contributions");
  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ 
        error: "Sheet 'tech-contributions' not found",
        goalAmount: 0,
        contributions: []
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    // No data rows, return empty
    return ContentService
      .createTextOutput(JSON.stringify({
        goalAmount: 0,
        contributions: []
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Get headers (first row) and convert to lowercase for case-insensitive matching
  const headers = values[0].map(h => h.toString().toLowerCase().trim());
  const dataRows = values.slice(1); // All rows except header

  // Find column indices by header name
  const memberIdx = headers.indexOf('member');
  const amountIdx = headers.indexOf('amount');
  const dateIdx = headers.indexOf('date');
  const categoryIdx = headers.indexOf('category');
  const notesIdx = headers.indexOf('notes');

  // Process each data row
  const contributions = dataRows
    .map((row, rowIndex) => {
      const member = (memberIdx >= 0 && row[memberIdx]) 
        ? row[memberIdx].toString().trim() 
        : '';
      const amount = (amountIdx >= 0 && row[amountIdx]) 
        ? Number(row[amountIdx]) 
        : 0;
      
      // Skip empty rows (no member or amount)
      if (!member || amount <= 0) {
        return null;
      }

      // Process date - handles both Date objects and text formats like "January 12, 2026"
      let dateObj;
      if (dateIdx >= 0 && row[dateIdx]) {
        const dateVal = row[dateIdx];
        if (dateVal instanceof Date) {
          dateObj = dateVal;
        } else if (typeof dateVal === 'string' && dateVal.trim()) {
          // Try parsing the date string (handles formats like "January 12, 2026")
          dateObj = new Date(dateVal);
          // Check if date is valid
          if (isNaN(dateObj.getTime())) {
            dateObj = new Date(); // Default to today if invalid
          }
        } else {
          dateObj = new Date(); // Default to today if invalid
        }
      } else {
        dateObj = new Date(); // Default to today if no date column
      }

      // Process category
      const category = (categoryIdx >= 0 && row[categoryIdx]) 
        ? row[categoryIdx].toString().trim() 
        : 'Tech Fund';

      // Process notes
      const notes = (notesIdx >= 0 && row[notesIdx]) 
        ? row[notesIdx].toString().trim() 
        : '';

      return {
        Date: dateObj.toISOString(),
        Amount: amount,
        Category: category,
        Notes: notes,
        Member: member
      };
    })
    .filter(c => c !== null); // Remove null entries (empty rows)

  // --- Config Sheet for Goal Amount ---
  let goalAmount = 0;
  const configSheet = ss.getSheetByName("config");
  if (configSheet) {
    const configData = configSheet.getDataRange().getValues();
    configData.forEach(row => {
      const key = row[0] ? row[0].toString().toLowerCase().trim() : '';
      if (key === "goalamount") {
        goalAmount = Number(row[1]) || 0;
      }
    });
  }

  // Return JSON in same format as Christmas Fund
  return ContentService
    .createTextOutput(JSON.stringify({
      goalAmount: goalAmount,
      contributions: contributions
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
