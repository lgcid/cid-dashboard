import { weekEndFromStart } from "@/lib/date-utils";
import {
  buildTrendSeries,
  buildWeeklyRows,
  deriveC3Breakdown,
  deriveC3Totals,
  deriveHotspots,
  deriveWeeks,
  pickCurrentWeek,
  sortWeekly
} from "@/lib/derive";
import { loadData } from "@/lib/data-source";
import type { DashboardQuery, DashboardResponse, IncidentRow, WeekRecord, WeeklyMetricRow } from "@/types/dashboard";

const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDay(value: string): boolean {
  return ISO_DAY_PATTERN.test(value);
}

function todayUtcIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function minIso(values: string[]): string {
  return values.reduce((min, value) => (value < min ? value : min));
}

function maxIso(values: string[]): string {
  return values.reduce((max, value) => (value > max ? value : max));
}

function deriveReportingWindow(weeks: WeekRecord[], incidents: IncidentRow[]): { start: string; end: string } {
  const weeklyStarts = weeks.map((row) => row.week_start).filter(isIsoDay);
  const weeklyEnds = weeks.map((row) => row.week_end).filter(isIsoDay);

  if (weeklyStarts.length && weeklyEnds.length) {
    return {
      start: minIso(weeklyStarts),
      end: maxIso(weeklyEnds)
    };
  }

  const incidentStarts = incidents.map((incident) => incident.week_start).filter(isIsoDay);
  if (incidentStarts.length) {
    const start = minIso(incidentStarts);
    const end = weekEndFromStart(maxIso(incidentStarts));
    return { start, end };
  }

  const today = todayUtcIso();
  return { start: today, end: today };
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

function filterByWindow(rows: WeeklyMetricRow[], start: string, end: string): WeeklyMetricRow[] {
  return rows.filter((row) => inWindow(row.week_start, start, end));
}

function filterWeeksByWindow(weeks: WeekRecord[], start: string, end: string): WeekRecord[] {
  return weeks.filter((week) => inWindow(week.week_start, start, end));
}

function filterIncidentsByWindow(incidents: IncidentRow[], start: string, end: string): IncidentRow[] {
  return incidents.filter((incident) => inWindow(incident.week_start, start, end));
}

export async function getDashboardData(query: DashboardQuery = {}): Promise<DashboardResponse> {
  const { sections, incidents, source } = await loadData();
  const weeks = deriveWeeks(sections);
  const weekly = buildWeeklyRows(weeks, sections);
  const reportingWindow = deriveReportingWindow(weeks, incidents);
  const weeklyWindowed = sortWeekly(filterByWindow(weekly, reportingWindow.start, reportingWindow.end));
  const weeksWindowed = filterWeeksByWindow(weeks, reportingWindow.start, reportingWindow.end);
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
    c3_totals: deriveC3Totals(currentWeek),
    c3_breakdown: deriveC3Breakdown(currentWeek, sections),
    hotspots: deriveHotspots(incidentsWindowed, weeklyWindowed, windowWeeks),
    incidents: incidentsWindowed
  };
}
