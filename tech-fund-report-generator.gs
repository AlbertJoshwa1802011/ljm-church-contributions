/**
 * Tech Fund Report Generator
 * 
 * Auto-generates a monthly summary report from tech-contributions sheet.
 * Creates a protected "tech-fund-report" sheet that is read-only for everyone
 * except the spreadsheet owner.
 * 
 * Source: tech-contributions (Member | Amount | Date | Category | Notes)
 * Output: S.No | Church Youth Member | Month1 | Month2 | ... | Member's Total | Installments Paid
 * 
 * Setup:
 * 1. Add this to your Apps Script (Extensions → Apps Script)
 * 2. Run generateTechFundReport() once to create the report sheet
 * 3. Set up trigger: Edit → Current project's triggers → Add trigger
 *    - Function: onTechContributionsEdit
 *    - Event: On edit
 *    - Or run generateTechFundReport manually when needed
 * 
 * Config (optional in "config" sheet):
 * - report_months: Override to fix months (e.g. "September,October,November,December")
 *   If omitted, months are AUTO-DETECTED from your data in ascending order.
 * - report_year: Only used when report_months is set
 */

const REPORT_SHEET_NAME = 'tech-fund-report';
const SOURCE_SHEET_NAME = 'tech-contributions';
const MEMBERS_LIST_SHEET = 'members-list';

/**
 * Main function - run this to generate/refresh the report.
 * Can be called manually or from a trigger.
 * @param {boolean} showAlert - If true, shows success alert (default: true for manual runs)
 */
function generateTechFundReport(showAlert) {
  if (showAlert === undefined) showAlert = true;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Get source data
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET_NAME);
  if (!sourceSheet) {
    SpreadsheetApp.getUi().alert('Error: Sheet "' + SOURCE_SHEET_NAME + '" not found.');
    return;
  }

  const values = sourceSheet.getDataRange().getValues();
  if (values.length < 2) {
    SpreadsheetApp.getUi().alert('No data in tech-contributions sheet.');
    return;
  }

  const headers = values[0].map(h => (h || '').toString().trim().toLowerCase());
  const dataRows = values.slice(1);

  const memberIdx = headers.indexOf('member');
  const amountIdx = headers.indexOf('amount');
  const dateIdx = headers.indexOf('date');

  if (memberIdx < 0 || amountIdx < 0 || dateIdx < 0) {
    SpreadsheetApp.getUi().alert('tech-contributions must have columns: Member, Amount, Date');
    return;
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const monthMap = {
    'january': 0, 'february': 1, 'march': 2, 'april': 3,
    'may': 4, 'june': 5, 'july': 6, 'august': 7,
    'september': 8, 'october': 9, 'november': 10, 'december': 11
  };

  // Check config for fixed months (optional)
  let reportMonthsConfig = null;
  let reportYear = new Date().getFullYear();
  const configSheet = ss.getSheetByName('config');
  if (configSheet) {
    const configData = configSheet.getDataRange().getValues();
    for (const row of configData) {
      const key = (row[0] || '').toString().toLowerCase().trim();
      if (key === 'report_months' && row[1] && (row[1].toString().toLowerCase() !== 'auto')) {
        reportMonthsConfig = (row[1].toString()).split(',').map(m => m.trim()).filter(Boolean);
      }
      if (key === 'report_year' && row[1]) {
        reportYear = parseInt(row[1], 10) || reportYear;
      }
    }
  }

  // Build aggregation + collect month keys from data
  const memberData = {};
  const memberOrder = [];
  const monthKeysFromData = new Set();

  // First, get master member list (from members-list if exists)
  const membersListSheet = ss.getSheetByName(MEMBERS_LIST_SHEET);
  if (membersListSheet) {
    const memberCol = membersListSheet.getRange('A:A').getValues();
    for (let i = 0; i < memberCol.length; i++) {
      const name = (memberCol[i][0] || '').toString().trim();
      if (name) {
        if (!memberData[name]) {
          memberData[name] = { months: {}, total: 0, installments: 0 };
          memberOrder.push(name);
        }
      }
    }
  }

  // Process contributions and collect months
  for (const row of dataRows) {
    const member = (row[memberIdx] || '').toString().trim();
    const amount = parseFloat(row[amountIdx]) || 0;
    if (!member || amount <= 0) continue;

    let dateObj;
    if (row[dateIdx] instanceof Date) {
      dateObj = row[dateIdx];
    } else if (row[dateIdx]) {
      dateObj = new Date(row[dateIdx]);
      if (isNaN(dateObj.getTime())) continue;
    } else {
      continue;
    }

    const month = dateObj.getMonth();
    const year = dateObj.getFullYear();
    const monthKey = year + '-' + String(month + 1).padStart(2, '0');

    monthKeysFromData.add(monthKey);

    if (!memberData[member]) {
      memberData[member] = { months: {}, total: 0, installments: 0 };
      memberOrder.push(member);
    }

    memberData[member].total += amount;
    memberData[member].installments += 1;

    if (!memberData[member].months[monthKey]) {
      memberData[member].months[monthKey] = 0;
    }
    memberData[member].months[monthKey] += amount;
  }

  // Decide report months: config override OR auto-detect from data (ascending)
  let reportMonthColumns;
  if (reportMonthsConfig && reportMonthsConfig.length > 0) {
    reportMonthColumns = reportMonthsConfig.map(name => {
      const m = monthMap[name.toLowerCase()];
      return {
        key: reportYear + '-' + String((m !== undefined ? m : 0) + 1).padStart(2, '0'),
        label: name
      };
    });
  } else {
    const sortedKeys = Array.from(monthKeysFromData).sort();
    reportMonthColumns = sortedKeys.map(key => {
      const [y, mStr] = key.split('-');
      const m = parseInt(mStr, 10) - 1; // 01->0, 12->11
      return { key: key, label: (monthNames[m] || 'Month') + ' ' + y };
    });
  }

  const monthLabels = reportMonthColumns.map(c => c.label);
  const monthKeys = reportMonthColumns.map(c => c.key);

  // Build output rows
  const outputHeaders = ['S.No', 'Church Youth Member', ...monthLabels, "Member's Total", 'Installments Paid'];
  const outputRows = [outputHeaders];

  memberOrder.forEach((memberName, idx) => {
    const data = memberData[memberName];
    const row = [
      idx + 1,
      memberName
    ];

    monthKeys.forEach(mk => {
      row.push(data.months[mk] || 0);
    });

    row.push(data.total);
    row.push(data.installments);
    outputRows.push(row);
  });

  // Create or get report sheet
  let reportSheet = ss.getSheetByName(REPORT_SHEET_NAME);
  if (!reportSheet) {
    reportSheet = ss.insertSheet(REPORT_SHEET_NAME);
  }

  // Clear and write
  reportSheet.clear();
  reportSheet.getRange(1, 1, outputRows.length, outputRows[0].length).setValues(outputRows);

  // Format header row
  reportSheet.getRange(1, 1, 1, outputHeaders.length).setFontWeight('bold');
  reportSheet.getRange(1, 1, 1, outputHeaders.length).setBackground('#f0f0f0');
  reportSheet.autoResizeColumns(1, outputHeaders.length);

  // Protect the sheet - only owner can edit
  protectReportSheet(reportSheet);

  if (showAlert && SpreadsheetApp.getUi()) {
    SpreadsheetApp.getUi().alert('Tech Fund Report generated successfully!');
  }
}

/**
 * Protects the report sheet so only the spreadsheet owner can edit.
 * Everyone else will see "Protected" and cannot edit.
 */
function protectReportSheet(sheet) {
  const existingProtections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  existingProtections.forEach(p => p.remove());

  const protection = sheet.protect().setDescription('Tech Fund Report - Auto-generated, only owner can edit');
  protection.setWarningOnly(false);
  // By default, only the user who ran the script (owner) can edit
}

/**
 * Trigger function - runs when any cell is edited.
 * Only regenerates report if the edit was on tech-contributions sheet.
 * Set up via setupAutoSyncTrigger() - run that ONCE and you're done.
 */
function onTechContributionsEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() === SOURCE_SHEET_NAME) {
    generateTechFundReport(false); // No alert when auto-triggered
  }
}

/**
 * Run this ONCE to enable auto-sync. After this, the report will update
 * automatically whenever you edit tech-contributions.
 * 
 * Extensions → Apps Script → Select setupAutoSyncTrigger → Run
 */
function setupAutoSyncTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  const alreadyExists = triggers.some(t =>
    t.getHandlerFunction() === 'onTechContributionsEdit' && t.getEventType() === ScriptApp.EventType.ON_EDIT
  );
  if (alreadyExists) {
    const msg = 'Auto-sync is already enabled. The report updates whenever you edit tech-contributions.';
    if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(msg);
    else Logger.log(msg);
    return;
  }
  ScriptApp.newTrigger('onTechContributionsEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  const msg = 'Auto-sync enabled! The report will now update automatically whenever you edit tech-contributions.';
  if (SpreadsheetApp.getUi()) SpreadsheetApp.getUi().alert(msg);
  else Logger.log(msg);
}

/**
 * Add a custom menu. Runs automatically when the spreadsheet is opened.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Tech Fund')
    .addItem('Generate Report', 'generateTechFundReport')
    .addSeparator()
    .addItem('Enable Auto-Sync (run once)', 'setupAutoSyncTrigger')
    .addToUi();
}
