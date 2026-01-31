# Step-by-Step Setup Guide - Tech Fund Integration

## 📋 Overview

You need to:
1. ✅ **Sheet is ready** (you've done this!)
2. ⚙️ **Update Apps Script** - Add your sheet ID and deploy
3. 🔗 **Update Website Files** - Replace Tech Fund API URL in 7 files

---

## STEP 1: Update Apps Script

### 1.1 Open Apps Script
1. Open your **Google Sheet** (the one with tech-contributions data)
2. Click **Extensions** → **Apps Script**
3. You should see a code editor

### 1.2 Add/Update the Code
1. **Delete any existing code** in the editor
2. **Copy the entire code** from `tech-fund-appscript.js` file
3. **Paste it** into the Apps Script editor

### 1.3 Replace Sheet ID
1. Find this line in the code:
   ```javascript
   const SHEET_ID = "YOUR_SHEET_ID_HERE";
   ```
2. **Get your Sheet ID:**
   - Look at your Google Sheet URL
   - It looks like: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
   - Copy the part between `/d/` and `/edit`
   - Example: If URL is `https://docs.google.com/spreadsheets/d/1BsuLjPmFrW85AnZgmicrCj0vWlbQ4OH369PdBVA3zyE/edit`
   - Sheet ID is: `1BsuLjPmFrW85AnZgmicrCj0vWlbQ4OH369PdBVA3zyE`
3. **Replace** `YOUR_SHEET_ID_HERE` with your actual Sheet ID:
   ```javascript
   const SHEET_ID = "1BsuLjPmFrW85AnZgmicrCj0vWlbQ4OH369PdBVA3zyE";
   ```

### 1.4 Add Dynamic Dropdown Script (Optional but Recommended)
1. **Add this function** at the end of your Apps Script code (copy from `tech-fund-dynamic-appscript.js`):
   ```javascript
   function onEdit(e) {
     // ... (full code from tech-fund-dynamic-appscript.js)
   }
   ```
2. This enables the dynamic dropdown feature

### 1.5 Save the Script
1. Click **Save** (💾 icon or Ctrl+S / Cmd+S)
2. Give it a name like "Tech Fund API"

### 1.6 Deploy as Web App
1. Click **Deploy** → **New deployment**
2. Click the **gear icon** ⚙️ next to "Select type"
3. Choose **Web app**
4. Fill in:
   - **Description:** "Tech Fund Contributions API"
   - **Execute as:** Me (your email)
   - **Who has access:** Anyone
5. Click **Deploy**
6. **IMPORTANT:** Copy the **Web App URL** - you'll need this!
   - It looks like: `https://script.google.com/macros/s/AKfycb.../exec`
   - **Save this URL somewhere safe!**

### 1.7 Test the API
1. Open the **Web App URL** in a new browser tab
2. You should see JSON data like:
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
3. If you see this, **Apps Script is working!** ✅

---

## STEP 2: Update Website Files

You need to replace the **Tech Fund API URL** in **7 files**.

**Old URL (current):**
```
https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec
```

**New URL (your deployed Web App URL):**
```
https://script.google.com/macros/s/YOUR_NEW_URL_HERE/exec
```

### Files to Update:

#### 2.1 Update `script.js`
1. Open `script.js`
2. Find line **41** (around line 41):
   ```javascript
   promises.push(fetchAndCacheFund("techFundData", "https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec"));
   ```
3. Replace the URL with your new Web App URL

4. Find line **114**:
   ```javascript
   const API_URL = "https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec";
   ```
5. Replace the URL with your new Web App URL

#### 2.2 Update `preloader.html`
1. Open `preloader.html`
2. Find line **23**:
   ```javascript
   tech: "https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec",
   ```
3. Replace the URL with your new Web App URL

#### 2.3 Update `members.html`
1. Open `members.html`
2. Find line **167**:
   ```javascript
   "https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec", // Tech
   ```
3. Replace the URL with your new Web App URL

#### 2.4 Update `fundData.js` (if it exists)
1. Open `fundData.js`
2. Find line **12**:
   ```javascript
   "https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec", // Tech
   ```
3. Replace the URL with your new Web App URL

#### 2.5 Update `members.js`
1. Open `members.js`
2. Find line **6**:
   ```javascript
   "https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec";
   ```
3. Replace the URL with your new Web App URL

#### 2.6 Update `member-dashboard.js`
1. Open `member-dashboard.js`
2. Find line **17**:
   ```javascript
   const API_URL = "https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec";
   ```
3. Replace the URL with your new Web App URL

---

## STEP 3: Create Config Sheet (For Goal Amount)

### 3.1 Create Config Sheet
1. In your Google Sheet, create a new sheet tab
2. Name it: `config`

### 3.2 Add Goal Amount
1. In **A1**, type: `goalamount` (lowercase)
2. In **B1**, type your goal amount (e.g., `50000`)
3. Example:
   ```
   A1: goalamount
   B1: 50000
   ```

---

## STEP 4: Test Everything

### 4.1 Test the API
1. Open your Web App URL in browser
2. Check if JSON shows your data correctly

### 4.2 Test the Website
1. Open `index.html?fund=Tech Fund` in browser
2. Check if:
   - ✅ Fund heading shows "💻 Tech Fund Contributions"
   - ✅ Stats show correct amounts
   - ✅ Top contributors show
   - ✅ Timeline shows your contributions
   - ✅ Chart displays

### 4.3 Test Members Page
1. Open `members.html`
2. Check if Tech Fund members appear in the list

---

## ✅ Checklist

- [ ] Apps Script code added with correct Sheet ID
- [ ] Apps Script deployed as Web App
- [ ] Web App URL copied
- [ ] `script.js` updated (2 places)
- [ ] `preloader.html` updated
- [ ] `members.html` updated
- [ ] `fundData.js` updated (if exists)
- [ ] `members.js` updated
- [ ] `member-dashboard.js` updated
- [ ] Config sheet created with goalAmount
- [ ] API tested (shows JSON)
- [ ] Website tested (shows Tech Fund data)

---

## 🐛 Troubleshooting

### API returns error?
- Check Sheet ID is correct
- Check sheet name is exactly `tech-contributions`
- Check headers match: Member | Amount | Date | Category | Notes

### Website shows no data?
- Check browser console (F12) for errors
- Verify Web App URL is correct in all files
- Check if API URL works when opened directly

### Date format issues?
- The Apps Script handles "January 12, 2026" format automatically
- If dates are wrong, check your sheet date format

---

## 🎉 You're Done!

Once all steps are complete, your Tech Fund will work exactly like Christmas Fund! 🚀
