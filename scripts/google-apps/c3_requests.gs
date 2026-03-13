/** @OnlyCurrentDoc */

var C3_REQUESTS_CONFIG = {
  sheetName: "c3_requests",
  headerRow: 1,
  referenceHeader: "reference_number",
  requestStatusHeader: "request_status",
  resolvedHeader: "resolved",
  serviceHeader: "service",
  addressHeader: "address",
  delayMs: 1500,
  retries: 2,
  finalStatuses: ["closed", "completed", "service request completed"],
  progressToastSeconds: 10,
  summaryToastSeconds: 8,
  highlightColor: "#d9ead3"
};

var C3_SERVICE_ROOT =
  "https://eservices1.capetown.gov.za/sap/opu/odata/sap/ZSERVICE_REQUESTS_SRV";
var C3_SEARCH_REFERER =
  "https://eservices1.capetown.gov.za/coct/wapl/zsreq_app/index.html#/search";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("C3 Requests")
    .addItem("Sync Open Requests", "syncOpenC3Requests")
    .addItem("Sync Selected Row", "syncSelectedC3Request")
    .addToUi();
}

function syncOpenC3Requests() {
  var context = getC3SheetContext_();
  if (!context) {
    return;
  }

  var pendingRows = [];
  for (
    var rowIndex = context.firstDataRowIndex;
    rowIndex < context.data.length;
    rowIndex += 1
  ) {
    var row = buildRowStateFromValues_(
      rowIndex + 1,
      context.data[rowIndex],
      context.columns
    );

    if (row && !isFinalStatus_(row.currentStatus)) {
      pendingRows.push(row);
    }
  }

  if (pendingRows.length === 0) {
    context.spreadsheet.toast("No open C3 requests needed syncing.", "C3 Requests", 5);
    return;
  }

  clearSyncHighlights_(
    context.sheet,
    context.columns,
    context.rowCount,
    context.firstSheetRow
  );

  var statusWrites = 0;
  var serviceWrites = 0;
  var addressWrites = 0;
  var updatedCells = 0;
  var errors = [];

  for (var i = 0; i < pendingRows.length; i += 1) {
    var row = pendingRows[i];
    context.spreadsheet.toast(
      "Checking " + (i + 1) + "/" + pendingRows.length + ": " + row.reference,
      "C3 Requests",
      C3_REQUESTS_CONFIG.progressToastSeconds
    );

    try {
      var writeCounts = syncC3Row_(context.sheet, context.columns, row);
      statusWrites += writeCounts.statusWrites;
      serviceWrites += writeCounts.serviceWrites;
      addressWrites += writeCounts.addressWrites;
      updatedCells += writeCounts.updatedCells;
    } catch (error) {
      errors.push(
        "Row " +
          row.rowNumber +
          " (" +
          row.reference +
          "): " +
          (error && error.message ? error.message : String(error))
      );
    }

    if (i < pendingRows.length - 1 && C3_REQUESTS_CONFIG.delayMs > 0) {
      Utilities.sleep(C3_REQUESTS_CONFIG.delayMs);
    }
  }

  if (errors.length > 0) {
    console.log(errors.join("\n"));
  }

  var summaryText =
    "Sync complete. Checked " +
    pendingRows.length +
    " row(s); updated " +
    updatedCells +
    " cell(s). " +
    "Status: " +
    statusWrites +
    ", service: " +
    serviceWrites +
    ", address: " +
    addressWrites +
    ", errors: " +
    errors.length +
    ".";
  context.spreadsheet.toast(
    summaryText,
    "C3 Requests",
    C3_REQUESTS_CONFIG.summaryToastSeconds
  );
}

function syncSelectedC3Request() {
  var context = getC3SheetContext_();
  if (!context) {
    return;
  }

  var activeSheet = context.spreadsheet.getActiveSheet();
  if (activeSheet.getName() !== C3_REQUESTS_CONFIG.sheetName) {
    context.spreadsheet.toast(
      'Select a row on "' + C3_REQUESTS_CONFIG.sheetName + '" first.',
      "C3 Requests",
      5
    );
    return;
  }

  var activeRange = activeSheet.getActiveRange();
  if (!activeRange) {
    context.spreadsheet.toast("Select a row first.", "C3 Requests", 5);
    return;
  }

  var rowNumber = activeRange.getRow();
  if (rowNumber <= C3_REQUESTS_CONFIG.headerRow) {
    context.spreadsheet.toast("Select a data row, not the header row.", "C3 Requests", 5);
    return;
  }

  var rowValues = activeSheet
    .getRange(rowNumber, 1, 1, context.lastColumn)
    .getValues()[0];
  var row = buildRowStateFromValues_(rowNumber, rowValues, context.columns);

  if (!row) {
    context.spreadsheet.toast(
      "The selected row does not have a valid reference_number.",
      "C3 Requests",
      5
    );
    return;
  }

  clearRowHighlights_(context.sheet, context.columns, row.rowNumber);
  context.spreadsheet.toast(
    "Checking selected row: " + row.reference,
    "C3 Requests",
    C3_REQUESTS_CONFIG.progressToastSeconds
  );

  try {
    var writeCounts = syncC3Row_(context.sheet, context.columns, row);
    var summaryText =
      "Selected row complete. Updated " +
      writeCounts.updatedCells +
      " cell(s). Status: " +
      writeCounts.statusWrites +
      ", service: " +
      writeCounts.serviceWrites +
      ", address: " +
      writeCounts.addressWrites +
      ".";
    context.spreadsheet.toast(
      summaryText,
      "C3 Requests",
      C3_REQUESTS_CONFIG.summaryToastSeconds
    );
  } catch (error) {
    context.spreadsheet.toast(
      "Selected row failed: " +
        (error && error.message ? error.message : String(error)),
      "C3 Requests",
      C3_REQUESTS_CONFIG.summaryToastSeconds
    );
  }
}

function syncC3Row_(sheet, columns, row) {
  var result = fetchC3RequestWithRetries_(row.reference);
  if (!result.found) {
    throw new Error("No matching request found");
  }

  var statusWrites = 0;
  var serviceWrites = 0;
  var addressWrites = 0;
  var updatedCells = 0;
  var rowChanged = false;

  if (result.requestStatus && result.requestStatus !== row.currentStatus) {
    writeUpdatedCell_(
      sheet,
      row.rowNumber,
      columns.requestStatus + 1,
      result.requestStatus
    );
    row.currentStatus = result.requestStatus;
    statusWrites += 1;
    updatedCells += 1;
    rowChanged = true;
  }

  if (result.service && result.service !== row.currentService) {
    writeUpdatedCell_(
      sheet,
      row.rowNumber,
      columns.service + 1,
      result.service
    );
    row.currentService = result.service;
    serviceWrites += 1;
    updatedCells += 1;
    rowChanged = true;
  }

  if (result.address && result.address !== row.currentAddress) {
    writeUpdatedCell_(
      sheet,
      row.rowNumber,
      columns.address + 1,
      result.address
    );
    row.currentAddress = result.address;
    addressWrites += 1;
    updatedCells += 1;
    rowChanged = true;
  }

  if (rowChanged) {
    SpreadsheetApp.flush();
  }

  return {
    statusWrites: statusWrites,
    serviceWrites: serviceWrites,
    addressWrites: addressWrites,
    updatedCells: updatedCells
  };
}

function fetchC3RequestWithRetries_(reference) {
  var lastError;

  for (var attempt = 0; attempt <= C3_REQUESTS_CONFIG.retries; attempt += 1) {
    try {
      return fetchC3Request_(reference);
    } catch (error) {
      lastError = error;

      if (attempt >= C3_REQUESTS_CONFIG.retries || !isRetryableError_(error)) {
        throw error;
      }

      Utilities.sleep(C3_REQUESTS_CONFIG.delayMs * (attempt + 1));
    }
  }

  throw lastError || new Error("Unexpected retry exhaustion");
}

function fetchC3Request_(reference) {
  var response = UrlFetchApp.fetch(buildC3RequestUrl_(reference), {
    method: "get",
    muteHttpExceptions: true,
    headers: {
      Accept: "application/json",
      "Accept-Language": "en-US",
      Cookie: "sap-usercontext=sap-language=EN&sap-client=050",
      Origin: "https://eservices1.capetown.gov.za",
      Referer: C3_SEARCH_REFERER,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
      "X-Requested-With": "XMLHttpRequest"
    }
  });

  var statusCode = response.getResponseCode();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error("HTTP " + statusCode + ": " + response.getContentText());
  }

  var payload = JSON.parse(response.getContentText());
  return mapC3Response_(reference, payload);
}

function buildC3RequestUrl_(reference) {
  var encodedKey = encodeURIComponent("'" + reference + "'");
  return (
    C3_SERVICE_ROOT +
    "/ServiceNotifications(" +
    encodedKey +
    ")?$format=json&sap-client=050"
  );
}

function mapC3Response_(reference, payload) {
  var data = payload && payload.d ? payload.d : {};
  var service = normalizeText_(data.Description);
  var address = normalizeText_(data.Address);
  var requestStatus = normalizeText_(data.Status);
  var dateLogged = normalizeText_(data.NotifDate);
  var found = Boolean(service || address || requestStatus || dateLogged);

  return {
    reference: reference,
    service: service,
    address: address,
    requestStatus: requestStatus,
    dateLogged: dateLogged,
    found: found
  };
}

function getC3SheetContext_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(C3_REQUESTS_CONFIG.sheetName);
  var headerIndex = C3_REQUESTS_CONFIG.headerRow - 1;
  var firstDataRowIndex = C3_REQUESTS_CONFIG.headerRow;

  if (!sheet) {
    spreadsheet.toast(
      'Sheet "' + C3_REQUESTS_CONFIG.sheetName + '" was not found.',
      "C3 Requests",
      5
    );
    return null;
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= C3_REQUESTS_CONFIG.headerRow) {
    spreadsheet.toast("No data rows found on the c3_requests sheet.", "C3 Requests", 5);
    return null;
  }

  var headerMap = getHeaderMap_(data[headerIndex]);
  var columns = resolveColumns_(headerMap);

  return {
    spreadsheet: spreadsheet,
    sheet: sheet,
    data: data,
    columns: columns,
    rowCount: data.length - C3_REQUESTS_CONFIG.headerRow,
    firstDataRowIndex: firstDataRowIndex,
    firstSheetRow: C3_REQUESTS_CONFIG.headerRow + 1,
    lastColumn: data[0].length
  };
}

function buildRowStateFromValues_(rowNumber, rowValues, columns) {
  var reference = normalizeReference_(rowValues[columns.reference]);
  if (!reference) {
    return null;
  }

  return {
    rowNumber: rowNumber,
    reference: reference,
    currentStatus: normalizeText_(rowValues[columns.requestStatus]),
    currentResolved: rowValues[columns.resolved],
    currentService: normalizeText_(rowValues[columns.service]),
    currentAddress: normalizeText_(rowValues[columns.address])
  };
}

function getHeaderMap_(headerRow) {
  var map = {};

  headerRow.forEach(function(header, index) {
    map[normalizeHeader_(header)] = index;
  });

  return map;
}

function clearSyncHighlights_(sheet, columns, rowCount, firstSheetRow) {
  sheet
    .getRange(firstSheetRow, columns.requestStatus + 1, rowCount, 1)
    .setBackground(null);
  sheet
    .getRange(firstSheetRow, columns.service + 1, rowCount, 1)
    .setBackground(null);
  sheet
    .getRange(firstSheetRow, columns.address + 1, rowCount, 1)
    .setBackground(null);
}

function clearRowHighlights_(sheet, columns, rowNumber) {
  sheet.getRange(rowNumber, columns.requestStatus + 1).setBackground(null);
  sheet.getRange(rowNumber, columns.service + 1).setBackground(null);
  sheet.getRange(rowNumber, columns.address + 1).setBackground(null);
}

function writeUpdatedCell_(sheet, rowNumber, columnNumber, value) {
  sheet
    .getRange(rowNumber, columnNumber)
    .setValue(value)
    .setBackground(C3_REQUESTS_CONFIG.highlightColor);
}

function resolveColumns_(headerMap) {
  return {
    reference: getColumnIndex_(headerMap, C3_REQUESTS_CONFIG.referenceHeader, 1),
    requestStatus: getColumnIndex_(
      headerMap,
      C3_REQUESTS_CONFIG.requestStatusHeader,
      3
    ),
    resolved: getColumnIndex_(headerMap, C3_REQUESTS_CONFIG.resolvedHeader, 4),
    service: getColumnIndex_(headerMap, C3_REQUESTS_CONFIG.serviceHeader, 6),
    address: getColumnIndex_(headerMap, C3_REQUESTS_CONFIG.addressHeader, 7)
  };
}

function getColumnIndex_(headerMap, headerName, fallbackIndex) {
  var normalizedHeader = normalizeHeader_(headerName);

  if (Object.prototype.hasOwnProperty.call(headerMap, normalizedHeader)) {
    return headerMap[normalizedHeader];
  }

  return fallbackIndex;
}

function normalizeHeader_(value) {
  return normalizeText_(value).toLowerCase();
}

function normalizeReference_(value) {
  var text = normalizeText_(value).replace(/\.0+$/, "");
  return /^\d+$/.test(text) ? text : "";
}

function normalizeText_(value) {
  return String(value == null ? "" : value)
    .replace(/\s+/g, " ")
    .trim();
}

function isFinalStatus_(status) {
  return C3_REQUESTS_CONFIG.finalStatuses.indexOf(normalizeText_(status).toLowerCase()) !== -1;
}

function isRetryableError_(error) {
  var message = error && error.message ? error.message : String(error);
  return /HTTP 429|HTTP 5\d\d|Exception: Request failed/i.test(message);
}
