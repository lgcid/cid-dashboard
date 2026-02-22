import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseCsv } from "@/lib/csv";
import { fetchSheetRows, readGoogleSheetsEnv } from "@/lib/google-sheets";
import { incidentRowsSchema, weeklyMetricRowsSchema } from "@/lib/schemas";
import type { IncidentRow, WeeklyMetricRow } from "@/types/dashboard";

const ROOT = process.cwd();
type DataSourceMode = "local_csv" | "google_sheets";

function getDataSourceMode(): DataSourceMode {
  const raw = process.env.DATA_SOURCE?.trim().toLowerCase();
  if (raw === "google_sheets") {
    return "google_sheets";
  }
  return "local_csv";
}

function rowsToObjects(rows: string[][]): Array<Record<string, string>> {
  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((header) => String(header).trim());
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] === undefined ? "" : String(row[index]);
    });
    return obj;
  });
}

async function readLocalCsv(relativePath: string): Promise<Array<Record<string, string>>> {
  const filePath = path.join(ROOT, relativePath);
  const raw = await readFile(filePath, "utf8");
  return rowsToObjects(parseCsv(raw));
}

async function readFromSheets(): Promise<{ weekly: WeeklyMetricRow[]; incidents: IncidentRow[] }> {
  const weeklyRows = await fetchSheetRows("weekly_metrics!A1:AZ1000");
  const incidentRows = await fetchSheetRows("incidents!A1:AZ5000");
  const weeklyObjects = rowsToObjects(weeklyRows);
  const incidentObjects = rowsToObjects(incidentRows);

  return {
    weekly: weeklyMetricRowsSchema.parse(weeklyObjects),
    incidents: incidentRowsSchema.parse(incidentObjects)
  };
}

async function readFromLocalCsv(): Promise<{ weekly: WeeklyMetricRow[]; incidents: IncidentRow[] }> {
  const weeklyObjects = await readLocalCsv("data/exports/weekly_metrics.csv");
  const incidentObjects = await readLocalCsv("data/exports/incidents.csv");

  return {
    weekly: weeklyMetricRowsSchema.parse(weeklyObjects),
    incidents: incidentRowsSchema.parse(incidentObjects)
  };
}

export async function loadData(): Promise<{
  weekly: WeeklyMetricRow[];
  incidents: IncidentRow[];
  source: "google_sheets" | "local_csv";
}> {
  const mode = getDataSourceMode();

  if (mode === "google_sheets") {
    const hasSheetsConfig = readGoogleSheetsEnv() !== null;
    if (!hasSheetsConfig) {
      throw new Error(
        "DATA_SOURCE is set to google_sheets but Sheets credentials are missing. Provide GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GOOGLE_SHEET_ID."
      );
    }

    try {
      const fromSheets = await readFromSheets();
      return {
        ...fromSheets,
        source: "google_sheets"
      };
    } catch (error) {
      console.warn("Falling back to local CSV data", error);
    }
  }

  const fromLocal = await readFromLocalCsv();
  return {
    ...fromLocal,
    source: "local_csv"
  };
}
