// Paste into Extensions > Apps Script on the target Google Sheet.
// Create a sheet tab named "Log" with header row:
// Timestamp | Event | ClickID | Ref | Dest | Order | Amount | Postal | City | Country
// Then deploy: Deploy > New deployment > Web app
//   Execute as: Me
//   Who has access: Anyone
// Copy the resulting /exec URL into wrangler.toml as SHEET_WEBHOOK_URL

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Log');
  const data = JSON.parse(e.postData.contents);

  sheet.appendRow([
    new Date(),
    data.event || '',
    data.clickId || '',
    data.ref || '',
    data.dest || '',
    data.order || '',
    data.amount || '',
    data.postal || '',
    data.city || '',
    data.country || '',
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Run this ONCE manually from the Apps Script editor (select setupSheets,
// click Run) before you start using the sheet. It creates two tabs:
//
//   WhatsApp_Sales   — manual entry: fill in one row per WhatsApp sale
//   WhatsApp_Summary — auto-calculated 7d/30d/90d rollups per ref code,
//                      same rolling-window logic as Looker Bot's
//                      Amazon_Clicks tab, but formula-driven instead of
//                      script-driven since the input here is manual.
//
// Safe to re-run — it won't duplicate tabs that already exist.
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let salesSheet = ss.getSheetByName('WhatsApp_Sales');
  if (!salesSheet) {
    salesSheet = ss.insertSheet('WhatsApp_Sales');
    salesSheet.appendRow(['Date', 'Ref', 'Customer', 'Amount', 'Notes']);
    salesSheet.getRange('A1:E1').setFontWeight('bold');
  }

  let summarySheet = ss.getSheetByName('WhatsApp_Summary');
  if (!summarySheet) {
    summarySheet = ss.insertSheet('WhatsApp_Summary');
    summarySheet.appendRow([
      'Ref', 'Sales_7d', 'Sales_30d', 'Sales_90d', 'Revenue_30d', 'Last_Updated',
    ]);
    summarySheet.getRange('A1:F1').setFontWeight('bold');

    summarySheet.getRange('A2').setFormula(
      '=SORT(UNIQUE(WhatsApp_Sales!B2:B))'
    );
    summarySheet.getRange('B2').setFormula(
      '=ARRAYFORMULA(IF(A2:A="","",COUNTIFS(WhatsApp_Sales!$B:$B,A2:A,WhatsApp_Sales!$A:$A,">="&TODAY()-7)))'
    );
    summarySheet.getRange('C2').setFormula(
      '=ARRAYFORMULA(IF(A2:A="","",COUNTIFS(WhatsApp_Sales!$B:$B,A2:A,WhatsApp_Sales!$A:$A,">="&TODAY()-30)))'
    );
    summarySheet.getRange('D2').setFormula(
      '=ARRAYFORMULA(IF(A2:A="","",COUNTIFS(WhatsApp_Sales!$B:$B,A2:A,WhatsApp_Sales!$A:$A,">="&TODAY()-90)))'
    );
    summarySheet.getRange('E2').setFormula(
      '=ARRAYFORMULA(IF(A2:A="","",SUMIFS(WhatsApp_Sales!$D:$D,WhatsApp_Sales!$B:$B,A2:A,WhatsApp_Sales!$A:$A,">="&TODAY()-30)))'
    );
    summarySheet.getRange('F2').setFormula('=IF(A2="","",NOW())');
  }

  let clickSummary = ss.getSheetByName('Click_Summary');
  if (!clickSummary) {
    clickSummary = ss.insertSheet('Click_Summary');
    clickSummary.appendRow([
      'Ref', 'Clicks_120d', 'Conversions_120d', 'Revenue_120d', 'Last_Updated',
    ]);
    clickSummary.getRange('A1:E1').setFontWeight('bold');

    clickSummary.getRange('A2').setFormula(
      '=SORT(UNIQUE(FILTER(Log!D2:D, Log!D2:D<>"")))'
    );
    clickSummary.getRange('B2').setFormula(
      '=ARRAYFORMULA(IF(A2:A="","",COUNTIFS(Log!$D:$D,A2:A,Log!$B:$B,"click",Log!$A:$A,">="&TODAY()-120)))'
    );
    clickSummary.getRange('C2').setFormula(
      '=ARRAYFORMULA(IF(A2:A="","",COUNTIFS(Log!$D:$D,A2:A,Log!$B:$B,"conversion",Log!$A:$A,">="&TODAY()-120)))'
    );
    clickSummary.getRange('D2').setFormula(
      '=ARRAYFORMULA(IF(A2:A="","",SUMIFS(Log!$G:$G,Log!$D:$D,A2:A,Log!$B:$B,"conversion",Log!$A:$A,">="&TODAY()-120)))'
    );
    clickSummary.getRange('E2').setFormula('=IF(A2="","",NOW())');
  }
}
