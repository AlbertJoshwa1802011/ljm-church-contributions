# Apps Script Migration Guide - Unified Solution

## 📋 Current Situation

You have **2 existing functions**:
1. **`christmasfund.gs`** - Handles Christmas Fund with parameter support
2. **`code.gs`** - Simple function for church-contributions sheet

## ✅ Recommended Solution: Unified Function

I've created a **unified function** that:
- ✅ **Keeps your existing functions intact** (backward compatible)
- ✅ **Adds Tech Fund support** intelligently
- ✅ **Auto-detects format** (Tech Fund vs Christmas Fund)
- ✅ **Uses parameter-based approach** (like your existing code)

---

## 🎯 Option 1: Add Unified Function (Recommended)

### Step 1: Add New File in Apps Script

1. Open **Apps Script** editor
2. Click **+** (Add file) → **Script**
3. Name it: `unified-fund.gs`
4. **Copy the entire code** from `unified-fund-appscript.gs`
5. **Paste it** into the new file

### Step 2: Deploy Unified Function

1. Click **Deploy** → **New deployment**
2. Select **Web app**
3. **Function to execute:** `doGet` (from unified-fund.gs)
4. **Execute as:** Me
5. **Who has access:** Anyone
6. Click **Deploy**
7. **Copy the Web App URL**

### Step 3: Use with Parameters

**URLs:**
- **Christmas Fund:** `YOUR_URL?fund=christmas-fund`
- **Tech Fund:** `YOUR_URL?fund=tech-contributions` (or `?fund=tech`)

**Benefits:**
- ✅ One deployment handles both funds
- ✅ Existing Christmas Fund code stays untouched
- ✅ Auto-detects format automatically
- ✅ Easy to maintain

---

## 🎯 Option 2: Enhance Existing christmasfund.gs

### Modify `christmasfund.gs` to Support Both

Replace your existing `christmasfund.gs` with this enhanced version:

```javascript
function doGet(e) {
  const SHEET_ID = "1BsuLjPmFrW85AnZgmicrCj0vWlbQ4OH369PdBVA3zyE";
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // Determine fund
  let fundName = (e.parameter.fund || "christmas-fund").toLowerCase();
  
  // Map aliases
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

  const values = sheet.getDataRange().getValues();
  if(values.length < 2) {
    return ContentService.createTextOutput(JSON.stringify({
      goalAmount: 0,
      contributions: []
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const headers = values[0].map(h => h.toString().toLowerCase().trim());
  const dataRows = values.slice(1);

  // Detect format: Tech Fund has "date" column
  const hasDateColumn = headers.includes('date');
  const hasAmountColumn = headers.includes('amount');
  const hasMemberColumn = headers.includes('member');

  let contributions = [];

  if (hasDateColumn && hasAmountColumn && hasMemberColumn) {
    // Tech Fund Format
    contributions = processTechFundFormat(headers, dataRows);
  } else {
    // Christmas Fund Format (existing logic)
    contributions = processChristmasFundFormat(headers, dataRows);
  }

  // Config sheet for goal amount
  let goalAmount = 0;
  const configSheet = ss.getSheetByName("config");
  if(configSheet) {
    const configData = configSheet.getDataRange().getValues();
    const goalKey = fundName === "tech-contributions" ? "tech_goal_amount" : "christmas_goal_amount";
    
    configData.forEach(row => {
      const key = row[0] ? row[0].toString().toLowerCase().trim() : '';
      if (key === goalKey || key === "goalamount") {
        goalAmount = Number(row[1]) || 0;
      }
    });
  }

  return ContentService
    .createTextOutput(JSON.stringify({
      goalAmount: goalAmount,
      contributions: contributions
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Tech Fund processor
function processTechFundFormat(headers, dataRows) {
  const memberIdx = headers.indexOf('member');
  const amountIdx = headers.indexOf('amount');
  const dateIdx = headers.indexOf('date');
  const categoryIdx = headers.indexOf('category');
  const notesIdx = headers.indexOf('notes');

  return dataRows
    .map(row => {
      const member = (memberIdx >= 0 && row[memberIdx]) ? row[memberIdx].toString().trim() : '';
      const amount = (amountIdx >= 0 && row[amountIdx]) ? Number(row[amountIdx]) : 0;
      
      if (!member || amount <= 0) return null;

      let dateObj;
      if (dateIdx >= 0 && row[dateIdx]) {
        const dateVal = row[dateIdx];
        if (dateVal instanceof Date) {
          dateObj = dateVal;
        } else if (typeof dateVal === 'string' && dateVal.trim()) {
          dateObj = new Date(dateVal);
          if (isNaN(dateObj.getTime())) dateObj = new Date();
        } else {
          dateObj = new Date();
        }
      } else {
        dateObj = new Date();
      }

      return {
        Date: dateObj.toISOString(),
        Amount: amount,
        Category: (categoryIdx >= 0 && row[categoryIdx]) ? row[categoryIdx].toString().trim() : 'Tech Fund',
        Notes: (notesIdx >= 0 && row[notesIdx]) ? row[notesIdx].toString().trim() : '',
        Member: member
      };
    })
    .filter(c => c !== null);
}

// Christmas Fund processor (your existing logic)
function processChristmasFundFormat(headers, dataRows) {
  const contributions = [];
  const monthMap = {
    "january":0, "february":1, "march":2, "april":3,
    "may":4, "june":5, "july":6, "august":7,
    "september":8, "october":9, "november":10, "december":11
  };

  dataRows.forEach(row => {
    const member = row[1];
    if(!member) return;

    for(let i = 2; i < headers.length; i++) {
      let monthName = headers[i];
      if(!monthName) continue;

      monthName = monthName.toString().trim().toLowerCase();
      const monthIndex = monthMap[monthName];
      if(monthIndex === undefined) continue;

      const amount = Number(row[i]) || 0;
      if(amount <= 0) continue;

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
```

**Then:**
- Redeploy `christmasfund.gs` with the enhanced code
- Use: `?fund=christmas-fund` or `?fund=tech-contributions`

---

## 🎯 Option 3: Keep Separate (Simplest)

**Keep everything as is** and just add Tech Fund function:

1. Add new file: `techfund.gs`
2. Copy code from `tech-fund-appscript.js`
3. Deploy separately
4. Get new URL for Tech Fund

**Pros:**
- ✅ No changes to existing code
- ✅ Completely independent
- ✅ Easy to debug

**Cons:**
- ❌ Two separate deployments to maintain

---

## ✅ My Recommendation: **Option 1 (Unified Function)**

**Why?**
- ✅ One deployment, two funds
- ✅ Auto-detects format (no manual configuration)
- ✅ Existing code stays untouched
- ✅ Easy to add more funds later
- ✅ Clean and maintainable

---

## 📋 Implementation Steps (Option 1)

1. **Add `unified-fund-appscript.gs`** as new file in Apps Script
2. **Deploy it** as Web App
3. **Get the URL**
4. **Update website files:**
   - Christmas Fund: `YOUR_URL?fund=christmas-fund`
   - Tech Fund: `YOUR_URL?fund=tech-contributions`
5. **Test both funds**

---

## 🧪 Testing

After deployment, test:

1. **Christmas Fund:** `YOUR_URL?fund=christmas-fund`
2. **Tech Fund:** `YOUR_URL?fund=tech-contributions`

Both should return JSON with contributions!

---

## 📝 Config Sheet Setup

In your `config` sheet, you can have:

```
A1: goalamount          B1: 50000
A2: christmas_goal_amount  B2: 23200
A3: tech_goal_amount    B3: 50000
```

The function will automatically pick the right goal amount!

---

## 🎉 Ready to Deploy?

Choose your option and let me know! I recommend **Option 1** for the cleanest solution! 🚀
