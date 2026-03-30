import { unstable_cache } from "next/cache";
import { weekEndFromStart } from "@/lib/date-utils";
import {
  buildTrendSeries,
  buildWeeklyRows,
  deriveHotspots,
  deriveWeeks,
  pickCurrentWeek,
  sortWeekly
} from "@/lib/derive";
import { loadData } from "@/lib/data-source";
import type { DashboardQuery, DashboardResponse, IncidentRow, WeeklyMetricRow } from "@/types/dashboard";

const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DASHBOARD_DATA_CACHE_TAG = "dashboard-data";
const DASHBOARD_DATA_CACHE_REVALIDATE_SECONDS = 300;

function isIsoDay(value: string): boolean {
  return ISO_DAY_PATTERN.test(value);
}

function minIso(values: string[]): string {
  return values.reduce((min, value) => (value < min ? value : min));
}

function maxIso(values: string[]): string {
  return values.reduce((max, value) => (value > max ? value : max));
}

function deriveReportingWindow(publishedWeeks: string[]): { start: string; end: string } {
  const publishedWeekStarts = publishedWeeks.filter(isIsoDay);
  if (publishedWeekStarts.length) {
    const start = minIso(publishedWeekStarts);
    const end = weekEndFromStart(maxIso(publishedWeekStarts));
    return { start, end };
  }
  throw new Error('Missing published weeks. Add at least one row to the "published_weeks" sheet/tab/csv.');
}

function deriveDataUpdatedAt(weeklyRows: WeeklyMetricRow[], reportingWindowEnd: string): string {
  const reportedWeekEnds = weeklyRows
    .filter((row) => row.record_status === "REPORTED")
    .map((row) => row.week_end)
    .filter(isIsoDay);

  if (!reportedWeekEnds.length) {
    return reportingWindowEnd;
  }

  return maxIso(reportedWeekEnds);
}

function inWindow(weekStart: string, start: string, end: string): boolean {
  if (!isIsoDay(weekStart)) {
    return false;
  }
  return weekStart >= start && weekStart <= end;
}

function filterIncidentsByWindow(incidents: IncidentRow[], start: string, end: string): IncidentRow[] {
  return incidents.filter((incident) => inWindow(incident.week_start, start, end));
}

function filterToPublishedWeeks<T extends { week_start: string }>(rows: T[], publishedWeeks: string[]): T[] {
  const publishedWeekSet = new Set(publishedWeeks);
  return rows.filter((row) => publishedWeekSet.has(row.week_start));
}

const loadDashboardSourceData = unstable_cache(
  async (preview: string | undefined) =>
    loadData({
      preview
    }),
  ["dashboard-source-data"],
  {
    revalidate: DASHBOARD_DATA_CACHE_REVALIDATE_SECONDS,
    tags: [DASHBOARD_DATA_CACHE_TAG]
  }
);

function shouldUseDashboardCache(): boolean {
  return process.env.NODE_ENV !== "test";
}

async function loadDashboardData(query: DashboardQuery): ReturnType<typeof loadData> {
  if (!shouldUseDashboardCache()) {
    return loadData({
      preview: query.preview
    });
  }

  if (query.preview) {
    return loadData({
      preview: query.preview
    });
  }

  return loadDashboardSourceData(query.preview);
}

function buildDashboardResponse(
  sourceData: Awaited<ReturnType<typeof loadData>>,
  query: DashboardQuery = {}
): DashboardResponse {
  const { sections, incidents, c3Insights, c3Requests, publishedWeeks, source } = sourceData;
  const weeks = deriveWeeks(sections);
  const weekly = buildWeeklyRows(weeks, sections);
  const reportingWindow = deriveReportingWindow(publishedWeeks);
  const weeklyWindowed = sortWeekly(filterToPublishedWeeks(weekly, publishedWeeks));
  const weeksWindowed = filterToPublishedWeeks(weeks, publishedWeeks);
  const incidentsWindowed = filterIncidentsByWindow(incidents, reportingWindow.start, reportingWindow.end);
  const dataUpdatedAt = deriveDataUpdatedAt(weeklyWindowed, reportingWindow.end);

  const currentWeek = pickCurrentWeek(weeklyWindowed, query);
  const selectedWeekStart = currentWeek?.week_start ?? weeklyWindowed.at(-1)?.week_start ?? reportingWindow.start;
  const windowWeeks = Number.isFinite(query.windowWeeks) ? Number(query.windowWeeks) : undefined;

  return {
    meta: {
      generated_at: new Date().toISOString(),
      reporting_window_start: reportingWindow.start,
      reporting_window_end: reportingWindow.end,
      data_updated_at: dataUpdatedAt,
      selected_week_start: selectedWeekStart,
      available_weeks: weeklyWindowed.map((row) => row.week_start),
      data_source: source
    },
    weeks: weeksWindowed,
    sections,
    weekly: weeklyWindowed,
    current_week: currentWeek,
    trends: buildTrendSeries(weeklyWindowed),
    c3_tracker_totals: c3Insights.trackerTotals,
    c3_tracker_breakdown: c3Insights.trackerBreakdown,
    c3_request_rows: c3Requests,
    hotspots: deriveHotspots(incidentsWindowed, weeklyWindowed, windowWeeks),
    incidents: incidentsWindowed
  };
}

export async function getDashboardData(query: DashboardQuery = {}): Promise<DashboardResponse> {
  const sourceData = await loadDashboardData(query);
  return buildDashboardResponse(sourceData, query);
}
