# Exact Formulas for Tech Fund Sheet

## 📊 Your Current Sheet Structure

```
Row 1: Member | Amount | Date | Category | Notes
Row 2: Muthukumar | (empty) | (empty) | Tech Fund | (empty)
Row 3: (empty) | (empty) | (empty) | (empty) | (empty)
```

---

## ✅ Step-by-Step Setup

### Step 1: Update Row 2 Formulas

**In C2 (Date column):**
```excel
=IF(AND(A2<>"", B2<>""), TODAY(), "")
```

**In D2 (Category column):**
```excel
=IF(AND(A2<>"", B2<>""), "Tech Fund", "")
```

**What this does:**
- If both Member (A2) AND Amount (B2) are filled → Show Date/Category
- If either is empty → Show blank

### Step 2: Copy Formulas Down

1. Select **C2** and **D2**
2. Copy (Ctrl+C / Cmd+C)
3. Select range **C2:D1000** (or as many rows as you need)
4. Paste (Ctrl+V / Cmd+V)

Now all rows have the auto-fill formulas!

---

## 🔽 Dynamic Dropdown Setup

### Step 1: Create Members List Sheet

1. Create new sheet: `members-list`
2. In Column A, list all members:
   ```
   A1: Muthukumar
   A2: Hepsi
   A3: Benita
   A4: Benjamin
   A5: Allwin Prabhu
   ... (all your members)
   ```

### Step 2: Add Apps Script

1. Open **Extensions** → **Apps Script**
2. Paste the code from `tech-fund-dynamic-appscript.js`
3. **Save** (Ctrl+S / Cmd+S)
4. **No need to deploy** - `onEdit` triggers automatically!

### Step 3: Set Initial Dropdown (One Time)

1. Go back to `tech-contributions` sheet
2. Select **A2** (Member column, Row 2)
3. **Data** → **Data validation**
4. Criteria: **List from range**
5. Range: `members-list!A:A`
6. Click **Save**

**That's it!** The script will handle all future rows automatically.

---

## 🎯 How It Works

### When You Fill Row 2:
1. Select Member from dropdown (A2)
2. Enter Amount (B2)
3. Date (C2) and Category (D2) **automatically fill**
4. Script detects you filled Row 2
5. **Dropdown automatically appears on Row 3 (A3)**

### When You Fill Row 3:
1. Select Member from dropdown (A3)
2. Enter Amount (B3)
3. Date (C3) and Category (D3) **automatically fill**
4. Script detects you filled Row 3
5. **Dropdown automatically appears on Row 4 (A4)**

And so on! 🚀

---

## 📋 Complete Example

### After Setup, Your Sheet Looks Like:

| Row | Member (A) | Amount (B) | Date (C) | Category (D) | Notes (E) |
|-----|------------|------------|----------|--------------|-----------|
| 1 | **Member** | **Amount** | **Date** | **Category** | **Notes** |
| 2 | Muthukumar | 500 | `=IF(AND(A2<>"", B2<>""), TODAY(), "")` | `=IF(AND(A2<>"", B2<>""), "Tech Fund", "")` | |
| 3 | [Dropdown] | | `=IF(AND(A3<>"", B3<>""), TODAY(), "")` | `=IF(AND(A3<>"", B3<>""), "Tech Fund", "")` | |
| 4 | [Dropdown] | | `=IF(AND(A4<>"", B4<>""), TODAY(), "")` | `=IF(AND(A4<>"", B4<>""), "Tech Fund", "")` | |

**Note:** Dropdown only shows on the **next empty row** after your last filled row!

---

## 🔧 Troubleshooting

### Date not showing?
- Check if both Member AND Amount are filled
- Formula: `=IF(AND(A2<>"", B2<>""), TODAY(), "")`

### Category not showing?
- Same check - both Member and Amount must be filled
- Formula: `=IF(AND(A2<>"", B2<>""), "Tech Fund", "")`

### Dropdown not appearing on next row?
- Make sure Apps Script `onEdit` function is saved
- Check that `members-list` sheet exists
- Try manually editing A2 or B2 to trigger the script

### Want Category to always show?
Change D2 formula to:
```excel
="Tech Fund"
```
This will always show "Tech Fund" regardless of other cells.

---

## ✅ Quick Checklist

- [ ] Headers in Row 1: Member | Amount | Date | Category | Notes
- [ ] C2 formula: `=IF(AND(A2<>"", B2<>""), TODAY(), "")`
- [ ] D2 formula: `=IF(AND(A2<>"", B2<>""), "Tech Fund", "")`
- [ ] Formulas copied down to all rows (C2:D1000)
- [ ] `members-list` sheet created with member names
- [ ] Apps Script `onEdit` function added and saved
- [ ] Initial dropdown set on A2 (one-time manual setup)

**You're all set!** 🎉
