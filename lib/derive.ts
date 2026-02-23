import { format } from "date-fns";
import { C3_DEPARTMENTS, C3_DEPARTMENT_LABELS } from "@/lib/config";
import { safeDate } from "@/lib/date-utils";
import { rankHotspots } from "@/lib/hotspots";
import type {
  C3BreakdownRow,
  C3Totals,
  DashboardQuery,
  DerivedTrendPoint,
  HotspotRow,
  IncidentRow,
  WeeklyMetricRow
} from "@/types/dashboard";

function toNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function sortWeekly(rows: WeeklyMetricRow[]): WeeklyMetricRow[] {
  return [...rows].sort((a, b) => a.week_start.localeCompare(b.week_start));
}

export function getReportedWeeks(rows: WeeklyMetricRow[]): WeeklyMetricRow[] {
  return rows.filter((row) => row.record_status === "REPORTED");
}

function movingAverage(values: Array<number | null>, index: number, windowSize = 4): number | null {
  const start = Math.max(0, index - windowSize + 1);
  const window = values.slice(start, index + 1).filter((value): value is number => value !== null);
  if (!window.length) {
    return null;
  }
  const sum = window.reduce((acc, value) => acc + value, 0);
  return Number((sum / window.length).toFixed(2));
}

export function buildTrendSeries(rows: WeeklyMetricRow[]): DerivedTrendPoint[] {
  const sorted = sortWeekly(rows);
  const urban = sorted.map((row) => (row.record_status === "REPORTED" ? toNumber(row.urban_total) : null));
  const crimes = sorted.map((row) => (row.record_status === "REPORTED" ? toNumber(row.criminal_incidents) : null));
  const cleaning = sorted.map((row) => (row.record_status === "REPORTED" ? toNumber(row.cleaning_bags_collected) : null));
  const contacts = sorted.map((row) => {
    if (row.record_status !== "REPORTED") {
      return null;
    }
    const calls = toNumber(row.calls_received);
    const whatsapps = toNumber(row.whatsapps_received);
    if (calls === null && whatsapps === null) {
      return null;
    }
    return (calls ?? 0) + (whatsapps ?? 0);
  });

  return sorted.map((row, index) => {
    const weekDate = safeDate(row.week_start);
    const weekLabel = weekDate ? format(weekDate, "dd MMM") : row.week_start;
    return {
      week_start: row.week_start,
      week_label: weekLabel,
      urban_total: urban[index],
      criminal_incidents: crimes[index],
      cleaning_bags_collected: cleaning[index],
      contacts_total: contacts[index],
      urban_ma4: movingAverage(urban, index, 4),
      criminal_ma4: movingAverage(crimes, index, 4),
      cleaning_ma4: movingAverage(cleaning, index, 4),
      contacts_total_ma4: movingAverage(contacts, index, 4)
    };
  });
}

export function deriveC3Totals(currentWeek: WeeklyMetricRow | null): C3Totals {
  const logged = currentWeek?.c3_logged_total ?? null;
  const resolved = currentWeek?.c3_resolved_total ?? null;
  let ratio: number | null = null;
  if (logged !== null && resolved !== null) {
    ratio = logged === 0 ? 0 : Number((resolved / logged).toFixed(2));
  }
  return {
    logged,
    resolved,
    resolution_ratio: ratio
  };
}

export function deriveC3Breakdown(currentWeek: WeeklyMetricRow | null): C3BreakdownRow[] {
  return C3_DEPARTMENTS.map((department) => {
    const loggedKey = `c3_logged_${department}` as const;
    const resolvedKey = `c3_resolved_${department}` as const;
    const logged = currentWeek ? (currentWeek[loggedKey] as number | null) : null;
    const resolved = currentWeek ? (currentWeek[resolvedKey] as number | null) : null;

    return {
      department: C3_DEPARTMENT_LABELS[department],
      logged,
      resolved
    };
  });
}

export function pickCurrentWeek(rows: WeeklyMetricRow[], query: DashboardQuery): WeeklyMetricRow | null {
  const sorted = sortWeekly(rows);
  if (!sorted.length) {
    return null;
  }

  if (query.weekStart) {
    const matched = sorted.find((row) => row.week_start === query.weekStart);
    if (matched) {
      return matched;
    }
  }

  const reported = getReportedWeeks(sorted);
  return reported.at(-1) ?? sorted.at(-1) ?? null;
}

function getLatestWeekStarts(rows: WeeklyMetricRow[], limit: number): Set<string> {
  return new Set(
    getReportedWeeks(sortWeekly(rows))
      .slice(-limit)
      .map((row) => row.week_start)
  );
}

export function deriveHotspots(
  incidents: IncidentRow[],
  weeklyRows: WeeklyMetricRow[],
  windowWeeks?: number
): HotspotRow[] {
  const validWindowWeeks = typeof windowWeeks === "number" && Number.isFinite(windowWeeks) ? Math.floor(windowWeeks) : 0;
  if (validWindowWeeks > 0) {
    const allowedWeekStarts = getLatestWeekStarts(weeklyRows, validWindowWeeks);
    const filtered = incidents.filter((incident) => allowedWeekStarts.has(incident.week_start));
    return rankHotspots(filtered);
  }

  return rankHotspots(incidents);
}
