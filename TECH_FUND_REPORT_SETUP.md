# Tech Fund Report - Auto-Generated Summary Sheet

## 📊 What It Does

Automatically generates a **read-only report sheet** from your `tech-contributions` data in this format:

| S.No | Church Youth Member | January 2026 | ... | Member's Total | Installments Paid |
|------|---------------------|--------------|-----|----------------|-------------------|
| 1    | Muthukumar          | 500          | ... | 800            | 4                 |
| 2    | Hepsi               | 500          | ... | 800            | 4                 |
| ...  | ...                 | ...          | ... | ...            | ...               |

- **Member's Total** = Sum of all contributions from that member
- **Installments Paid** = Number of contribution records (each payment = 1 installment)
- **Month columns** = Auto-detected from your data, in ascending order (January → December)

---

## ✅ Quick Setup (3 Steps)

### Step 1: Add the Script

1. Open your **Google Sheet** (the one with `tech-contributions`)
2. Go to **Extensions** → **Apps Script**
3. Create a **new file** (or add to existing): `tech-fund-report-generator.gs`
4. Copy the **entire contents** from `tech-fund-report-generator.gs` in this project
5. Paste and **Save** (Ctrl+S / Cmd+S)

### Step 2: First Run + Enable Auto-Sync

1. In the Apps Script editor, select **`generateTechFundReport`** from the dropdown → Click **Run** (▶️)
2. Authorize the script when prompted
3. A new sheet **`tech-fund-report`** will be created
4. In the spreadsheet, go to **Tech Fund** menu → **Enable Auto-Sync (run once)**
5. Approve the trigger when prompted

**That's it!** The report now syncs automatically whenever you edit `tech-contributions`. No need to run anything again.

### Step 3: Protect the Sheet (Automatic)

The script **automatically protects** the report sheet so only you (the owner) can edit it. Everyone else sees it as read-only.

---

## 🔄 When Does the Report Update?

**Always in sync** – Once you run **Enable Auto-Sync** once, the report updates automatically every time you add or edit a row in `tech-contributions`.

**Manual refresh** – You can still use **Tech Fund** → **Generate Report** anytime.

---

## ⚙️ Configuration (Optional)

**You don't need to configure anything.** Month columns are auto-detected from your data in ascending order.

To override (e.g. fix specific months), add to your **`config`** sheet:

| Column A        | Column B                          |
|-----------------|-----------------------------------|
| `report_months` | `September,October,November,December` |
| `report_year`   | `2026`                            |

- **report_months**: Only if you want fixed months. Leave empty for auto-detect.
- **report_year**: Only used when `report_months` is set

---

## 👥 Member List

- If you have a **`members-list`** sheet with member names in Column A, the report will include **all** members (even those with ₹0 contributions)
- If no `members-list` exists, the report shows only members who have made contributions

---

## 📋 Source vs Output

**Source (tech-contributions):**

| Member         | Amount | Date            | Category | Notes   |
|----------------|--------|-----------------|----------|---------|
| Muthukumar     | 500    | January 12, 2026| Tech Fund|         |
| Hepsi          | 500    | January 12, 2026| Tech Fund|         |
| Benita         | 200    | January 12, 2026| Tech Fund|         |
| Albert Joshwa A| 300    | January 31, 2026| Tech Fund|         |

**Output (tech-fund-report):**  
Automatically aggregated by member and month, with totals and installment count.

---

## 🔒 Sheet Protection

- The report sheet is **protected** by the script
- Only the **spreadsheet owner** can edit it
- Collaborators can **view** but not **edit**
- To change who can edit: Right-click the sheet tab → **Protect sheet** → Adjust permissions

---

## 🛠 Troubleshooting

**"Sheet tech-contributions not found"**  
- Ensure your sheet is named exactly `tech-contributions` (case-sensitive)

**Wrong months showing**  
- By default months come from your data. To fix specific months, add `report_months` to `config` sheet.

**Members missing**  
- Create a `members-list` sheet with all youth members in Column A.

**Report not updating automatically**  
- Go to **Tech Fund** → **Enable Auto-Sync (run once)** and approve the trigger.  
- Or run **Tech Fund** → **Generate Report** manually.
