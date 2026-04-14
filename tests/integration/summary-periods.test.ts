import { addDays, format, parseISO } from "date-fns";
import { describe, expect, it } from "vitest";
import { buildSummaryData } from "@/lib/summary-periods";
import type { HardcodedWeeklyMetrics, WeeklyMetricRow } from "@/types/dashboard";

const EMPTY_METRICS: HardcodedWeeklyMetrics = {
  general_incidents_total: null,
  criminal_incidents: null,
  arrests_made: null,
  section56_notices: null,
  section341_notices: null,
  proactive_actions: null,
  public_space_interventions: null,
  cleaning_bags_collected: null,
  cleaning_servitudes_cleaned: null,
  cleaning_stormwater_drains_cleaned: null,
  cleaning_stormwater_bags_filled: null,
  social_touch_points: null,
  parks_total_bags: null,
  parks_pruned_trees: null,
  c3_logged_total: null,
  calls_received: null,
  whatsapps_received: null
};

function isoDay(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function buildWeeklyRows(startIso: string, count: number, c3LoggedTotal: number): WeeklyMetricRow[] {
  return Array.from({ length: count }, (_, index) => {
    const weekStart = addDays(parseISO(startIso), index * 7);

    return {
      week_start: isoDay(weekStart),
      week_end: isoDay(addDays(weekStart, 6)),
      week_label: isoDay(weekStart),
      record_status: "REPORTED",
      metrics: {
        ...EMPTY_METRICS,
        c3_logged_total: c3LoggedTotal
      }
    };
  });
}

describe("summary period comparisons", () => {
  it("uses the same quarter and calendar-year slice from the previous year", () => {
    const rows = [
      ...buildWeeklyRows("2025-01-06", 13, 1),
      ...buildWeeklyRows("2025-10-06", 13, 100),
      ...buildWeeklyRows("2026-01-05", 9, 10)
    ];

    const summary = buildSummaryData(rows, "2026-02-23");

    expect(summary.periods.quarter.current.coverage_label).toBe("05 Jan 2026 to 08 Mar 2026");
    expect(summary.periods.quarter.previous.label).toBe("Jan to Mar 2025");
    expect(summary.periods.quarter.previous.coverage_label).toBe("06 Jan 2025 to 09 Mar 2025");
    expect(summary.periods.quarter.previous.metrics.c3_logged_total).toBe(9);
    expect(summary.periods.quarter.comparison_text).toBe("Compared with Jan to Mar 2025.");

    expect(summary.periods.calendar_year.previous.label).toBe("Calendar Year 2025");
    expect(summary.periods.calendar_year.previous.coverage_label).toBe("06 Jan 2025 to 09 Mar 2025");
    expect(summary.periods.calendar_year.previous.metrics.c3_logged_total).toBe(9);
    expect(summary.periods.calendar_year.comparison_text).toBe("Compared with Calendar Year 2025.");
  });

  it("uses the same financial-year slice from the previous year", () => {
    const rows = [
      ...buildWeeklyRows("2024-07-01", 52, 1),
      ...buildWeeklyRows("2025-07-07", 35, 10)
    ];

    const summary = buildSummaryData(rows, "2026-02-23");

    expect(summary.periods.financial_year.current.coverage_label).toBe("07 Jul 2025 to 08 Mar 2026");
    expect(summary.periods.financial_year.previous.label).toBe("Financial Year 2024/25");
    expect(summary.periods.financial_year.previous.coverage_label).toBe("08 Jul 2024 to 09 Mar 2025");
    expect(summary.periods.financial_year.previous.metrics.c3_logged_total).toBe(35);
    expect(summary.periods.financial_year.comparison_text).toBe("Compared with Financial Year 2024/25.");
  });
});
