# 🚀 Quick Start - Tech Fund Setup

## Your Current Status
✅ Sheet is ready with data:
- Member | Amount | Date | Category | Notes
- Data format: "January 12, 2026" (text format) ✅ Supported!

---

## ⚡ 3 Simple Steps

### STEP 1: Deploy Apps Script (5 minutes)

1. **Open Google Sheet** → **Extensions** → **Apps Script**
2. **Copy code** from `tech-fund-appscript.js`
3. **Replace** `YOUR_SHEET_ID_HERE` with your actual Sheet ID
4. **Save** the script
5. **Deploy** → **New deployment** → **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**
6. **Copy the Web App URL** (save it!)

---

### STEP 2: Update Website Files (5 minutes)

**Find & Replace in these 7 files:**

**OLD URL:**
```
https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec
```

**NEW URL:** (Your Web App URL from Step 1)

**Files to update:**
1. `script.js` (2 places - lines ~41 and ~114)
2. `preloader.html` (line ~23)
3. `members.html` (line ~167)
4. `fundData.js` (line ~12) - if exists
5. `members.js` (line ~6)
6. `member-dashboard.js` (line ~17)

**Quick method:** Use Find & Replace (Ctrl+H) across all files!

---

### STEP 3: Create Config Sheet (1 minute)

1. In Google Sheet, create new tab: `config`
2. A1: `goalamount`
3. B1: `50000` (your goal amount)

---

## ✅ Test

1. **Test API:** Open Web App URL → Should see JSON
2. **Test Website:** Open `index.html?fund=Tech Fund` → Should show data

---

## 📋 Complete Checklist

- [ ] Apps Script deployed
- [ ] Web App URL copied
- [ ] `script.js` updated (2 places)
- [ ] `preloader.html` updated
- [ ] `members.html` updated
- [ ] `fundData.js` updated (if exists)
- [ ] `members.js` updated
- [ ] `member-dashboard.js` updated
- [ ] Config sheet created
- [ ] API tested
- [ ] Website tested

---

## 🎉 Done!

Your Tech Fund is now live! 🚀

---

## 📚 Detailed Guides

- **Full Setup:** See `STEP_BY_STEP_SETUP.md`
- **URL Replacement:** See `URL_REPLACEMENT_GUIDE.md`
- **Sheet Formulas:** See `SHEET_FORMULAS.md`
