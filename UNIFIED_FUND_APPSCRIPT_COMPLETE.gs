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
      contributions: contributions,
      memberEmails: extractMemberEmails(headers, dataRows) // New: mapping for auto-fill
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Extracts a mapping of Member Name -> Email from the data rows
 */
function extractMemberEmails(headers, dataRows) {
  const memberIdx = headers.indexOf('member');
  const emailIdx = headers.indexOf('email');
  
  const mapping = {};
  if (memberIdx === -1 || emailIdx === -1) return mapping;
  
  dataRows.forEach(row => {
    const member = row[memberIdx] ? row[memberIdx].toString().trim() : "";
    const email = row[emailIdx] ? row[emailIdx].toString().trim() : "";
    if (member && email && email.includes('@')) {
      mapping[member] = email;
    }
  });
  return mapping;
}

/**
 * Process Tech Fund format: Member | Amount | Date | Category | Notes
 */
function processTechFundFormat(headers, dataRows) {
  // Use fuzzy detection for headers
  const memberIdx = headers.findIndex(h => h.includes('member'));
  const amountIdx = headers.findIndex(h => h.includes('amount'));
  const dateIdx = headers.findIndex(h => h.includes('date'));
  const categoryIdx = headers.findIndex(h => h.includes('category'));
  const notesIdx = headers.findIndex(h => h.includes('notes'));

  const scriptTz = Session.getScriptTimeZone();

  const contributions = dataRows
    .map((row, index) => {
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

      // Process date (Date object from sheet or text)
      let dateObj = null;
      let rawDateVal = (dateIdx >= 0) ? row[dateIdx] : null;

      if (rawDateVal) {
        if (rawDateVal instanceof Date) {
          dateObj = rawDateVal;
        } else if (typeof rawDateVal === 'number' && rawDateVal > 0) {
          // Serial date from Google Sheets
          const epoch = new Date(1899, 11, 30).getTime();
          dateObj = new Date(epoch + rawDateVal * 86400000);
        } else if (typeof rawDateVal === 'string' && rawDateVal.trim()) {
          const s = rawDateVal.trim();
          
          // 1. Try ISO-like YYYY-MM-DD HH:mm:ss
          const iso = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
          if (iso) {
            const y = parseInt(iso[1], 10);
            const mo = parseInt(iso[2], 10) - 1;
            const d = parseInt(iso[3], 10);
            const hh = iso[4] ? parseInt(iso[4], 10) : 0;
            const min = iso[5] ? parseInt(iso[5], 10) : 0;
            const sec = iso[6] ? parseInt(iso[6], 10) : 0;
            dateObj = new Date(y, mo, d, hh, min, sec);
          }
          
          if (!dateObj || isNaN(dateObj.getTime())) {
            dateObj = new Date(s);
          }
        }
      } 
      
      // Safety: If no date found, default to Today
      if (!dateObj || isNaN(dateObj.getTime())) {
        dateObj = new Date();
      }

      // Output date as YYYY-MM-DD HH:mm:ss using native Spreadsheet logic
      const dateStr = Utilities.formatDate(dateObj, scriptTz, "yyyy-MM-dd HH:mm:ss");

      // Process category/notes
      const category = (categoryIdx >= 0 && row[categoryIdx]) ? row[categoryIdx].toString().trim() : 'Tech Fund';
      const notes = (notesIdx >= 0 && row[notesIdx]) ? row[notesIdx].toString().trim() : '';

      return {
        Date: dateStr,
        Amount: amount,
        Category: category,
        Notes: notes,
        Member: member,
        _debug: { dateType: typeof rawDateVal, dateIdx: dateIdx, rowIdx: index + 2 }
      };
    })
    .filter(c => c !== null);

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
