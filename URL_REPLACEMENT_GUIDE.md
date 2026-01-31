# URL Replacement Guide - Quick Reference

## 🔗 Find & Replace Instructions

### Current Tech Fund URL (OLD - Replace This):
```
https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec
```

### Your New Tech Fund URL (NEW - Use This):
```
[PASTE YOUR WEB APP URL HERE]
```

---

## 📝 Files to Update (7 files total)

### 1. `script.js` - 2 places

**Location 1 (Line ~41):**
```javascript
// FIND:
promises.push(fetchAndCacheFund("techFundData", "https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec"));

// REPLACE WITH:
promises.push(fetchAndCacheFund("techFundData", "YOUR_NEW_URL_HERE"));
```

**Location 2 (Line ~114):**
```javascript
// FIND:
const API_URL = "https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec";

// REPLACE WITH:
const API_URL = "YOUR_NEW_URL_HERE";
```

---

### 2. `preloader.html` - 1 place

**Location (Line ~23):**
```javascript
// FIND:
tech: "https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec",

// REPLACE WITH:
tech: "YOUR_NEW_URL_HERE",
```

---

### 3. `members.html` - 1 place

**Location (Line ~167):**
```javascript
// FIND:
"https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec", // Tech

// REPLACE WITH:
"YOUR_NEW_URL_HERE", // Tech
```

---

### 4. `fundData.js` - 1 place (if file exists)

**Location (Line ~12):**
```javascript
// FIND:
"https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec", // Tech

// REPLACE WITH:
"YOUR_NEW_URL_HERE", // Tech
```

---

### 5. `members.js` - 1 place

**Location (Line ~6):**
```javascript
// FIND:
"https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec";

// REPLACE WITH:
"YOUR_NEW_URL_HERE";
```

---

### 6. `member-dashboard.js` - 1 place

**Location (Line ~17):**
```javascript
// FIND:
const API_URL = "https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec";

// REPLACE WITH:
const API_URL = "YOUR_NEW_URL_HERE";
```

---

## 🔍 Quick Find & Replace Method

### Using VS Code / Text Editor:

1. **Open Find & Replace** (Ctrl+H / Cmd+H)
2. **Find:** 
   ```
   https://script.google.com/macros/s/AKfycbxllcIqvYX4aEQYOsad5OstQkkD6Kp33SDc6C96MOsESJ4m06oapTN4D_fiFbdawiOh/exec
   ```
3. **Replace with:** Your new Web App URL
4. **Scope:** All files in project
5. **Replace All**

**⚠️ Warning:** Make sure you're only replacing the Tech Fund URL, not the Christmas Fund URL!

---

## ✅ Verification Checklist

After replacing URLs, verify:

- [ ] `script.js` - Both locations updated
- [ ] `preloader.html` - Updated
- [ ] `members.html` - Updated
- [ ] `fundData.js` - Updated (if exists)
- [ ] `members.js` - Updated
- [ ] `member-dashboard.js` - Updated
- [ ] Christmas Fund URL still intact (not replaced)
- [ ] Test website - Tech Fund loads correctly

---

## 🧪 Test After Replacement

1. Open browser console (F12)
2. Navigate to Tech Fund page
3. Check Network tab for API calls
4. Verify the new URL is being called
5. Check if data loads correctly
