/**
 * Tech Fund - Dynamic Dropdown Apps Script
 * 
 * This script automatically sets up member dropdown on the next empty row
 * whenever you edit the Member or Amount column.
 * 
 * Setup:
 * 1. Create sheet "tech-contributions" with headers: Member | Amount | Date | Category | Notes
 * 2. Create sheet "members-list" with member names in Column A
 * 3. Add this onEdit function to your Apps Script
 * 4. The dropdown will automatically appear on the next empty row!
 */

function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  
  // Only work on tech-contributions sheet
  if (sheet.getName() !== 'tech-contributions') {
    return;
  }
  
  const range = e.range;
  const row = range.getRow();
  const col = range.getColumn();
  
  // Only trigger if editing Member (Column A = 1) or Amount (Column B = 2)
  if (col !== 1 && col !== 2) {
    return;
  }
  
  // Skip header row
  if (row === 1) {
    return;
  }
  
  // Find the last row with data (checking Member column)
  const memberCol = sheet.getRange('A:A');
  const memberValues = memberCol.getValues();
  let lastRow = 1;
  
  // Find last non-empty row in Member column
  for (let i = memberValues.length - 1; i >= 0; i--) {
    if (memberValues[i][0] && memberValues[i][0].toString().trim() !== '') {
      lastRow = i + 1; // +1 because array is 0-indexed
      break;
    }
  }
  
  const nextRow = lastRow + 1;
  
  // Don't set validation if next row is beyond reasonable limit
  if (nextRow > 10000) {
    return;
  }
  
  // Get member list sheet
  const memberSheet = e.source.getSheetByName('members-list');
  if (!memberSheet) {
    return; // members-list sheet doesn't exist
  }
  
  const memberLastRow = memberSheet.getLastRow();
  if (memberLastRow < 1) {
    return; // No members in the list
  }
  
  // Clear all existing validations in Member column (optional - for cleanup)
  // Or just set on next row (recommended)
  const nextCell = sheet.getRange(nextRow, 1); // Column A, next row
  
  // Clear existing validation on this cell
  nextCell.clearDataValidations();
  
  // Create member list range
  const memberRange = memberSheet.getRange(1, 1, memberLastRow, 1);
  
  // Create new data validation rule
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(memberRange)
    .setAllowInvalid(false)
    .setHelpText('Select a member from the list')
    .build();
  
  // Apply validation to next row
  nextCell.setDataValidation(rule);
  
  // Optional: Also clear validation from current row if you want
  // (This ensures only next row has dropdown)
  if (row < nextRow) {
    const currentCell = sheet.getRange(row, 1);
    // Keep validation on current row if it's being edited
    // Or remove it - your choice
  }
}

/**
 * Optional: Function to set initial dropdown on Row 2
 * Run this once manually to set up the first dropdown
 */
function setupInitialDropdown() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('tech-contributions');
  const memberSheet = ss.getSheetByName('members-list');
  
  if (!sheet || !memberSheet) {
    Logger.log('Required sheets not found');
    return;
  }
  
  const memberLastRow = memberSheet.getLastRow();
  if (memberLastRow < 1) {
    Logger.log('No members in members-list sheet');
    return;
  }
  
  const memberRange = memberSheet.getRange(1, 1, memberLastRow, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(memberRange)
    .setAllowInvalid(false)
    .setHelpText('Select a member from the list')
    .build();
  
  // Set on Row 2
  sheet.getRange(2, 1).setDataValidation(rule);
  Logger.log('Initial dropdown set on Row 2');
}
