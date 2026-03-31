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
    .addItem("Sync Selected Rows", "syncSelectedC3Request")
    .addSeparator()
    .addItem("Clear Green Highlights", "clearAllC3Highlights")
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

  var updatedReferences = [];
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
      if (writeCounts.updatedCells > 0) {
        updatedReferences.push(row.reference);
      }
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
    updatedReferences.length +
    " request(s): " +
    formatUpdatedReferences_(updatedReferences);
  SpreadsheetApp.getUi().alert(summaryText);
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

  var selectedRowNumbers = getSelectedRowNumbers_(activeSheet);
  if (selectedRowNumbers.length === 0) {
    context.spreadsheet.toast("Select one or more rows first.", "C3 Requests", 5);
    return;
  }

  var selectedRows = [];
  var skippedHeaderRows = [];
  var skippedInvalidRows = [];

  for (var i = 0; i < selectedRowNumbers.length; i += 1) {
    var rowNumber = selectedRowNumbers[i];

    if (rowNumber <= C3_REQUESTS_CONFIG.headerRow) {
      skippedHeaderRows.push(rowNumber);
      continue;
    }

    var rowValues = activeSheet
      .getRange(rowNumber, 1, 1, context.lastColumn)
      .getValues()[0];
    var row = buildRowStateFromValues_(rowNumber, rowValues, context.columns);

    if (!row) {
      skippedInvalidRows.push(rowNumber);
      continue;
    }

    selectedRows.push(row);
  }

  if (selectedRows.length === 0) {
    context.spreadsheet.toast(
      "None of the selected rows have a valid reference_number.",
      "C3 Requests",
      5
    );
    return;
  }

  var updatedReferences = [];
  var errors = [];

  for (var selectedIndex = 0; selectedIndex < selectedRows.length; selectedIndex += 1) {
    var selectedRow = selectedRows[selectedIndex];
    clearRowHighlights_(context.sheet, context.columns, selectedRow.rowNumber);
    context.spreadsheet.toast(
      "Checking " +
        (selectedIndex + 1) +
        "/" +
        selectedRows.length +
        ": " +
        selectedRow.reference,
      "C3 Requests",
      C3_REQUESTS_CONFIG.progressToastSeconds
    );

    try {
      var writeCounts = syncC3Row_(context.sheet, context.columns, selectedRow);
      if (writeCounts.updatedCells > 0) {
        updatedReferences.push(selectedRow.reference);
      }
    } catch (error) {
      errors.push(
        "Row " +
          selectedRow.rowNumber +
          " (" +
          selectedRow.reference +
          "): " +
          (error && error.message ? error.message : String(error))
      );
    }

    if (
      selectedIndex < selectedRows.length - 1 &&
      C3_REQUESTS_CONFIG.delayMs > 0
    ) {
      Utilities.sleep(C3_REQUESTS_CONFIG.delayMs);
    }
  }

  if (errors.length > 0) {
    console.log(errors.join("\n"));
  }

  var summaryText =
    "Selected rows complete. Checked " +
    selectedRows.length +
    " row(s); updated " +
    updatedReferences.length +
    " request(s): " +
    formatUpdatedReferences_(updatedReferences);

  if (skippedHeaderRows.length > 0) {
    summaryText += "\nSkipped header row(s): " + skippedHeaderRows.join(", ");
  }

  if (skippedInvalidRows.length > 0) {
    summaryText +=
      "\nSkipped row(s) without a valid reference_number: " +
      skippedInvalidRows.join(", ");
  }

  if (errors.length > 0) {
    summaryText += "\nFailed row(s): " + errors.join("; ");
  }

  SpreadsheetApp.getUi().alert(summaryText);
}

function getSelectedRowNumbers_(sheet) {
  var activeRangeList = sheet.getActiveRangeList();
  var ranges = activeRangeList ? activeRangeList.getRanges() : [];
  var rowNumbersByKey = {};
  var rowNumbers = [];

  if (ranges.length === 0) {
    var activeRange = sheet.getActiveRange();
    if (!activeRange) {
      return rowNumbers;
    }
    ranges = [activeRange];
  }

  for (var rangeIndex = 0; rangeIndex < ranges.length; rangeIndex += 1) {
    var range = ranges[rangeIndex];
    var startRow = range.getRow();
    var endRow = startRow + range.getNumRows() - 1;

    for (var rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
      var key = String(rowNumber);
      if (!rowNumbersByKey[key]) {
        rowNumbersByKey[key] = true;
        rowNumbers.push(rowNumber);
      }
    }
  }

  rowNumbers.sort(function(a, b) {
    return a - b;
  });

  return rowNumbers;
}

function clearAllC3Highlights() {
  var context = getC3SheetContext_();
  if (!context) {
    return;
  }

  var dataRange = context.sheet.getDataRange();
  var clearedCells = clearHighlightColorInRange_(dataRange);

  context.spreadsheet.toast(
    "Cleared " + clearedCells + " green highlight cell(s).",
    "C3 Requests",
    5
  );
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
    updatedCells: updatedCells,
    latestRequestStatus: row.currentStatus
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

function clearRowHighlights_(sheet, columns, rowNumber) {
  clearHighlightColorInRange_(sheet.getRange(rowNumber, columns.requestStatus + 1));
  clearHighlightColorInRange_(sheet.getRange(rowNumber, columns.service + 1));
  clearHighlightColorInRange_(sheet.getRange(rowNumber, columns.address + 1));
}

function writeUpdatedCell_(sheet, rowNumber, columnNumber, value) {
  sheet
    .getRange(rowNumber, columnNumber)
    .setValue(value)
    .setBackground(C3_REQUESTS_CONFIG.highlightColor);
}

function clearHighlightColorInRange_(range) {
  var backgrounds = range.getBackgrounds();
  var sheet = range.getSheet();
  var startRow = range.getRow();
  var startColumn = range.getColumn();
  var highlightColor = C3_REQUESTS_CONFIG.highlightColor.toLowerCase();
  var clearedCells = 0;
  var highlightedCells = [];

  for (var rowIndex = 0; rowIndex < backgrounds.length; rowIndex += 1) {
    for (
      var columnIndex = 0;
      columnIndex < backgrounds[rowIndex].length;
      columnIndex += 1
    ) {
      var currentColor = normalizeBackgroundColor_(
        backgrounds[rowIndex][columnIndex]
      );
      if (currentColor === highlightColor) {
        highlightedCells.push(
          buildCellA1Notation_(
            startRow + rowIndex,
            startColumn + columnIndex
          )
        );
        clearedCells += 1;
      }
    }
  }

  if (highlightedCells.length > 0) {
    sheet.getRangeList(highlightedCells).setBackground(null);
  }

  return clearedCells;
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

function normalizeBackgroundColor_(value) {
  return String(value == null ? "" : value).toLowerCase();
}

function formatUpdatedReferences_(references) {
  return references.length > 0 ? references.join(", ") : "none";
}

function buildCellA1Notation_(rowNumber, columnNumber) {
  return toColumnLetter_(columnNumber) + rowNumber;
}

function toColumnLetter_(columnNumber) {
  var dividend = columnNumber;
  var columnLabel = "";

  while (dividend > 0) {
    var modulo = (dividend - 1) % 26;
    columnLabel = String.fromCharCode(65 + modulo) + columnLabel;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return columnLabel;
}

function isFinalStatus_(status) {
  return C3_REQUESTS_CONFIG.finalStatuses.indexOf(normalizeText_(status).toLowerCase()) !== -1;
}

function isRetryableError_(error) {
  var message = error && error.message ? error.message : String(error);
  return /HTTP 429|HTTP 5\d\d|Exception: Request failed/i.test(message);
}
