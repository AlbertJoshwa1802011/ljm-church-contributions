# Goal Amount Setup Guide

## 🎯 Where to Set Goal Amount

**Answer: Use the Config Sheet** ✅

The goal amount should be set in your **Google Sheet's `config` tab**, NOT in the HTML/CSS/JS files.

---

## 📊 Config Sheet Setup

### Step 1: Create/Open Config Sheet

1. Open your Google Sheet
2. Create a new tab named: `config`
3. If it already exists, just open it

### Step 2: Add Goal Amount

In the `config` sheet, add:

| Column A | Column B |
|----------|----------|
| `tech_goal_amount` | `5000` |

**Example:**
```
A1: tech_goal_amount
B1: 5000
```

### Step 3: For Multiple Funds (Optional)

You can have different goals for different funds:

| Column A | Column B |
|----------|----------|
| `tech_goal_amount` | `5000` |
| `christmas_goal_amount` | `23200` |
| `goalamount` | `5000` (fallback) |

---

## 🔧 How It Works

1. **Apps Script reads** from the `config` sheet
2. **Looks for** `tech_goal_amount` (for Tech Fund)
3. **Falls back to** `goalamount` if specific key not found
4. **Returns** the goal amount in JSON
5. **Website displays** it automatically

---

## ✅ Benefits of Config Sheet

- ✅ **Easy to update** - Just change the number in the sheet
- ✅ **No code changes** needed
- ✅ **Separate goals** for different funds
- ✅ **Version controlled** in your sheet
- ✅ **No deployment** required

---

## 📝 Current Setup

Your Apps Script already supports this! Just add to your `config` sheet:

```
tech_goal_amount    5000
```

That's it! The website will automatically show ₹5,000 as the goal amount.

---

## 🎯 Quick Setup

1. Open Google Sheet
2. Go to `config` tab
3. Add: `tech_goal_amount` in A1, `5000` in B1
4. Save
5. Refresh website - Goal amount will update!

---

## 💡 Pro Tip

You can update the goal amount anytime without touching any code. Just change the number in the config sheet, and it will reflect on the website immediately (after cache expires or page refresh).
