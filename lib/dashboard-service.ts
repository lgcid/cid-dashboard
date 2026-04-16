import { unstable_cache } from "next/cache";
import { format, parseISO } from "date-fns";
import { compareC3Categories, isResolvedC3Request } from "@/lib/c3-requests";
import { weekEndFromStart } from "@/lib/date-utils";
import { buildWeeklyRows, deriveHotspots, deriveWeeks, pickCurrentWeek, sortWeekly } from "@/lib/derive";
import { loadData } from "@/lib/data-source";
import { buildSummaryData } from "@/lib/summary-periods";
import type {
  C3RequestRow,
  C3TrackerBreakdownRow,
  C3TrackerTotals,
  CategoryBreakdownRow,
  DashboardC3Data,
  DashboardC3Query,
  DashboardCurrentWeekData,
  DashboardMeta,
  DashboardPageData,
  DashboardQuery,
  DashboardTrendsData,
  DashboardTrendsQuery,
  MetricComparisonRow,
  NullableNumber,
  SectionData,
  TrendChartPoint,
  TrendGranularity,
  WeeklyMetricRow
} from "@/types/dashboard";

const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DASHBOARD_DATA_CACHE_REVALIDATE_SECONDS = 300;

type DashboardLoadQuery = DashboardQuery & {
  vercelOidcToken?: string;
};

type LoadedDashboardSource = Awaited<ReturnType<typeof loadData>>;

type DashboardBaseData = {
  meta: DashboardMeta;
  weeks: DashboardPageData["weeks"];
  weekly: WeeklyMetricRow[];
  currentWeek: WeeklyMetricRow | null;
  previousWeek: WeeklyMetricRow | null;
  sourceData: LoadedDashboardSource;
  selectedWeekStart: string;
};

function isIsoDay(value: string): boolean {
  return ISO_DAY_PATTERN.test(value);
}

function minIso(values: string[]): string {
  return values.reduce((min, value) => (value < min ? value : min));
}

function maxIso(values: string[]): string {
  return values.reduce((max, value) => (value > max ? value : max));
}

function toMetricNumber(value: NullableNumber | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatIsoWithPattern(iso: string, pattern: string): string {
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return iso;
  }
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

function filterIncidentsByWindow(
  incidents: LoadedDashboardSource["incidents"],
  start: string,
  end: string
): LoadedDashboardSource["incidents"] {
  return incidents.filter((incident) => inWindow(incident.week_start, start, end));
}

function filterToPublishedWeeks<T extends { week_start: string }>(rows: T[], publishedWeeks: string[]): T[] {
  const publishedWeekSet = new Set(publishedWeeks);
  return rows.filter((row) => publishedWeekSet.has(row.week_start));
}

const loadDashboardSourceData = unstable_cache(
  async (preview: string | undefined, vercelOidcToken: string | undefined) =>
    loadData({
      preview,
      vercelOidcToken
    }),
  ["dashboard-source-data"],
  {
    revalidate: DASHBOARD_DATA_CACHE_REVALIDATE_SECONDS
  }
);

function shouldUseDashboardCache(): boolean {
  return process.env.NODE_ENV !== "test";
}

async function loadDashboardData(query: DashboardLoadQuery): Promise<LoadedDashboardSource> {
  if (!shouldUseDashboardCache()) {
    return loadData({
      preview: query.preview,
      vercelOidcToken: query.vercelOidcToken
    });
  }

  if (query.preview) {
    return loadData({
      preview: query.preview,
      vercelOidcToken: query.vercelOidcToken
    });
  }

  return loadDashboardSourceData(query.preview, query.vercelOidcToken);
}

function getPreviousReportedWeek(weekly: WeeklyMetricRow[], weekStart: string): WeeklyMetricRow | null {
  const currentIndex = weekly.findIndex((row) => row.week_start === weekStart);
  if (currentIndex <= 0) {
    return null;
  }

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (weekly[index].record_status === "REPORTED") {
      return weekly[index];
    }
  }

  return null;
}

function buildDashboardBase(
  sourceData: LoadedDashboardSource,
  query: DashboardQuery = {}
): DashboardBaseData {
  const { sections, incidents, publishedWeeks, source } = sourceData;
  const weeks = deriveWeeks(sections);
  const weekly = buildWeeklyRows(weeks, sections);
  const reportingWindow = deriveReportingWindow(publishedWeeks);
  const weeklyWindowed = sortWeekly(filterToPublishedWeeks(weekly, publishedWeeks));
  const weeksWindowed = filterToPublishedWeeks(weeks, publishedWeeks);
  const dataUpdatedAt = deriveDataUpdatedAt(weeklyWindowed, reportingWindow.end);

  const currentWeek = pickCurrentWeek(weeklyWindowed, query);
  const selectedWeekStart = currentWeek?.week_start ?? weeklyWindowed.at(-1)?.week_start ?? reportingWindow.start;
  const previousWeek = getPreviousReportedWeek(weeklyWindowed, selectedWeekStart);

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
    weekly: weeklyWindowed,
    currentWeek,
    previousWeek,
    sourceData: {
      ...sourceData,
      incidents: filterIncidentsByWindow(incidents, reportingWindow.start, reportingWindow.end)
    },
    selectedWeekStart
  };
}

function sectionBreakdownForWeek(section: SectionData, weekStart: string | null): CategoryBreakdownRow[] {
  return section.categories.map((row) => ({
    category: row.category,
    value: weekStart ? toMetricNumber(row.values[weekStart] ?? null) ?? 0 : 0
  }));
}

function sectionComparisons(
  section: SectionData,
  currentWeekStart: string | null,
  previousWeekStart: string | null
): MetricComparisonRow[] {
  return section.categories.map((row) => ({
    label: row.category,
    current: currentWeekStart ? toMetricNumber(row.values[currentWeekStart] ?? null) : null,
    previous: previousWeekStart ? toMetricNumber(row.values[previousWeekStart] ?? null) : null
  }));
}

function filterIncidentsForSelectedWeek(
  incidents: LoadedDashboardSource["incidents"],
  selectedWeekStart: string
): LoadedDashboardSource["incidents"] {
  return incidents.filter((incident) => incident.week_start === selectedWeekStart);
}

function sumMetric(values: number[]): number | null {
  if (!values.length) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0);
}

function movingAverage(values: Array<number | null>, index: number, windowSize = 4): number | null {
  const start = Math.max(0, index - windowSize + 1);
  const window = values.slice(start, index + 1).filter((value): value is number => value !== null);
  if (!window.length) {
    return null;
  }
  return Number((window.reduce((sum, value) => sum + value, 0) / window.length).toFixed(2));
}

function trendContactsTotal(row: WeeklyMetricRow): number | null {
  const calls = toMetricNumber(row.metrics.calls_received);
  const whatsapps = toMetricNumber(row.metrics.whatsapps_received);
  if (calls === null && whatsapps === null) {
    return null;
  }
  return (calls ?? 0) + (whatsapps ?? 0);
}

function trendCleaningTotal(row: WeeklyMetricRow): number | null {
  const cleaning = toMetricNumber(row.metrics.cleaning_bags_collected);
  const stormwater = toMetricNumber(row.metrics.cleaning_stormwater_bags_filled);
  if (cleaning === null && stormwater === null) {
    return null;
  }
  return (cleaning ?? 0) + (stormwater ?? 0);
}

function trendFinesTotal(row: WeeklyMetricRow): number | null {
  const section56 = toMetricNumber(row.metrics.section56_notices);
  const section341 = toMetricNumber(row.metrics.section341_notices);
  if (section56 === null && section341 === null) {
    return null;
  }
  return (section56 ?? 0) + (section341 ?? 0);
}

function buildTrendSeries(rows: WeeklyMetricRow[], granularity: TrendGranularity): TrendChartPoint[] {
  const sorted = [...rows]
    .filter((row) => row.record_status === "REPORTED")
    .sort((left, right) => left.week_start.localeCompare(right.week_start));

  if (!sorted.length) {
    return [];
  }

  const aggregated: Array<Omit<TrendChartPoint, keyof Pick<
    TrendChartPoint,
    | "general_incidents_ma4"
    | "fines_total_ma4"
    | "criminal_ma4"
    | "cleaning_ma4"
    | "social_touch_points_ma4"
    | "parks_total_bags_ma4"
    | "contacts_total_ma4"
    | "c3_logged_total_ma4"
  >>> = [];

  if (granularity === "week") {
    for (const row of sorted) {
      aggregated.push({
        period_start: row.week_start,
        period_end: row.week_end,
        period_label: formatIsoWithPattern(row.week_start, "dd MMM"),
        general_incidents_total: toMetricNumber(row.metrics.general_incidents_total),
        fines_total: trendFinesTotal(row),
        criminal_incidents: toMetricNumber(row.metrics.criminal_incidents),
        cleaning_bags_collected: trendCleaningTotal(row),
        social_touch_points: toMetricNumber(row.metrics.social_touch_points),
        parks_total_bags: toMetricNumber(row.metrics.parks_total_bags),
        contacts_total: trendContactsTotal(row),
        c3_logged_total: toMetricNumber(row.metrics.c3_logged_total)
      });
    }
  } else {
    const grouped = new Map<
      string,
      {
        period_start: string;
        period_end: string;
        period_label: string;
        generalIncidents: number[];
        fines: number[];
        criminal: number[];
        cleaning: number[];
        social: number[];
        parks: number[];
        contacts: number[];
        c3Logged: number[];
      }
    >();

    for (const row of sorted) {
      const periodKey = granularity === "month"
        ? row.week_start.slice(0, 7)
        : row.week_start.slice(0, 4);
      const periodLabel = granularity === "month"
        ? formatIsoWithPattern(`${row.week_start.slice(0, 7)}-01`, "MMM yyyy")
        : row.week_start.slice(0, 4);
      const bucket = grouped.get(periodKey) ?? {
        period_start: row.week_start,
        period_end: row.week_end,
        period_label: periodLabel,
        generalIncidents: [],
        fines: [],
        criminal: [],
        cleaning: [],
        social: [],
        parks: [],
        contacts: [],
        c3Logged: []
      };

      bucket.period_end = row.week_end;

      const generalIncidents = toMetricNumber(row.metrics.general_incidents_total);
      const fines = trendFinesTotal(row);
      const criminal = toMetricNumber(row.metrics.criminal_incidents);
      const cleaning = trendCleaningTotal(row);
      const social = toMetricNumber(row.metrics.social_touch_points);
      const parks = toMetricNumber(row.metrics.parks_total_bags);
      const contacts = trendContactsTotal(row);
      const c3Logged = toMetricNumber(row.metrics.c3_logged_total);

      if (generalIncidents !== null) {
        bucket.generalIncidents.push(generalIncidents);
      }
      if (fines !== null) {
        bucket.fines.push(fines);
      }
      if (criminal !== null) {
        bucket.criminal.push(criminal);
      }
      if (cleaning !== null) {
        bucket.cleaning.push(cleaning);
      }
      if (social !== null) {
        bucket.social.push(social);
      }
      if (parks !== null) {
        bucket.parks.push(parks);
      }
      if (contacts !== null) {
        bucket.contacts.push(contacts);
      }
      if (c3Logged !== null) {
        bucket.c3Logged.push(c3Logged);
      }

      grouped.set(periodKey, bucket);
    }

    for (const bucket of grouped.values()) {
      aggregated.push({
        period_start: bucket.period_start,
        period_end: bucket.period_end,
        period_label: bucket.period_label,
        general_incidents_total: sumMetric(bucket.generalIncidents),
        fines_total: sumMetric(bucket.fines),
        criminal_incidents: sumMetric(bucket.criminal),
        cleaning_bags_collected: sumMetric(bucket.cleaning),
        social_touch_points: sumMetric(bucket.social),
        parks_total_bags: sumMetric(bucket.parks),
        contacts_total: sumMetric(bucket.contacts),
        c3_logged_total: sumMetric(bucket.c3Logged)
      });
    }
  }

  const generalIncidentsValues = aggregated.map((point) => point.general_incidents_total);
  const finesValues = aggregated.map((point) => point.fines_total);
  const criminalValues = aggregated.map((point) => point.criminal_incidents);
  const cleaningValues = aggregated.map((point) => point.cleaning_bags_collected);
  const socialValues = aggregated.map((point) => point.social_touch_points);
  const parksValues = aggregated.map((point) => point.parks_total_bags);
  const contactsValues = aggregated.map((point) => point.contacts_total);
  const c3LoggedValues = aggregated.map((point) => point.c3_logged_total);

  return aggregated.map((point, index) => ({
    ...point,
    general_incidents_ma4: movingAverage(generalIncidentsValues, index, 4),
    fines_total_ma4: movingAverage(finesValues, index, 4),
    criminal_ma4: movingAverage(criminalValues, index, 4),
    cleaning_ma4: movingAverage(cleaningValues, index, 4),
    social_touch_points_ma4: movingAverage(socialValues, index, 4),
    parks_total_bags_ma4: movingAverage(parksValues, index, 4),
    contacts_total_ma4: movingAverage(contactsValues, index, 4),
    c3_logged_total_ma4: movingAverage(c3LoggedValues, index, 4)
  }));
}

function buildC3Breakdown(rows: C3RequestRow[]): C3TrackerBreakdownRow[] {
  const counts = new Map<string, { logged: number; resolved: number }>();

  for (const row of rows) {
    if (!row.category) {
      continue;
    }

    const existing = counts.get(row.category) ?? { logged: 0, resolved: 0 };
    existing.logged += 1;
    if (isResolvedC3Request(row)) {
      existing.resolved += 1;
    }
    counts.set(row.category, existing);
  }

  return [...counts.entries()]
    .sort(([left], [right]) => compareC3Categories(left, right))
    .map(([department, values]) => ({
      department,
      logged: values.logged,
      resolved: values.resolved,
      backlog: Math.max(values.logged - values.resolved, 0),
      resolution_ratio: values.logged === 0 ? null : Number((values.resolved / values.logged).toFixed(2))
    }));
}

function buildC3Totals(breakdown: C3TrackerBreakdownRow[]): C3TrackerTotals {
  const totals = breakdown.reduce(
    (acc, row) => ({
      logged: acc.logged + row.logged,
      resolved: acc.resolved + row.resolved,
      backlog: acc.backlog + row.backlog
    }),
    { logged: 0, resolved: 0, backlog: 0 }
  );

  return {
    ...totals,
    resolution_ratio: totals.logged === 0 ? null : Number((totals.resolved / totals.logged).toFixed(2))
  };
}

function buildPressurePoints(breakdown: C3TrackerBreakdownRow[]): C3TrackerBreakdownRow[] {
  return [...breakdown]
    .sort((left, right) => {
      if (right.backlog !== left.backlog) {
        return right.backlog - left.backlog;
      }
      return left.department.localeCompare(right.department);
    })
    .slice(0, 3);
}

function buildTrendsData(base: DashboardBaseData, query: DashboardTrendsQuery = {}): DashboardTrendsData {
  const reportedWeeks = base.weekly.filter((row) => row.record_status === "REPORTED");
  const availableFrom = reportedWeeks[0]?.week_start ?? base.meta.selected_week_start;
  const availableTo = reportedWeeks.at(-1)?.week_start ?? base.meta.selected_week_start;
  const from = query.from && query.from >= availableFrom ? query.from : availableFrom;
  const to = query.to && query.to <= availableTo ? query.to : availableTo;
  const granularity = query.granularity ?? "week";
  const rangeStart = from <= to ? from : to;
  const rangeEnd = from <= to ? to : from;

  return {
    available_from: availableFrom,
    available_to: availableTo,
    from: rangeStart,
    to: rangeEnd,
    granularity,
    series: buildTrendSeries(
      base.weekly.filter((row) => row.week_start >= rangeStart && row.week_start <= rangeEnd),
      granularity
    )
  };
}

function buildC3Data(base: DashboardBaseData, query: DashboardC3Query = {}): DashboardC3Data {
  const availableFrom = base.meta.reporting_window_start;
  const availableTo = base.meta.reporting_window_end;
  const from = query.from && query.from >= availableFrom ? query.from : availableFrom;
  const to = query.to && query.to <= availableTo ? query.to : availableTo;
  const rangeStart = from <= to ? from : to;
  const rangeEnd = from <= to ? to : from;
  const filteredRows = base.sourceData.c3Requests.filter((row) => {
    if (!row.date_logged) {
      return false;
    }
    return row.date_logged >= rangeStart && row.date_logged <= rangeEnd;
  });
  const breakdown = buildC3Breakdown(filteredRows);

  return {
    available_from: availableFrom,
    available_to: availableTo,
    from: rangeStart,
    to: rangeEnd,
    totals: buildC3Totals(breakdown),
    breakdown,
    pressure_points: buildPressurePoints(breakdown)
  };
}

function buildCurrentWeekData(base: DashboardBaseData): DashboardCurrentWeekData {
  const currentWeekStart = base.currentWeek?.week_start ?? null;
  const previousWeekStart = base.previousWeek?.week_start ?? null;
  const { sections, incidents } = base.sourceData;

  return {
    general_incidents_breakdown: sectionBreakdownForWeek(sections.general_incidents, currentWeekStart),
    control_room_breakdown: sectionBreakdownForWeek(sections.control_room_engagement, currentWeekStart),
    c3_logged_breakdown: sectionBreakdownForWeek(sections.c3_requests, currentWeekStart),
    public_safety_metrics: sectionComparisons(sections.public_safety, currentWeekStart, previousWeekStart),
    cleaning_metrics: sectionComparisons(sections.cleaning, currentWeekStart, previousWeekStart),
    social_services_metrics: sectionComparisons(sections.social_services, currentWeekStart, previousWeekStart),
    parks_metrics: sectionComparisons(sections.parks, currentWeekStart, previousWeekStart),
    incidents: currentWeekStart ? filterIncidentsForSelectedWeek(incidents, currentWeekStart) : [],
    hotspots: deriveHotspots(incidents, base.weekly)
  };
}

export async function getDashboardPageData(query: DashboardLoadQuery = {}): Promise<DashboardPageData> {
  const base = buildDashboardBase(await loadDashboardData(query), query);

  return {
    meta: base.meta,
    weeks: base.weeks,
    week_context: {
      current_week: base.currentWeek,
      previous_week: base.previousWeek
    },
    summary: buildSummaryData(base.weekly, base.selectedWeekStart),
    current_week_tab: buildCurrentWeekData(base),
    trends: buildTrendsData(base),
    c3: buildC3Data(base)
  };
}

export async function getDashboardTrendsData(query: DashboardLoadQuery & DashboardTrendsQuery = {}): Promise<DashboardTrendsData> {
  const base = buildDashboardBase(await loadDashboardData(query), query);
  return buildTrendsData(base, query);
}

export async function getDashboardC3Data(query: DashboardLoadQuery & DashboardC3Query = {}): Promise<DashboardC3Data> {
  const base = buildDashboardBase(await loadDashboardData(query), query);
  return buildC3Data(base, query);
}
