# Tech Fund - Dynamic Auto-Fill Setup

## 🎯 Goal
- Auto-fill **Date** and **Category** when **Member** and **Amount** are entered
- Dynamic **Member dropdown** that only appears on the next empty row (not entire column)

---

## 📊 Sheet Setup

### Step 1: Headers (Row 1)
```
A1: Member
B1: Amount
C1: Date
D1: Category
E1: Notes
```

### Step 2: Member List Sheet
Create a new sheet named `members-list`:
- Column A: List all member names (one per row)
- Example:
  ```
  A1: Muthukumar
  A2: Hepsi
  A3: Benita
  A4: Benjamin
  ... (all members)
  ```

### Step 3: Auto-Fill Formulas (Row 2)

**In C2 (Date column):**
```excel
=IF(AND(A2<>"", B2<>""), TODAY(), "")
```

**In D2 (Category column):**
```excel
=IF(AND(A2<>"", B2<>""), "Tech Fund", "")
```

**Copy these formulas down** for as many rows as you need (e.g., rows 2-1000)

### Step 4: Dynamic Member Dropdown (Apps Script Required)

Since Google Sheets doesn't support truly dynamic data validation with pure formulas, we'll use a simple Apps Script trigger.

---

## 🔧 Apps Script Code for Dynamic Dropdown

Add this to your Apps Script (same file as your doGet function):

```javascript
/**
 * Automatically sets up member dropdown on the next empty row
 * Runs whenever the sheet is edited
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
  
  // Only trigger if editing Member (A) or Amount (B) column
  if (col !== 1 && col !== 2) {
    return;
  }
  
  // Skip header row
  if (row === 1) {
    return;
  }
  
  // Find the last row with data
  const lastRow = sheet.getLastRow();
  const nextRow = lastRow + 1;
  
  // Don't set validation if next row is beyond reasonable limit (e.g., 10000)
  if (nextRow > 10000) {
    return;
  }
  
  // Get member list range
  const memberSheet = e.source.getSheetByName('members-list');
  if (!memberSheet) {
    return;
  }
  
  const memberLastRow = memberSheet.getLastRow();
  if (memberLastRow < 1) {
    return;
  }
  
  // Set data validation on next row's Member column
  const nextCell = sheet.getRange(nextRow, 1); // Column A, next row
  
  // Clear existing validation
  nextCell.clearDataValidations();
  
  // Create new validation
  const memberRange = memberSheet.getRange(1, 1, memberLastRow, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(memberRange)
    .setAllowInvalid(false)
    .setHelpText('Select a member from the list')
    .build();
  
  nextCell.setDataValidation(rule);
}
```

### How It Works:
1. When you edit **Member** (Column A) or **Amount** (Column B)
2. Script finds the last row with data
3. Automatically sets dropdown on the **next empty row** (Column A only)
4. Dropdown disappears from previous rows (only shows on next row)

---

## 📝 Complete Setup Instructions

### 1. Create Sheet Structure
- Sheet: `tech-contributions`
- Headers: Member | Amount | Date | Category | Notes

### 2. Create Member List
- Sheet: `members-list`
- Column A: All member names

### 3. Add Auto-Fill Formulas
- **C2:** `=IF(AND(A2<>"", B2<>""), TODAY(), "")`
- **D2:** `="Tech Fund"` (simpler, always shows if you want)
- Or **D2:** `=IF(AND(A2<>"", B2<>""), "Tech Fund", "")` (only shows when filled)
- Copy formulas down (C2:D1000 or as needed)

### 4. Add Apps Script
- Open Apps Script editor
- Add the `onEdit` function above
- Save (no need to deploy - triggers run automatically)

### 5. Initial Dropdown Setup
- Manually set dropdown on **Row 2** (Column A):
  - Select A2
  - Data → Data validation
  - List from range: `members-list!A:A`
  - Save
- The script will handle all future rows automatically!

---

## ✅ How It Works in Practice

1. **Row 2:** You see dropdown → Select Member → Enter Amount → Date & Category auto-fill
2. **Row 3:** Dropdown automatically appears on Row 3 (Column A)
3. **Fill Row 3:** Select Member → Enter Amount → Date & Category auto-fill
4. **Row 4:** Dropdown automatically appears on Row 4
5. And so on...

**The dropdown only exists on the next empty row!** 🎯

---

## 🔄 Alternative: Pure Formula Approach (No Script)

If you prefer NO Apps Script at all, you can:

1. Set dropdown on a fixed range (e.g., A2:A1000)
2. Use conditional formatting to highlight only the next empty row
3. Users manually navigate to that row

But the Apps Script approach is cleaner and more automated!

---

## 🎨 Optional: Visual Indicator

Add conditional formatting to highlight the "active" row:
- Select entire sheet (or rows 2-1000)
- Format → Conditional formatting
- Formula: `=ROW()=COUNTA($A$2:$A$1000)+1`
- Color: Light yellow or blue
- This highlights the next row to fill

---

## 📋 Summary

✅ **Auto-fill Date:** Formula checks if Member & Amount filled, then shows TODAY()  
✅ **Auto-fill Category:** Formula shows "Tech Fund" when row has data  
✅ **Dynamic Dropdown:** Apps Script automatically sets dropdown on next empty row  
✅ **No Frontend Changes:** All changes are in Google Sheets only!
