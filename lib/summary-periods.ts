import { addDays, addMonths, addYears, differenceInCalendarDays, format, parseISO, startOfMonth, startOfQuarter, startOfYear } from "date-fns";
import { formatWeekLabel } from "@/lib/date-utils";
import type {
  DashboardSummaryData,
  DashboardSummaryMetrics,
  DashboardSummaryPeriodData,
  SummaryPeriod,
  WeeklyMetricRow
} from "@/types/dashboard";

export const SUMMARY_PERIOD_OPTIONS: Array<{ id: SummaryPeriod; label: string }> = [
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
  { id: "quarter", label: "Quarterly" },
  { id: "calendar_year", label: "Calendar Year" },
  { id: "financial_year", label: "Financial Year" }
];

export type SummaryReportingOption = {
  value: string;
  label: string;
  year: string;
  start: string;
  end: string;
};

const SUMMARY_PERIOD_DEFAULT: SummaryPeriod = "week";
const FINANCIAL_YEAR_START_MONTH_INDEX = 6;
const EMPTY_SUMMARY_METRICS: DashboardSummaryMetrics = {
  criminal_incidents: null,
  arrests_made: null,
  proactive_actions: null,
  public_space_interventions: null,
  fines_issued: null,
  general_incidents_total: null,
  cleaning_total_bags: null,
  cleaning_servitudes_cleaned: null,
  cleaning_stormwater_drains_cleaned: null,
  social_touch_points: null,
  c3_logged_total: null,
  contacts_total: null,
  parks_total_bags: null,
  parks_pruned_trees: null
};

type SummaryWindow = {
  label: string;
  start: string;
  end: string;
};

type SummaryComparison = {
  window: SummaryWindow;
  rows: WeeklyMetricRow[];
};

function sortByWeekStart(rows: WeeklyMetricRow[]): WeeklyMetricRow[] {
  return [...rows].sort((left, right) => left.week_start.localeCompare(right.week_start));
}

function formatIsoDay(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function endFromStart(start: Date, months: number): string {
  return formatIsoDay(addDays(addMonths(start, months), -1));
}

function unavailableComparisonText(previousLabel: string): string {
  if (previousLabel === "Previous reporting week") {
    return "No comparison is available for the previous reporting week.";
  }

  return `No comparison is available for ${previousLabel}.`;
}

function previousPeriodComparisonText(previousLabel: string, hasRows: boolean): string {
  if (!hasRows) {
    return unavailableComparisonText(previousLabel);
  }
  return `Compared with ${previousLabel}.`;
}

function sumNullable(values: Array<number | null | undefined>): number | null {
  const numericValues = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!numericValues.length) {
    return null;
  }
  return numericValues.reduce((sum, value) => sum + value, 0);
}

function aggregateSummaryMetrics(rows: WeeklyMetricRow[]): DashboardSummaryMetrics {
  const reportedRows = rows.filter((row) => row.record_status === "REPORTED");
  if (!reportedRows.length) {
    return { ...EMPTY_SUMMARY_METRICS };
  }

  return {
    criminal_incidents: sumNullable(reportedRows.map((row) => row.metrics.criminal_incidents)),
    arrests_made: sumNullable(reportedRows.map((row) => row.metrics.arrests_made)),
    proactive_actions: sumNullable(reportedRows.map((row) => row.metrics.proactive_actions)),
    public_space_interventions: sumNullable(reportedRows.map((row) => row.metrics.public_space_interventions)),
    fines_issued: sumNullable(
      reportedRows.map((row) => {
        const section56 = row.metrics.section56_notices;
        const section341 = row.metrics.section341_notices;
        if (section56 === null && section341 === null) {
          return null;
        }
        return (section56 ?? 0) + (section341 ?? 0);
      })
    ),
    general_incidents_total: sumNullable(reportedRows.map((row) => row.metrics.general_incidents_total)),
    cleaning_total_bags: sumNullable(
      reportedRows.map((row) => {
        const cleaning = row.metrics.cleaning_bags_collected;
        const stormwater = row.metrics.cleaning_stormwater_bags_filled;
        if (cleaning === null && stormwater === null) {
          return null;
        }
        return (cleaning ?? 0) + (stormwater ?? 0);
      })
    ),
    cleaning_servitudes_cleaned: sumNullable(reportedRows.map((row) => row.metrics.cleaning_servitudes_cleaned)),
    cleaning_stormwater_drains_cleaned: sumNullable(reportedRows.map((row) => row.metrics.cleaning_stormwater_drains_cleaned)),
    social_touch_points: sumNullable(reportedRows.map((row) => row.metrics.social_touch_points)),
    c3_logged_total: sumNullable(reportedRows.map((row) => row.metrics.c3_logged_total)),
    contacts_total: sumNullable(
      reportedRows.map((row) => {
        const calls = row.metrics.calls_received;
        const whatsapps = row.metrics.whatsapps_received;
        if (calls === null && whatsapps === null) {
          return null;
        }
        return (calls ?? 0) + (whatsapps ?? 0);
      })
    ),
    parks_total_bags: sumNullable(reportedRows.map((row) => row.metrics.parks_total_bags)),
    parks_pruned_trees: sumNullable(reportedRows.map((row) => row.metrics.parks_pruned_trees))
  };
}

function buildCoverageLabel(rows: WeeklyMetricRow[]): string | null {
  if (!rows.length) {
    return null;
  }

  const firstRow = rows[0];
  const lastRow = rows.at(-1) ?? firstRow;
  return formatWeekLabel(firstRow.week_start, lastRow.week_end);
}

function rowsInWindow(rows: WeeklyMetricRow[], start: string, end: string): WeeklyMetricRow[] {
  return rows
    .filter((row) => row.record_status === "REPORTED" && row.week_start >= start && row.week_start <= end)
    .sort((left, right) => left.week_start.localeCompare(right.week_start));
}

function formatQuarterLabel(date: Date): string {
  const quarterStart = startOfQuarter(date);
  const quarterEnd = addDays(addMonths(quarterStart, 3), -1);
  return `${format(quarterStart, "MMM")} to ${format(quarterEnd, "MMM yyyy")}`;
}

function financialYearStart(anchor: Date): Date {
  const year = anchor.getFullYear();
  const startYear = anchor.getMonth() >= FINANCIAL_YEAR_START_MONTH_INDEX ? year : year - 1;
  return new Date(startYear, FINANCIAL_YEAR_START_MONTH_INDEX, 1);
}

function formatFinancialYearLabel(start: Date): string {
  const endYear = start.getFullYear() + 1;
  return `Financial Year ${start.getFullYear()}/${String(endYear).slice(-2)}`;
}

function buildQuarterWindow(anchorIso: string): SummaryWindow {
  const anchor = parseISO(anchorIso);
  const start = startOfQuarter(anchor);
  return {
    label: formatQuarterLabel(anchor),
    start: formatIsoDay(start),
    end: endFromStart(start, 3)
  };
}

function buildCalendarYearWindow(anchorIso: string): SummaryWindow {
  const anchor = parseISO(anchorIso);
  const start = startOfYear(anchor);
  return {
    label: `Calendar Year ${format(start, "yyyy")}`,
    start: formatIsoDay(start),
    end: formatIsoDay(addDays(addYears(start, 1), -1))
  };
}

function buildFinancialYearWindow(anchorIso: string): SummaryWindow {
  const anchor = parseISO(anchorIso);
  const start = financialYearStart(anchor);
  return {
    label: formatFinancialYearLabel(start),
    start: formatIsoDay(start),
    end: formatIsoDay(addDays(addYears(start, 1), -1))
  };
}

function buildWindowForPeriod(anchorIso: string, period: Exclude<SummaryPeriod, "week">): SummaryWindow {
  const anchor = parseISO(anchorIso);

  if (period === "month") {
    const start = startOfMonth(anchor);
    return {
      label: format(start, "MMMM yyyy"),
      start: formatIsoDay(start),
      end: endFromStart(start, 1)
    };
  }

  if (period === "quarter") {
    return buildQuarterWindow(anchorIso);
  }

  if (period === "calendar_year") {
    return buildCalendarYearWindow(anchorIso);
  }

  return buildFinancialYearWindow(anchorIso);
}

function buildPreviousPeriodComparison(
  rows: WeeklyMetricRow[],
  currentWindow: SummaryWindow,
  period: Exclude<SummaryPeriod, "week">
): SummaryComparison {
  const comparisonWindow = buildWindowForPeriod(formatIsoDay(addDays(parseISO(currentWindow.start), -1)), period);

  return {
    window: comparisonWindow,
    rows: rowsInWindow(rows, comparisonWindow.start, comparisonWindow.end)
  };
}

function buildSamePeriodPreviousYearComparison(
  rows: WeeklyMetricRow[],
  currentWindow: SummaryWindow,
  currentRows: WeeklyMetricRow[],
  period: Exclude<SummaryPeriod, "week">
): SummaryComparison {
  const comparisonWindow = buildWindowForPeriod(formatIsoDay(addYears(parseISO(currentWindow.start), -1)), period);

  if (!currentRows.length) {
    return {
      window: comparisonWindow,
      rows: []
    };
  }

  const currentCoverageStart = currentRows[0]?.week_start ?? currentWindow.start;
  const currentCoverageEnd = currentRows.at(-1)?.week_end ?? currentWindow.end;
  const comparisonStart = formatIsoDay(
    addDays(
      parseISO(comparisonWindow.start),
      differenceInCalendarDays(parseISO(currentCoverageStart), parseISO(currentWindow.start))
    )
  );
  const comparisonEndCandidate = formatIsoDay(
    addDays(
      parseISO(comparisonWindow.start),
      differenceInCalendarDays(parseISO(currentCoverageEnd), parseISO(currentWindow.start))
    )
  );
  const comparisonEnd = comparisonEndCandidate > comparisonWindow.end ? comparisonWindow.end : comparisonEndCandidate;

  return {
    window: comparisonWindow,
    rows: rowsInWindow(rows, comparisonStart, comparisonEnd)
  };
}

function buildWeeklySummaryPeriodData(rows: WeeklyMetricRow[], selectedWeekStart: string): DashboardSummaryPeriodData {
  const sortedRows = sortByWeekStart(rows);
  const selectedRow = sortedRows.find((row) => row.week_start === selectedWeekStart) ?? sortedRows.at(-1) ?? null;

  if (!selectedRow) {
    return {
      period: "week",
      period_label: "Weekly",
      comparison_text: "No comparison is available for the previous reporting week.",
      current: {
        label: "Selected reporting week",
        coverage_label: null,
        metrics: { ...EMPTY_SUMMARY_METRICS }
      },
      previous: {
        label: "Previous reporting week",
        coverage_label: null,
        metrics: { ...EMPTY_SUMMARY_METRICS }
      }
    };
  }

  const selectedWeekLabel = formatWeekLabel(selectedRow.week_start, selectedRow.week_end);
  const previousReportedRow = [...sortedRows]
    .reverse()
    .find((row) => row.week_start < selectedRow.week_start && row.record_status === "REPORTED") ?? null;
  const previousLabel = previousReportedRow
    ? formatWeekLabel(previousReportedRow.week_start, previousReportedRow.week_end)
    : "Previous reporting week";

  return {
    period: "week",
    period_label: "Weekly",
    comparison_text: previousPeriodComparisonText(previousLabel, previousReportedRow !== null),
    current: {
      label: selectedWeekLabel,
      coverage_label: selectedWeekLabel,
      metrics: aggregateSummaryMetrics(selectedRow.record_status === "REPORTED" ? [selectedRow] : [])
    },
    previous: {
      label: previousLabel,
      coverage_label: previousReportedRow ? previousLabel : null,
      metrics: aggregateSummaryMetrics(previousReportedRow ? [previousReportedRow] : [])
    }
  };
}

function buildWindowedSummaryPeriodData(
  rows: WeeklyMetricRow[],
  selectedWeekStart: string,
  period: Exclude<SummaryPeriod, "week">
): DashboardSummaryPeriodData {
  const currentWindow = buildWindowForPeriod(selectedWeekStart, period);
  const currentRows = rowsInWindow(rows, currentWindow.start, currentWindow.end);
  const comparison = period === "month"
    ? buildPreviousPeriodComparison(rows, currentWindow, period)
    : buildSamePeriodPreviousYearComparison(rows, currentWindow, currentRows, period);
  const previousWindow = comparison.window;
  const previousRows = comparison.rows;

  return {
    period,
    period_label: SUMMARY_PERIOD_OPTIONS.find((option) => option.id === period)?.label ?? currentWindow.label,
    comparison_text: previousPeriodComparisonText(previousWindow.label, previousRows.length > 0),
    current: {
      label: currentWindow.label,
      coverage_label: buildCoverageLabel(currentRows),
      metrics: aggregateSummaryMetrics(currentRows)
    },
    previous: {
      label: previousWindow.label,
      coverage_label: buildCoverageLabel(previousRows),
      metrics: aggregateSummaryMetrics(previousRows)
    }
  };
}

export function buildSummaryData(rows: WeeklyMetricRow[], selectedWeekStart: string): DashboardSummaryData {
  return {
    default_period: SUMMARY_PERIOD_DEFAULT,
    periods: {
      week: buildWeeklySummaryPeriodData(rows, selectedWeekStart),
      month: buildWindowedSummaryPeriodData(rows, selectedWeekStart, "month"),
      quarter: buildWindowedSummaryPeriodData(rows, selectedWeekStart, "quarter"),
      calendar_year: buildWindowedSummaryPeriodData(rows, selectedWeekStart, "calendar_year"),
      financial_year: buildWindowedSummaryPeriodData(rows, selectedWeekStart, "financial_year")
    }
  };
}

export function buildSummaryReportingOptions(weekStarts: string[]): Record<SummaryPeriod, SummaryReportingOption[]> {
  const sortedWeekStarts = [...new Set(weekStarts)].sort((left, right) => left.localeCompare(right));
  const weekOptions = sortedWeekStarts.map((weekStart) => ({
    value: weekStart,
    label: formatWeekLabel(weekStart, formatIsoDay(addDays(parseISO(weekStart), 6))),
    year: weekStart.slice(0, 4),
    start: weekStart,
    end: weekStart
  }));

  const groupedOptions = {
    month: new Map<string, SummaryReportingOption>(),
    quarter: new Map<string, SummaryReportingOption>(),
    calendar_year: new Map<string, SummaryReportingOption>(),
    financial_year: new Map<string, SummaryReportingOption>()
  };

  for (const weekStart of sortedWeekStarts) {
    const monthWindow = buildWindowForPeriod(weekStart, "month");
    groupedOptions.month.set(monthWindow.start, {
      value: weekStart,
      label: monthWindow.label,
      year: monthWindow.start.slice(0, 4),
      start: monthWindow.start,
      end: monthWindow.end
    });

    const quarterWindow = buildQuarterWindow(weekStart);
    groupedOptions.quarter.set(quarterWindow.start, {
      value: weekStart,
      label: quarterWindow.label,
      year: quarterWindow.start.slice(0, 4),
      start: quarterWindow.start,
      end: quarterWindow.end
    });

    const calendarYearWindow = buildCalendarYearWindow(weekStart);
    groupedOptions.calendar_year.set(calendarYearWindow.start, {
      value: weekStart,
      label: calendarYearWindow.label,
      year: calendarYearWindow.start.slice(0, 4),
      start: calendarYearWindow.start,
      end: calendarYearWindow.end
    });

    const financialYearWindow = buildFinancialYearWindow(weekStart);
    groupedOptions.financial_year.set(financialYearWindow.start, {
      value: weekStart,
      label: financialYearWindow.label,
      year: financialYearWindow.start.slice(0, 4),
      start: financialYearWindow.start,
      end: financialYearWindow.end
    });
  }

  return {
    week: weekOptions,
    month: [...groupedOptions.month.values()],
    quarter: [...groupedOptions.quarter.values()],
    calendar_year: [...groupedOptions.calendar_year.values()],
    financial_year: [...groupedOptions.financial_year.values()]
  };
}

export function findSummaryReportingOption(
  options: SummaryReportingOption[],
  weekStart: string
): SummaryReportingOption | null {
  return options.find((option) => weekStart >= option.start && weekStart <= option.end) ?? options.at(-1) ?? null;
}
