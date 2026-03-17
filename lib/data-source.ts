import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildC3RequestInsights,
  normalizeC3RequestRows,
  type C3RequestInsights
} from "@/lib/c3-requests";
import { parseCsv } from "@/lib/csv";
import { isIsoDay, normalizeSheetDay, weekEndFromStart } from "@/lib/date-utils";
import { fetchSheetRows, readGoogleSheetsEnv } from "@/lib/google-sheets";
import { c3RequestRowsSchema, incidentRowsSchema, publishedWeekRowsSchema } from "@/lib/schemas";
import { validateDerivedMetricSections } from "@/lib/metric-labels";
import { WEEK_START_BASELINE } from "@/lib/section-matrix";
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
interface LoadDataOptions {
  preview?: string;
}

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

function normalizePublishedWeeks(rows: Array<{ week_start: string }>): string[] {
  const publishedWeeks = [...new Set(rows.map((row) => row.week_start).filter(isIsoDay))].sort((a, b) => a.localeCompare(b));
  if (!publishedWeeks.length) {
    throw new Error('Missing published weeks. Add at least one row to the "published_weeks" sheet/tab/csv.');
  }
  return publishedWeeks;
}

function collectMatrixWeekStarts(baseSections: Record<MatrixSectionKey, SectionData>): string[] {
  const weekStarts = new Set<string>([WEEK_START_BASELINE]);

  for (const section of Object.values(baseSections)) {
    for (const row of section.categories) {
      for (const weekStart of Object.keys(row.values)) {
        if (!isIsoDay(weekStart)) {
          continue;
        }
        if (weekStart < WEEK_START_BASELINE) {
          continue;
        }
        weekStarts.add(weekStart);
      }
    }
  }

  return [...weekStarts].sort((a, b) => a.localeCompare(b));
}

function resolvePreviewWeek(preview: string | undefined, matrixWeekStarts: string[]): string | null {
  const previewDay = normalizeSheetDay(preview);
  if (!previewDay) {
    return null;
  }

  for (const weekStart of matrixWeekStarts) {
    const weekEnd = weekEndFromStart(weekStart);
    if (previewDay >= weekStart && previewDay <= weekEnd) {
      return weekStart;
    }
  }

  return null;
}

function buildVisibleWeeks(publishedWeeks: string[], previewWeek: string | null): string[] {
  const visibleWeeks = new Set(publishedWeeks);
  if (previewWeek) {
    visibleWeeks.add(previewWeek);
  }
  return [...visibleWeeks].sort((a, b) => a.localeCompare(b));
}

async function readPublishedWeeksFromSheets(): Promise<string[]> {
  const rows = await fetchSheetRows("published_weeks!A1:A5000");
  return normalizePublishedWeeks(publishedWeekRowsSchema.parse(rowsToObjects(rows)));
}

async function readPublishedWeeksFromLocalCsv(): Promise<string[]> {
  const rows = await readLocalCsv("data/csv/published_weeks.csv");
  return normalizePublishedWeeks(publishedWeekRowsSchema.parse(rows));
}

function derivePublishedWindow(publishedWeeks: string[]): { start: string; end: string } {
  return {
    start: publishedWeeks[0],
    end: weekEndFromStart(publishedWeeks[publishedWeeks.length - 1])
  };
}

function isWithinWindow(date: string | null, start: string, end: string): boolean {
  if (!date || !isIsoDay(date)) {
    return false;
  }
  return date >= start && date <= end;
}

function filterIncidentsByPublishedWindow(
  incidents: IncidentRow[],
  publishedWindow: { start: string; end: string }
): IncidentRow[] {
  return incidents.filter((incident) => isWithinWindow(incident.week_start, publishedWindow.start, publishedWindow.end));
}

function filterC3RequestsByPublishedWindow(
  c3Rows: C3RequestRow[],
  publishedWindow: { start: string; end: string }
): C3RequestRow[] {
  return normalizeC3RequestRows(c3Rows).filter((row) =>
    isWithinWindow(row.date_logged, publishedWindow.start, publishedWindow.end)
  );
}

async function readMatrixSectionsFromSheets(): Promise<Record<MatrixSectionKey, SectionData>> {
  const sectionEntries = await Promise.all(
    MATRIX_SECTION_KEYS.map(async (sectionKey) => {
      const rows = await fetchSheetRows(`${sectionKey}!A1:ZZ5000`);
      return [sectionKey, parseSectionMatrix(rows, sectionKey)] as const;
    })
  );
  const baseSections = matrixSectionEntriesToMap(sectionEntries);
  validateDerivedMetricSections(baseSections);
  return baseSections;
}

async function readMatrixSectionsFromLocalCsv(): Promise<Record<MatrixSectionKey, SectionData>> {
  const sectionEntries = await Promise.all(
    MATRIX_SECTION_KEYS.map(async (sectionKey) => {
      const rows = await readLocalCsvRows(`data/csv/sections/${sectionKey}.csv`);
      return [sectionKey, parseSectionMatrix(rows, sectionKey)] as const;
    })
  );
  const baseSections = matrixSectionEntriesToMap(sectionEntries);
  validateDerivedMetricSections(baseSections);
  return baseSections;
}

async function readFromSheets(options: LoadDataOptions = {}): Promise<{
  sections: SectionMap;
  incidents: IncidentRow[];
  c3Insights: C3RequestInsights;
  c3Requests: C3RequestRow[];
  publishedWeeks: string[];
}> {
  const [baseSections, publishedWeeks, incidentRows, c3Rows] = await Promise.all([
    readMatrixSectionsFromSheets(),
    readPublishedWeeksFromSheets(),
    fetchSheetRows("incidents!A1:AZ5000"),
    readC3RequestsFromSheets()
  ]);
  const previewWeek = resolvePreviewWeek(options.preview, collectMatrixWeekStarts(baseSections));
  const visibleWeeks = buildVisibleWeeks(publishedWeeks, previewWeek);
  const publishedWindow = derivePublishedWindow(visibleWeeks);
  const { sections, c3Insights, c3Requests } = attachC3Section(
    baseSections,
    filterC3RequestsByPublishedWindow(c3Rows, publishedWindow)
  );
  const incidentObjects = rowsToObjects(incidentRows);

  return {
    sections,
    incidents: filterIncidentsByPublishedWindow(incidentRowsSchema.parse(incidentObjects), publishedWindow),
    c3Insights,
    c3Requests,
    publishedWeeks: visibleWeeks
  };
}

async function readFromLocalCsv(options: LoadDataOptions = {}): Promise<{
  sections: SectionMap;
  incidents: IncidentRow[];
  c3Insights: C3RequestInsights;
  c3Requests: C3RequestRow[];
  publishedWeeks: string[];
}> {
  const [baseSections, publishedWeeks, incidentObjects, c3Rows] = await Promise.all([
    readMatrixSectionsFromLocalCsv(),
    readPublishedWeeksFromLocalCsv(),
    readLocalCsv("data/csv/incidents.csv"),
    readC3RequestsFromLocalCsv()
  ]);
  const previewWeek = resolvePreviewWeek(options.preview, collectMatrixWeekStarts(baseSections));
  const visibleWeeks = buildVisibleWeeks(publishedWeeks, previewWeek);
  const publishedWindow = derivePublishedWindow(visibleWeeks);
  const { sections, c3Insights, c3Requests } = attachC3Section(
    baseSections,
    filterC3RequestsByPublishedWindow(c3Rows, publishedWindow)
  );

  return {
    sections,
    incidents: filterIncidentsByPublishedWindow(incidentRowsSchema.parse(incidentObjects), publishedWindow),
    c3Insights,
    c3Requests,
    publishedWeeks: visibleWeeks
  };
}

export async function loadData(options: LoadDataOptions = {}): Promise<{
  sections: SectionMap;
  incidents: IncidentRow[];
  c3Insights: C3RequestInsights;
  c3Requests: C3RequestRow[];
  publishedWeeks: string[];
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

    const fromSheets = await readFromSheets(options);
    return {
      ...fromSheets,
      source: "google_sheets"
    };
  }

  const fromLocal = await readFromLocalCsv(options);
  return {
    ...fromLocal,
    source: "local_csv"
  };
}
