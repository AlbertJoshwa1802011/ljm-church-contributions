# Tech Fund Setup Guide - Complete Instructions

## 🎯 Goal: Easy Data Entry for Tech Fund

You want to enter just **Member** and **Amount** - everything else auto-fills!

---

## 📊 Recommended Sheet Format (EASIEST)

### Sheet Name: `tech-contributions`

**Column Layout:**

| A | B | C | D | E |
|---|---|---|---|---|
| **Member** | **Amount** | **Date** | **Category** | **Notes** |

### Row 1 (Headers):
```
Member | Amount | Date | Category | Notes
```

### Row 2+ (Data Entry):
- **Column A (Member):** Enter member name (or use dropdown)
- **Column B (Amount):** Enter contribution amount
- **Column C (Date):** Formula: `=TODAY()` (auto-fills current date)
- **Column D (Category):** Formula: `="Tech Fund"` (auto-fills)
- **Column E (Notes):** Optional notes (can leave blank)

### Example Data:

| Member | Amount | Date | Category | Notes |
|--------|--------|------|----------|-------|
| Muthukumar | 500 | =TODAY() | ="Tech Fund" | |
| Hepsi | 300 | =TODAY() | ="Tech Fund" | January |
| Benita | 200 | =TODAY() | ="Tech Fund" | |

**When you enter a new contribution:**
1. Type member name in Column A
2. Type amount in Column B
3. Copy formulas from C and D from row above (or they auto-fill)
4. Done! ✅

---

## 🔧 Setup Steps:

### Step 1: Create the Sheet

1. Open your Google Sheet
2. Create a new sheet named: `tech-contributions`
3. In Row 1, enter headers:
   - A1: `Member`
   - B1: `Amount`
   - C1: `Date`
   - D1: `Category`
   - E1: `Notes`

### Step 2: Set Up Auto-Fill Formulas

1. **In C2 (Date column):** Enter `=TODAY()`
2. **In D2 (Category column):** Enter `="Tech Fund"`
3. Select C2 and D2, then drag down to fill many rows (or copy-paste)
4. Format Column C as Date (Format → Number → Date)

### Step 3: Optional - Member Dropdown

1. Create a new sheet named `members-list`
2. List all member names in Column A
3. Go back to `tech-contributions` sheet
4. Select Column A (excluding header)
5. Data → Data validation
6. Criteria: List from range → `members-list!A:A`
7. This creates a dropdown for easy member selection

### Step 4: Config Sheet for Goal Amount

1. Create/use sheet named `config`
2. In A1: `goalamount` (lowercase)
3. In B1: Enter your goal amount (e.g., `50000`)

---

## 📝 Apps Script Code

Copy this code to your Apps Script:

```javascript
function doGet() {
  const SHEET_ID = "YOUR_SHEET_ID_HERE"; // Replace with your sheet ID
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
    return ContentService
      .createTextOutput(JSON.stringify({
        goalAmount: 0,
        contributions: []
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const headers = values[0].map(h => h.toString().toLowerCase().trim());
  const dataRows = values.slice(1);

  // Find column indices
  const memberIdx = headers.indexOf('member');
  const amountIdx = headers.indexOf('amount');
  const dateIdx = headers.indexOf('date');
  const categoryIdx = headers.indexOf('category');
  const notesIdx = headers.indexOf('notes');

  const contributions = dataRows
    .map(row => {
      const member = row[memberIdx] ? row[memberIdx].toString().trim() : '';
      const amount = row[amountIdx] ? Number(row[amountIdx]) : 0;
      
      // Skip empty rows
      if (!member || amount <= 0) return null;

      // Get date
      let dateObj;
      if (dateIdx >= 0 && row[dateIdx]) {
        const dateVal = row[dateIdx];
        if (dateVal instanceof Date) {
          dateObj = dateVal;
        } else {
          dateObj = new Date(dateVal);
        }
      } else {
        dateObj = new Date(); // Default to today
      }

      // Get category
      const category = (categoryIdx >= 0 && row[categoryIdx]) 
        ? row[categoryIdx].toString().trim() 
        : 'Tech Fund';

      // Get notes
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

### Deploy the Script:

1. Save the script
2. Click **Deploy** → **New deployment**
3. Select type: **Web app**
4. Execute as: **Me**
5. Who has access: **Anyone**
6. Click **Deploy**
7. **Copy the Web App URL** - you'll need this!

---

## 🔗 Update Your Website

Replace the Tech Fund API URL in these files:
- `script.js` (line 114)
- `preloader.html` (line 23)
- `members.html` (line 167)

Replace with your new Web App URL.

---

## ✅ Testing

1. Add a test entry in your sheet:
   - Member: `Test User`
   - Amount: `100`
   - Date and Category should auto-fill

2. Visit your Web App URL in browser
3. You should see JSON with your test contribution

4. Check your website - it should display the Tech Fund data!

---

## 🎨 Quick Entry Workflow

**Every time someone contributes:**

1. Go to `tech-contributions` sheet
2. Add new row
3. Enter **Member** name (or select from dropdown)
4. Enter **Amount**
5. Date and Category auto-fill automatically
6. Save - done! ✅

**That's it!** The website will automatically show the new contribution.
