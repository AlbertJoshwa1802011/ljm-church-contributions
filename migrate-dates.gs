function migrateTechFundDates() {
  const SHEET_ID = "1BsuLjPmFrW85AnZgmicrCj0vWlbQ4OH369PdBVA3zyE"; 
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  // Try migrating Tech Fund
  migrateSheetDates(ss, "tech-contributions");
  // Try migrating Christmas Fund
  migrateSheetDates(ss, "christmas-fund");
  
  Logger.log("Overall Migration Complete!");
}

function migrateSheetDates(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    Logger.log(`Sheet not found: ${sheetName}. Skipping.`);
    return;
  }
  
  Logger.log(`Starting migration for ${sheetName}...`);
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  if (values.length < 2) return;
  
  const headers = values[0].map(h => h.toString().toLowerCase().trim());
  const dateIdx = headers.indexOf('date');
  
  if (dateIdx === -1) {
    Logger.log(`No 'date' column found in ${sheetName}. Skipping.`);
    return;
  }
  
  let migratedCount = 0;
  
  // Note: rows are 1-indexed, values are 0-indexed. Headers are row 1 (index 0).
  for (let i = 1; i < values.length; i++) {
    const rawVal = values[i][dateIdx];
    if (!rawVal) continue;
    
    let dateObj = null;
    if (rawVal instanceof Date) {
      dateObj = rawVal;
    } else if (typeof rawVal === 'number' && rawVal > 0) {
      const epoch = new Date(1899, 11, 30).getTime();
      dateObj = new Date(epoch + rawVal * 86400000);
    } else if (typeof rawVal === 'string' && rawVal.trim() !== '') {
      const s = rawVal.trim();
      
      // Try mapping standard DD/MM/YYYY text if JS fails
      const slash = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (slash) {
        const a = parseInt(slash[1], 10), b = parseInt(slash[2], 10), y = parseInt(slash[3], 10);
        let month = b - 1, day = a;
        if (a > 12) { day = a; month = b - 1; }
        else if (b > 12) { month = a - 1; day = b; }
        dateObj = new Date(y, month, day);
      } else {
        // Fallback to native JS parsing for strings like "January 12 2026"
        dateObj = new Date(s);
      }
    }
    
    // Only overwrite if we successfully parsed a valid date
    if (dateObj && !isNaN(dateObj.getTime())) {
      const formatted = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
      // Don't waste API calls updating if it's already correct
      if (rawVal !== formatted) {
        sheet.getRange(i + 1, dateIdx + 1).setValue(formatted);
        migratedCount++;
      }
    }
  }
  
  Logger.log(`Migrated ${migratedCount} rows in ${sheetName}.`);
}
