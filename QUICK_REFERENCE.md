# Tech Fund - Quick Reference Card

## 📋 Sheet Format (Copy This!)

### Sheet Name: `tech-contributions`

| A | B | C | D | E |
|---|---|---|---|---|
| **Member** | **Amount** | **Date** | **Category** | **Notes** |

### Row 1 (Headers):
```
Member | Amount | Date | Category | Notes
```

### Row 2+ (Data - Copy formulas from Row 2):
```
Muthukumar | 500 | =TODAY() | ="Tech Fund" | 
Hepsi | 300 | =TODAY() | ="Tech Fund" | January
```

---

## ✅ Entry Workflow (Super Simple!)

1. **Add new row**
2. **Enter Member name** (Column A)
3. **Enter Amount** (Column B)
4. **Copy Date & Category formulas** from row above (or they auto-fill)
5. **Done!** ✅

---

## 🔧 Required Setup

### 1. Sheet Structure
- Sheet name: `tech-contributions`
- Headers in Row 1: `Member | Amount | Date | Category | Notes`

### 2. Formulas
- **C2 (Date):** `=TODAY()`
- **D2 (Category):** `="Tech Fund"`
- Copy these down for all rows

### 3. Config Sheet
- Sheet name: `config`
- A1: `goalamount`
- B1: `50000` (your goal amount)

### 4. Apps Script
- Use `tech-fund-appscript.js` file
- Replace `YOUR_SHEET_ID_HERE` with your actual sheet ID
- Deploy as Web App
- Copy the Web App URL

### 5. Update Website
- Replace Tech Fund API URL in:
  - `script.js` (line 114)
  - `preloader.html` (line 23)
  - `members.html` (line 167)

---

## 📊 Expected JSON Output

```json
{
  "goalAmount": 50000,
  "contributions": [
    {
      "Date": "2026-01-15T00:00:00.000Z",
      "Amount": 500,
      "Category": "Tech Fund",
      "Notes": "",
      "Member": "Muthukumar"
    }
  ]
}
```

---

## 🎯 That's It!

Your Tech Fund will work exactly like Christmas Fund, but with easier data entry! 🚀
