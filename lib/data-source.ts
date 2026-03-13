import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildC3RequestInsights,
  normalizeC3RequestRows,
  type C3RequestInsights
} from "@/lib/c3-requests";
import { parseCsv } from "@/lib/csv";
import { fetchSheetRows, readGoogleSheetsEnv } from "@/lib/google-sheets";
import { c3RequestRowsSchema, incidentRowsSchema } from "@/lib/schemas";
import { parseSectionMatrix } from "@/lib/section-matrix";
import {
  MATRIX_SECTION_KEYS,
  type C3RequestRow,
  type IncidentRow,
  type MatrixSectionKey,
  type SectionData,
  type SectionMap
} from "@/types/dashboard";

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

  const headers = rows[0].map((header) => String(header).replace(/^\uFEFF/, "").trim());
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

function matrixSectionEntriesToMap(
  entries: Array<readonly [MatrixSectionKey, SectionData]>
): Record<MatrixSectionKey, SectionData> {
  return Object.fromEntries(entries) as Record<MatrixSectionKey, SectionData>;
}

function attachC3Section(
  baseSections: Record<MatrixSectionKey, SectionData>,
  c3Rows: C3RequestRow[]
): { sections: SectionMap; c3Insights: C3RequestInsights; c3Requests: C3RequestRow[] } {
  const normalizedC3Rows = normalizeC3RequestRows(c3Rows);
  const c3Insights = buildC3RequestInsights(normalizedC3Rows, Object.values(baseSections));
  return {
    sections: {
      ...baseSections,
      c3_requests: c3Insights.loggedSection
    },
    c3Insights,
    c3Requests: normalizedC3Rows
  };
}

async function readC3RequestsFromSheets(): Promise<C3RequestRow[]> {
  const rows = await fetchSheetRows("c3_requests!A1:AZ5000");
  return c3RequestRowsSchema.parse(rowsToObjects(rows));
}

async function readC3RequestsFromLocalCsv(): Promise<C3RequestRow[]> {
  const rows = await readLocalCsv("data/csv/sections/c3_requests.csv");
  return c3RequestRowsSchema.parse(rows);
}

async function readSectionsFromSheets(): Promise<{
  sections: SectionMap;
  c3Insights: C3RequestInsights;
  c3Requests: C3RequestRow[];
}> {
  const sectionEntries = await Promise.all(
    MATRIX_SECTION_KEYS.map(async (sectionKey) => {
      const rows = await fetchSheetRows(`${sectionKey}!A1:ZZ5000`);
      return [sectionKey, parseSectionMatrix(rows, sectionKey)] as const;
    })
  );
  const baseSections = matrixSectionEntriesToMap(sectionEntries);
  const c3Rows = await readC3RequestsFromSheets();

  return attachC3Section(baseSections, c3Rows);
}

async function readSectionsFromLocalCsv(): Promise<{
  sections: SectionMap;
  c3Insights: C3RequestInsights;
  c3Requests: C3RequestRow[];
}> {
  const sectionEntries = await Promise.all(
    MATRIX_SECTION_KEYS.map(async (sectionKey) => {
      const rows = await readLocalCsvRows(`data/csv/sections/${sectionKey}.csv`);
      return [sectionKey, parseSectionMatrix(rows, sectionKey)] as const;
    })
  );
  const baseSections = matrixSectionEntriesToMap(sectionEntries);
  const c3Rows = await readC3RequestsFromLocalCsv();

  return attachC3Section(baseSections, c3Rows);
}

async function readFromSheets(): Promise<{
  sections: SectionMap;
  incidents: IncidentRow[];
  c3Insights: C3RequestInsights;
  c3Requests: C3RequestRow[];
}> {
  const { sections, c3Insights, c3Requests } = await readSectionsFromSheets();
  const incidentRows = await fetchSheetRows("incidents!A1:AZ5000");
  const incidentObjects = rowsToObjects(incidentRows);

  return {
    sections,
    incidents: incidentRowsSchema.parse(incidentObjects),
    c3Insights,
    c3Requests
  };
}

async function readFromLocalCsv(): Promise<{
  sections: SectionMap;
  incidents: IncidentRow[];
  c3Insights: C3RequestInsights;
  c3Requests: C3RequestRow[];
}> {
  const { sections, c3Insights, c3Requests } = await readSectionsFromLocalCsv();
  const incidentObjects = await readLocalCsv("data/csv/incidents.csv");

  return {
    sections,
    incidents: incidentRowsSchema.parse(incidentObjects),
    c3Insights,
    c3Requests
  };
}

export async function loadData(): Promise<{
  sections: SectionMap;
  incidents: IncidentRow[];
  c3Insights: C3RequestInsights;
  c3Requests: C3RequestRow[];
  source: "google_sheets" | "local_csv";
}> {
  const mode = getDataSourceMode();

  if (mode === "google_sheets") {
    const hasSheetsConfig = readGoogleSheetsEnv() !== null;
    if (!hasSheetsConfig) {
      throw new Error(
        "DATA_SOURCE is set to google_sheets, but the Google Sheets authentication environment variables are incomplete."
      );
    }

    const fromSheets = await readFromSheets();
    return {
      ...fromSheets,
      source: "google_sheets"
    };
  }

  const fromLocal = await readFromLocalCsv();
  return {
    ...fromLocal,
    source: "local_csv"
  };
}
