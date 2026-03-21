/**
 * ADVANCED SHEET CLEANUP SCRIPT
 * 
 * What happened:
 * Because of the old `=TODAY()` formulas, the Webhook thought rows 29-1000 were occupied, 
 * so it placed the new online payments at Row 1001. 
 * Because Row 1001 now has data, the previous cleanup script thought the "real last row" was 1001, 
 * so it didn't delete the formulas in the gap!
 * 
 * This new script fixes EVERYTHING automatically:
 * 1. It scans EVERY SINGLE ROW from top to bottom.
 * 2. If a row has no name/amount (empty), it safely wipes out the =TODAY() formulas in C, D, E.
 * 3. Most importantly: If it finds a "gap" (empty rows) and then real data below it (like Row 1001), 
 *    it MOVES that orphaned data UP to fill the gap (e.g., moves Row 1001 to Row 29).
 * 
 * Instructions:
 * 1. Copy this code and replace the contents of your `clean-up-sheet.gs` file.
 * 2. Select `advancedCleanUpAndFixGap` from the top menu.
 * 3. Click Run.
 */

function advancedCleanUpAndFixGap() {
  const SHEET_ID = "1BsuLjPmFrW85AnZgmicrCj0vWlbQ4OH369PdBVA3zyE";
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName("tech-contributions");
  
  if (!sheet) {
    Logger.log("Could not find tech-contributions sheet.");
    return;
  }

  const lastRow = sheet.getMaxRows();
  const range = sheet.getRange(1, 1, lastRow, 5); // Read columns A to E
  const values = range.getValues();
  const formulas = range.getFormulas();
  
  let clearedCount = 0;
  let movedCount = 0;
  let firstGapIndex = -1; // -1 means no gap found yet

  // Loop through all rows from row 2 downward (index 1)
  for (let i = 1; i < values.length; i++) {
    const colA = values[i][0] ? values[i][0].toString().trim() : "";
    const colB = values[i][1] ? values[i][1].toString().trim() : "";
    
    const isEmptyDataRow = (colA === "" && colB === "");

    if (isEmptyDataRow) {
      // 1. Wipe out any formulas or artificial data in C, D, E for this empty row
      const hasJunkInCDE = formulas[i][2] || values[i][2] || 
                           formulas[i][3] || values[i][3] || 
                           formulas[i][4] || values[i][4];
                           
      if (hasJunkInCDE) {
        sheet.getRange(i + 1, 3, 1, 3).clearContent();
        clearedCount++;
      }
      
      // 2. Mark this row as the first available gap for future orphaned data to move into
      if (firstGapIndex === -1) {
        firstGapIndex = i; 
      }
    } else {
      // This row HAS data (like the payments at row 1001+)
      
      // 3. If we previously found a gap above us, move this row's data UP to fill the gap!
      if (firstGapIndex !== -1) {
        const sourceRow = i + 1;
        const targetRow = firstGapIndex + 1;
        
        const sourceRange = sheet.getRange(sourceRow, 1, 1, 5);
        const targetRange = sheet.getRange(targetRow, 1, 1, 5);
        
        // Copy the real values over to the gap
        targetRange.setValues(sourceRange.getValues());
        
        // Copy the background colors (like the light purple from Razorpay)
        const bgColors = sourceRange.getBackgrounds();
        if (bgColors[0][0] && bgColors[0][0] !== "#ffffff") {
          targetRange.setBackgrounds(bgColors);
        }
        
        // Clear out the old orphaned row so it becomes empty again
        sourceRange.clearContent();
        sourceRange.setBackground(null);
        
        movedCount++;
        
        // Next, we need to find the new "first gap". 
        // It's definitely the row immediately after the one we just filled.
        firstGapIndex = firstGapIndex + 1;
      }
    }
  }
  
  Logger.log(`SUCCESS! Wiped formulas from ${clearedCount} empty rows.`);
  if (movedCount > 0) {
    Logger.log(`Fixed the gap! Moved ${movedCount} orphaned transactions back up to the top.`);
  } else {
    Logger.log("No orphaned rows needed to be moved.");
  }
}
