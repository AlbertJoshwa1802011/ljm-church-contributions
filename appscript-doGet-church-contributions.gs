/**
 * Minimal doGet for sheet "church-contributions"
 * Use this if your sheet is named "church-contributions" (not "tech-contributions").
 *
 * Fix: Date is output as YYYY-MM-DD so each row keeps its real calendar date
 * and "Most Active Month" shows the correct month (Jan vs Mar).
 */

function formatDateOnly(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1);
  if (m.length === 1) m = '0' + m;
  var day = String(d.getDate());
  if (day.length === 1) day = '0' + day;
  return y + '-' + m + '-' + day;
}

function doGet() {
  var SHEET_ID = "1BsuLjPmFrW85AnZgmicrCj0vWlbQ4OH369PdBVA3zyE";
  var ss = SpreadsheetApp.openById(SHEET_ID);

  var sheet = ss.getSheetByName("church-contributions");
  var values = sheet.getDataRange().getValues();
  var headers = values.shift();

  var contributions = values.map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      var val = row[i];
      if (h === "Date" && val) {
        var dateObj;
        if (Object.prototype.toString.call(val) === '[object Date]') {
          dateObj = val;
        } else if (typeof val === 'string' && val.trim()) {
          dateObj = new Date(val.trim());
          if (isNaN(dateObj.getTime())) dateObj = new Date();
        } else {
          dateObj = new Date();
        }
        val = formatDateOnly(dateObj);
      }
      obj[h] = val;
    });
    return obj;
  });

  var goalAmount = 0;
  var configSheet = ss.getSheetByName("config");
  if (configSheet) {
    var configData = configSheet.getDataRange().getValues();
    configData.forEach(function(row) {
      if (row[0] && row[0].toString().toLowerCase() === "goalamount") {
        goalAmount = Number(row[1]) || 0;
      }
    });
  }

  return ContentService
    .createTextOutput(JSON.stringify({
      goalAmount: goalAmount,
      contributions: contributions
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
