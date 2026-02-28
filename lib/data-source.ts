import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseCsv } from "@/lib/csv";
import { fetchSheetRows, readGoogleSheetsEnv } from "@/lib/google-sheets";
import { incidentRowsSchema } from "@/lib/schemas";
import { parseSectionMatrix } from "@/lib/section-matrix";
import { SECTION_KEYS, type IncidentRow, type SectionData, type SectionMap } from "@/types/dashboard";

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
  const rows = await readLocalCsvRows(relativePath);
  return rowsToObjects(rows);
}

async function readLocalCsvRows(relativePath: string): Promise<string[][]> {
  const filePath = path.join(ROOT, relativePath);
  const raw = await readFile(filePath, "utf8");
  return parseCsv(raw);
}

function sectionEntriesToMap(entries: Array<readonly [SectionData["key"], SectionData]>): SectionMap {
  return Object.fromEntries(entries) as SectionMap;
}

async function readSectionsFromSheets(): Promise<SectionMap> {
  const sectionEntries = await Promise.all(
    SECTION_KEYS.map(async (sectionKey) => {
      const rows = await fetchSheetRows(`${sectionKey}!A1:ZZ5000`);
      return [sectionKey, parseSectionMatrix(rows, sectionKey)] as const;
    })
  );

  return sectionEntriesToMap(sectionEntries);
}

async function readSectionsFromLocalCsv(): Promise<SectionMap> {
  const sectionEntries = await Promise.all(
    SECTION_KEYS.map(async (sectionKey) => {
      const rows = await readLocalCsvRows(`data/csv/sections/${sectionKey}.csv`);
      return [sectionKey, parseSectionMatrix(rows, sectionKey)] as const;
    })
  );

  return sectionEntriesToMap(sectionEntries);
}

async function readFromSheets(): Promise<{ sections: SectionMap; incidents: IncidentRow[] }> {
  const sections = await readSectionsFromSheets();
  const incidentRows = await fetchSheetRows("incidents!A1:AZ5000");
  const incidentObjects = rowsToObjects(incidentRows);

  return {
    sections,
    incidents: incidentRowsSchema.parse(incidentObjects)
  };
}

async function readFromLocalCsv(): Promise<{ sections: SectionMap; incidents: IncidentRow[] }> {
  const sections = await readSectionsFromLocalCsv();
  const incidentObjects = await readLocalCsv("data/csv/incidents.csv");

  return {
    sections,
    incidents: incidentRowsSchema.parse(incidentObjects)
  };
}

export async function loadData(): Promise<{
  sections: SectionMap;
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
