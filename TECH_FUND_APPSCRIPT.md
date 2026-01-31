# Tech Fund Apps Script Code

## Updated doGet() Function for Tech Fund

This script handles the Tech Fund sheet and converts it to the same JSON format as Christmas Fund.

```javascript
function doGet() {
  const SHEET_ID = "YOUR_TECH_FUND_SHEET_ID"; // Replace with your Tech Fund sheet ID
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // --- Tech Fund Contributions Sheet ---
  const sheet = ss.getSheetByName("tech-contributions");
  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "Sheet 'tech-contributions' not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const values = sheet.getDataRange().getValues();
  const headers = values.shift(); // first row is header

  // Map headers to indices
  const headerMap = {};
  headers.forEach((h, i) => {
    headerMap[h.toString().toLowerCase().trim()] = i;
  });

  const contributions = values
    .filter(row => row[headerMap['amount']] && row[headerMap['member']]) // Only rows with amount and member
    .map(row => {
      // Get values by header name (case-insensitive)
      const date = row[headerMap['date']] || new Date();
      const member = row[headerMap['member']] || '';
      const amount = row[headerMap['amount']] || 0;
      const category = row[headerMap['category']] || 'Tech Fund';
      const notes = row[headerMap['notes']] || '';

      // Convert date to ISO string
      let dateObj;
      if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string') {
        dateObj = new Date(date);
      } else {
        dateObj = new Date();
      }

      return {
        Date: dateObj.toISOString(),
        Amount: Number(amount) || 0,
        Category: category.toString(),
        Notes: notes.toString(),
        Member: member.toString().trim()
      };
    })
    .filter(c => c.Member && c.Amount > 0); // Filter out empty entries

  // --- Config Sheet for Goal Amount ---
  let goalAmount = 0;
  const configSheet = ss.getSheetByName("config");
  if (configSheet) {
    const configData = configSheet.getDataRange().getValues();
    configData.forEach(row => {
      if (row[0] && row[0].toString().toLowerCase().trim() === "goalamount") {
        goalAmount = Number(row[1]) || 0;
      }
    });
  }

  // Return JSON (same format as Christmas Fund)
  return ContentService
    .createTextOutput(JSON.stringify({
      goalAmount: goalAmount,
      contributions: contributions
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## Setup Instructions:

1. **Open Google Apps Script** for your Tech Fund sheet
2. **Replace the existing `doGet()` function** with the code above
3. **Update the SHEET_ID** with your actual Tech Fund Google Sheet ID
4. **Deploy as Web App:**
   - Click "Deploy" → "New deployment"
   - Type: Web app
   - Execute as: Me
   - Who has access: Anyone
   - Click "Deploy"
   - Copy the Web App URL

5. **Update the URL in your HTML/JS files:**
   - Replace the Tech Fund API URL with your new Web App URL

## Sheet Format Options:

### Option 1: Date First (Recommended)
```
Date | Member | Amount | Category | Notes
```

### Option 2: Member First (Easiest Entry)
```
Member | Amount | Date | Category | Notes
```

The script automatically detects column headers, so either format works!

## Auto-Fill Formulas:

**For Category column (Column D if Date First, Column D if Member First):**
```
="Tech Fund"
```

**For Date column (if you want auto-today):**
```
=TODAY()
```

**For Date column (if you want timestamp when row is created):**
Use Apps Script onEdit trigger (optional, more advanced)
