/**
 * Unified Fund Handler - Supports Both Christmas Fund and Tech Fund
 * 
 * This function handles both fund types intelligently:
 * - Christmas Fund: Uses month-based columns (September, October, etc.)
 * - Tech Fund: Uses standard format (Member | Amount | Date | Category | Notes)
 * 
 * Usage:
 * - Christmas Fund: ?fund=christmas-fund
 * - Tech Fund: ?fund=tech-contributions (or ?fund=tech)
 */

function doGet(e) {
  const SHEET_ID = "1BsuLjPmFrW85AnZgmicrCj0vWlbQ4OH369PdBVA3zyE";
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // Determine fund from parameter or default
  let fundName = (e.parameter.fund || "christmas-fund").toLowerCase();
  
  // Map common aliases
  if (fundName === "tech" || fundName === "techfund") {
    fundName = "tech-contributions";
  } else if (fundName === "christmas" || fundName === "christmasfund") {
    fundName = "christmas-fund";
  }

  const sheet = ss.getSheetByName(fundName);
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      error: `Sheet '${fundName}' not found`,
      goalAmount: 0,
      contributions: []
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Read data
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return ContentService.createTextOutput(JSON.stringify({
      goalAmount: 0,
      contributions: []
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const headers = values[0].map(h => h.toString().toLowerCase().trim());
  const dataRows = values.slice(1);

  // Detect format: Tech Fund has "date" column, Christmas Fund has month columns
  const hasDateColumn = headers.includes('date');
  const hasAmountColumn = headers.includes('amount');
  const hasMemberColumn = headers.includes('member');

  let contributions = [];

  if (hasDateColumn && hasAmountColumn && hasMemberColumn) {
    // Tech Fund Format: Member | Amount | Date | Category | Notes
    contributions = processTechFundFormat(headers, dataRows);
  } else {
    // Christmas Fund Format: Member in column B, months as column headers
    contributions = processChristmasFundFormat(headers, dataRows);
  }

  // Get goal amount from config sheet
  let goalAmount = 0;
  const configSheet = ss.getSheetByName("config");
  if (configSheet) {
    const configData = configSheet.getDataRange().getValues();
    
    // Determine goal key based on fund
    let goalKey;
    if (fundName === "tech-contributions" || fundName === "tech") {
      goalKey = "tech_goal_amount"; // Try tech-specific first
    } else if (fundName === "christmas-fund" || fundName === "christmas") {
      goalKey = "christmas_goal_amount"; // Try christmas-specific first
    } else {
      goalKey = "goalamount"; // Fallback to generic
    }

    // Search for goal amount
    let found = false;
    configData.forEach(row => {
      const key = row[0] ? row[0].toString().toLowerCase().trim() : '';
      if (key === goalKey || key === "goalamount") {
        goalAmount = Number(row[1]) || 0;
        found = true;
      }
    });

    // If not found with specific key, try generic
    if (!found) {
      configData.forEach(row => {
        const key = row[0] ? row[0].toString().toLowerCase().trim() : '';
        if (key === "goalamount") {
          goalAmount = Number(row[1]) || 0;
        }
      });
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({
      goalAmount: goalAmount,
      contributions: contributions
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Process Tech Fund format: Member | Amount | Date | Category | Notes
 */
function processTechFundFormat(headers, dataRows) {
  const memberIdx = headers.indexOf('member');
  const amountIdx = headers.indexOf('amount');
  const dateIdx = headers.indexOf('date');
  const categoryIdx = headers.indexOf('category');
  const notesIdx = headers.indexOf('notes');

  const contributions = dataRows
    .map(row => {
      const member = (memberIdx >= 0 && row[memberIdx]) 
        ? row[memberIdx].toString().trim() 
        : '';
      const amount = (amountIdx >= 0 && row[amountIdx]) 
        ? Number(row[amountIdx]) 
        : 0;
      
      // Skip empty rows
      if (!member || amount <= 0) {
        return null;
      }

      // Process date
      let dateObj;
      if (dateIdx >= 0 && row[dateIdx]) {
        const dateVal = row[dateIdx];
        if (dateVal instanceof Date) {
          dateObj = dateVal;
        } else if (typeof dateVal === 'string' && dateVal.trim()) {
          dateObj = new Date(dateVal);
          if (isNaN(dateObj.getTime())) {
            dateObj = new Date(); // Default to today if invalid
          }
        } else {
          dateObj = new Date(); // Default to today
        }
      } else {
        dateObj = new Date(); // Default to today
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
    .filter(c => c !== null); // Remove null entries

  return contributions;
}

/**
 * Process Christmas Fund format: Member in column B, months as headers
 */
function processChristmasFundFormat(headers, dataRows) {
  const contributions = [];
  const monthMap = {
    "january": 0, "february": 1, "march": 2, "april": 3,
    "may": 4, "june": 5, "july": 6, "august": 7,
    "september": 8, "october": 9, "november": 10, "december": 11
  };

  dataRows.forEach(row => {
    const member = row[1]; // Column B (index 1)
    if (!member) return;

    // Process month columns (starting from column C, index 2)
    for (let i = 2; i < headers.length; i++) {
      let monthName = headers[i];
      if (!monthName) continue;

      monthName = monthName.toString().trim().toLowerCase();
      const monthIndex = monthMap[monthName];
      if (monthIndex === undefined) continue;

      const amount = Number(row[i]) || 0;
      if (amount <= 0) continue;

      // Create date for the first day of that month in current year
      const date = new Date(new Date().getFullYear(), monthIndex, 1);

      contributions.push({
        Date: date.toISOString(),
        Amount: amount,
        Category: "Christmas Fund",
        Notes: headers[i].toString().trim(),
        Member: member.toString().trim()
      });
    }
  });

  return contributions;
}
