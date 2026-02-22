import { isAfter, isBefore, parseISO } from "date-fns";
import { HOTSPOT_DEFAULT_WEEKS, REPORTING_WINDOW_END, REPORTING_WINDOW_START } from "@/lib/config";
import { buildTrendSeries, deriveC3Breakdown, deriveC3Totals, deriveHotspots, pickCurrentWeek, sortWeekly } from "@/lib/derive";
import { loadData } from "@/lib/data-source";
import type { DashboardQuery, DashboardResponse, IncidentRow, WeeklyMetricRow } from "@/types/dashboard";

function inWindow(weekStart: string): boolean {
  const date = parseISO(weekStart);
  const min = parseISO(REPORTING_WINDOW_START);
  const max = parseISO(REPORTING_WINDOW_END);
  return !isBefore(date, min) && !isAfter(date, max);
}

function filterByWindow(rows: WeeklyMetricRow[]): WeeklyMetricRow[] {
  return rows.filter((row) => inWindow(row.week_start));
}

function filterIncidentsByWindow(incidents: IncidentRow[]): IncidentRow[] {
  return incidents.filter((incident) => inWindow(incident.week_start));
}

export async function getDashboardData(query: DashboardQuery = {}): Promise<DashboardResponse> {
  const { weekly, incidents, source } = await loadData();
  const weeklyWindowed = sortWeekly(filterByWindow(weekly));
  const incidentsWindowed = filterIncidentsByWindow(incidents);

  const currentWeek = pickCurrentWeek(weeklyWindowed, query);
  const selectedWeekStart = currentWeek?.week_start ?? weeklyWindowed.at(-1)?.week_start ?? REPORTING_WINDOW_START;
  const windowWeeks = Number.isFinite(query.windowWeeks) ? Number(query.windowWeeks) : HOTSPOT_DEFAULT_WEEKS;

  return {
    meta: {
      generated_at: new Date().toISOString(),
      reporting_window_start: REPORTING_WINDOW_START,
      reporting_window_end: REPORTING_WINDOW_END,
      selected_week_start: selectedWeekStart,
      available_weeks: weeklyWindowed.map((row) => row.week_start),
      data_source: source
    },
    weekly: weeklyWindowed,
    current_week: currentWeek,
    trends: buildTrendSeries(weeklyWindowed),
    c3_totals: deriveC3Totals(currentWeek),
    c3_breakdown: deriveC3Breakdown(currentWeek),
    hotspots: deriveHotspots(incidentsWindowed, weeklyWindowed, windowWeeks),
    incidents: incidentsWindowed
  };
}
