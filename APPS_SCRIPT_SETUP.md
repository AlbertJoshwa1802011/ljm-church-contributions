# Apps Script Setup Guide - Tech Fund

## ✅ Your Sheet ID
**Sheet ID:** `1BsuLjPmFrW85AnZgmicrCj0vWlbQ4OH369PdBVA3zyE`

**Important:** This Sheet ID is the **same for all tabs** in your Google Sheet! ✅

---

## 🎯 Two Options for Apps Script

Since you already have a **Christmas Fund Apps Script**, you have 2 options:

### **Option 1: Add to Same File (Recommended)** ✅

**Best if:** Both funds use the same Google Sheet (which they do!)

1. **Open your existing Apps Script** (the one with Christmas Fund)
2. **Add the Tech Fund function** to the same file
3. **Rename the function** to avoid conflicts:
   - Christmas Fund: `doGet()` (keep as is)
   - Tech Fund: `doGetTechFund()` (new function name)

4. **Deploy separately:**
   - Deploy Christmas Fund function → Get URL 1
   - Deploy Tech Fund function → Get URL 2

**OR use a parameter approach** (see Option 2)

---

### **Option 2: Use Parameter to Distinguish Funds (Best!)** ⭐

**Single function that handles both funds using a parameter:**

1. **Open your existing Apps Script**
2. **Add this code** (or modify existing `doGet`):

```javascript
function doGet(e) {
  // Get fund parameter from URL
  const fund = e.parameter.fund || 'tech'; // Default to tech
  
  const SHEET_ID = "1BsuLjPmFrW85AnZgmicrCj0vWlbQ4OH369PdBVA3zyE";
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  let sheetName;
  if (fund === 'christmas' || fund === 'Christmas Fund') {
    sheetName = "church-contributions"; // Your Christmas sheet name
  } else {
    sheetName = "tech-contributions"; // Your Tech sheet name
  }
  
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ 
        error: `Sheet '${sheetName}' not found`,
        goalAmount: 0,
        contributions: []
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ... rest of the code (same as tech-fund-appscript.js)
  // Process data and return JSON
}
```

3. **Deploy once** → Get one URL
4. **Use URL with parameter:**
   - Tech Fund: `YOUR_URL?fund=tech`
   - Christmas Fund: `YOUR_URL?fund=christmas`

**But wait!** Your Christmas Fund might already be deployed separately. If so, use **Option 3**.

---

### **Option 3: Create Separate Deployment (Simplest)** 🚀

**Best if:** You want to keep things separate and simple

1. **Open your existing Apps Script** (Christmas Fund)
2. **Add a NEW function** for Tech Fund:

```javascript
// Your existing Christmas Fund function
function doGet() {
  // ... Christmas Fund code ...
}

// NEW Tech Fund function
function doGetTechFund() {
  const SHEET_ID = "1BsuLjPmFrW85AnZgmicrCj0vWlbQ4OH369PdBVA3zyE";
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  const sheet = ss.getSheetByName("tech-contributions");
  // ... (copy code from tech-fund-appscript.js) ...
}
```

3. **Deploy Tech Fund separately:**
   - Click **Deploy** → **New deployment**
   - Select function: `doGetTechFund` (not `doGet`)
   - Deploy → Get new URL for Tech Fund

**This way:**
- ✅ Christmas Fund keeps its existing URL
- ✅ Tech Fund gets a new URL
- ✅ Both work independently
- ✅ No conflicts!

---

## 📋 Recommended: Option 3 (Separate Deployment)

### Step-by-Step:

1. **Open Apps Script:**
   - Go to your Google Sheet
   - **Extensions** → **Apps Script**

2. **Add Tech Fund Function:**
   - Copy the entire code from `tech-fund-appscript.js`
   - Paste it at the **end** of your existing code
   - **Rename the function** from `doGet` to `doGetTechFund`:
   ```javascript
   function doGetTechFund() {  // ← Changed name
     const SHEET_ID = "1BsuLjPmFrW85AnZgmicrCj0vWlbQ4OH369PdBVA3zyE";
     // ... rest of code
   }
   ```

3. **Save** the script

4. **Deploy Tech Fund:**
   - Click **Deploy** → **New deployment**
   - Click **gear icon** ⚙️ → Select **Web app**
   - **Function to execute:** Select `doGetTechFund` (important!)
   - **Execute as:** Me
   - **Who has access:** Anyone
   - Click **Deploy**
   - **Copy the Web App URL** - This is your Tech Fund URL!

5. **Keep Christmas Fund as is:**
   - Don't touch the existing `doGet()` function
   - Don't redeploy Christmas Fund
   - It will keep working with its existing URL

---

## ✅ After Deployment

Once you get the Tech Fund Web App URL, share it with me and I'll update all your website files automatically! 🚀

---

## 🧪 Test Your Deployment

1. Open the new Web App URL in browser
2. You should see JSON with your Tech Fund data:
   ```json
   {
     "goalAmount": 0,
     "contributions": [
       {
         "Date": "2026-01-12T00:00:00.000Z",
         "Amount": 500,
         "Category": "Tech Fund",
         "Notes": "",
         "Member": "Muthukumar"
       }
     ]
   }
   ```

If you see this, **you're ready!** Share the URL and I'll update all files! ✅
