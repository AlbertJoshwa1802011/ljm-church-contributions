/**
 * AUTOMATIC SHEET FILLER (onEdit trigger)
 * 
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Create a new file named `auto-fill-onedit.gs` and copy/paste this entire code into it.
 * 4. Save the file.
 * 
 * How it works:
 * Whenever you type a Member Name (Col A) and an Amount (Col B) in the Tech Contributions sheet,
 * this script will automatically insert a FIXED Timestamp in Column C (preventing the "always today" bug),
 * add a dropdown menu to Category (Col D) with options like "Direct Cash" and "Manual Google Pay",
 * and fill "Added by Admin" in Notes (Col E).
 */

function onEdit(e) {
  if (!e || !e.range) return;
  
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName().toLowerCase();
  
  // We only want to run this on the Tech Contributions sheet
  // If your fund name is different, change "tech" to match your sheet's name
  if (sheetName.includes("tech")) {
    const row = e.range.getRow();
    const col = e.range.getColumn();
    
    // Ignore edits to the header row
    if (row <= 1) return;
    
    // Check if the edit happened in Column 1 (Member) or Column 2 (Amount)
    if (col === 1 || col === 2) {
      const member = sheet.getRange(row, 1).getValue();
      const amount = sheet.getRange(row, 2).getValue();
      
      // Proceed only if both Member and Amount are filled
      if (member !== "" && amount !== "") {
        
        // 1. Autofill Date (Column 3) with a STATIC timestamp if it's currently empty
        // This fixes the bug where volatile formulas like =NOW() update every day to the current date.
        const dateCell = sheet.getRange(row, 3);
        if (dateCell.getValue() === "") {
          const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
          dateCell.setValue(timestamp);
        }
        
        // 2. Autofill Category (Column 4) and provide a dropdown of options
        const categoryCell = sheet.getRange(row, 4);
        if (categoryCell.getValue() === "") {
          // Default text when auto-filled
          categoryCell.setValue("Direct Cash");
          
          // Create a dropdown menu (Data Validation) so you can easily change the category
          const options = [
            "Online (Verified)", 
            "Direct Cash", 
            "Manual Google Pay", 
            "Bank Transfer",
            "Cheque"
          ];
          
          const rule = SpreadsheetApp.newDataValidation()
            .requireValueInList(options, true) // true = show dropdown
            .setAllowInvalid(true) // allow them to type custom text if needed
            .build();
            
          categoryCell.setDataValidation(rule);
        }
        
        // 3. Autofill Notes (Column 5) with the name/email of whoever is currently typing
        const notesCell = sheet.getRange(row, 5);
        if (notesCell.getValue() === "") {
           // Capture the email of the person logged into Google and making this edit
           let editor = Session.getActiveUser().getEmail();
           if (!editor) editor = Session.getEffectiveUser().getEmail();
           
           // If we still don't have an email (e.g. anonymous or restricted), fallback to generic
           const label = editor ? editor.split("@")[0] : "Admin";
           notesCell.setValue("Added by " + label); 
        }
        
      }
    }
  }
}
