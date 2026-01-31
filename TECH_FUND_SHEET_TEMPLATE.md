# Tech Fund Google Sheet Template

## Sheet Structure

### Sheet Name: `tech-contributions`

**Column Structure:**

| Column | Header | Description | Auto-Fill/Formula |
|--------|--------|-------------|-------------------|
| A | **Date** | Contribution date | Auto-filled with TODAY() or manual entry |
| B | **Member** | Member name | Dropdown from member list (optional) |
| C | **Amount** | Contribution amount | **Manual entry only** |
| D | **Category** | Fund category | Auto-filled as "Tech Fund" |
| E | **Notes** | Optional notes | Manual entry (optional) |

### Example Data:

```
Date          | Member           | Amount | Category   | Notes
--------------|------------------|--------|------------|----------
2026-01-15    | Muthukumar       | 500    | Tech Fund  | January
2026-01-20    | Hepsi            | 300    | Tech Fund  | 
2026-02-10    | Benita           | 200    | Tech Fund  | February
2026-02-15    | Muthukumar       | 500    | Tech Fund  | 
```

## Setup Instructions:

1. **Create the sheet** with headers in Row 1:
   - A1: `Date`
   - B1: `Member`
   - C1: `Amount`
   - D1: `Category`
   - E1: `Notes`

2. **Set up Data Validation for Member column (Column B):**
   - Select Column B (excluding header)
   - Data → Data validation
   - Criteria: List from range (create a member list sheet or type members)
   - This makes entry easier with dropdown

3. **Auto-fill Category (Column D):**
   - In D2, enter formula: `="Tech Fund"`
   - Copy down for all rows

4. **Auto-fill Date (Column A) - Optional:**
   - You can use `=TODAY()` for current date
   - Or manually enter dates
   - Format: YYYY-MM-DD or any date format Google Sheets recognizes

5. **For easy entry workflow:**
   - Just enter: **Member name** (Column B) and **Amount** (Column C)
   - Date auto-fills with TODAY()
   - Category auto-fills as "Tech Fund"
   - Notes are optional

## Minimal Entry Workflow:

When someone contributes:
1. Enter **Member name** in Column B (or select from dropdown)
2. Enter **Amount** in Column C
3. Done! (Date and Category auto-fill)

---

## Alternative: Even Simpler Format (Recommended)

If you want the absolute minimum entry, use this format:

| Column | Header | Description |
|--------|--------|-------------|
| A | **Member** | Member name |
| B | **Amount** | Contribution amount |
| C | **Date** | Auto-filled with TODAY() |
| D | **Category** | Auto-filled as "Tech Fund" |
| E | **Notes** | Optional |

**Entry:** Just Member + Amount, everything else auto-fills!
