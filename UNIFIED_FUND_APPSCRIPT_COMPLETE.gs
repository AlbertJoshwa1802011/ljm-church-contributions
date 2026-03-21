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
 *
 * Date fix: Date is output as YYYY-MM-DD so each row keeps its real calendar date
 * and "Most Active Month" on the dashboard shows the correct month (Jan vs Mar).
 */

/** Returns YYYY-MM-DD HH:mm:ss for the given Date so exact time is preserved */
function formatDateTime(d) {
  const y = d.getFullYear();
  let m = String(d.getMonth() + 1).padStart(2, '0');
  let day = String(d.getDate()).padStart(2, '0');
  let hh = String(d.getHours()).padStart(2, '0');
  let mm = String(d.getMinutes()).padStart(2, '0');
  let ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

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

      // Process date (Date object from sheet or text like "January 12, 2026")
      let dateObj;
      if (dateIdx >= 0 && row[dateIdx]) {
        const dateVal = row[dateIdx];
        if (dateVal instanceof Date) {
          dateObj = dateVal;
        } else if (typeof dateVal === 'number' && dateVal > 0) {
          // Google Sheets stores dates as number of days since Dec 30 1899
          const epoch = new Date(1899, 11, 30).getTime();
          dateObj = new Date(epoch + dateVal * 86400000);
          if (isNaN(dateObj.getTime())) dateObj = new Date();
        } else if (typeof dateVal === 'string' && dateVal.trim()) {
          const s = dateVal.trim();
          dateObj = new Date(s);
          if (isNaN(dateObj.getTime())) {
            // Try parsing DD/MM/YYYY or DD-MM-YYYY manually
            const slash = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            if (slash) {
              const a = parseInt(slash[1], 10), b = parseInt(slash[2], 10), y = parseInt(slash[3], 10);
              let month = b - 1, day = a;
              if (a > 12) { day = a; month = b - 1; }
              else if (b > 12) { month = a - 1; day = b; }
              dateObj = new Date(y, month, day);
            }
            if (!dateObj || isNaN(dateObj.getTime())) {
              dateObj = new Date(); // Default to today if invalid
            }
          }
        } else {
          dateObj = new Date(); // Default to today
        }
      } else {
        dateObj = new Date(); // Default to today
      }

      // Output date as YYYY-MM-DD HH:mm:ss so frontend gets correct exact time
      const dateStr = formatDateTime(dateObj);

      // Process category
      const category = (categoryIdx >= 0 && row[categoryIdx])
        ? row[categoryIdx].toString().trim()
        : 'Tech Fund';

      // Process notes
      const notes = (notesIdx >= 0 && row[notesIdx])
        ? row[notesIdx].toString().trim()
        : '';

      return {
        Date: dateStr,
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
        Date: formatDateTime(date),
        Amount: amount,
        Category: "Christmas Fund",
        Notes: headers[i].toString().trim(),
        Member: member.toString().trim()
      });
    }
  });

  return contributions;
}
