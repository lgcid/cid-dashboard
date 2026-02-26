"use client";

import { useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import Image from "next/image";
import clsx from "clsx";
import domtoimage from "dom-to-image";
import { format, parseISO } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { BRAND, C3_DEPARTMENT_LABELS, C3_DEPARTMENTS, HOTSPOT_LIMIT, NO_DATA_LABEL } from "@/lib/config";
import type { DashboardResponse, IncidentRow, WeeklyMetricRow } from "@/types/dashboard";

type Props = {
  initialData: DashboardResponse;
};

type MetricTheme = "safety" | "cleaning" | "social" | "parks" | "neutral";
type SectionIconKind = "summary" | "currentWeek" | "incidents" | "trends" | "c3";
type ComparisonTone = "increase" | "decrease" | "flat" | "none";
type DashboardTab = "main" | "summary" | "trends" | "c3";
type TrendGranularity = "week" | "month" | "year";
type SummaryInfographicGroupId = "safety_response" | "cleaning_urban" | "social_services" | "communications" | "parks";
type SummaryInfographicIconKind =
  | "urban"
  | "crime"
  | "arrests"
  | "proactive"
  | "cleaning"
  | "drain"
  | "shelter"
  | "bags"
  | "logged"
  | "calls";

type SummaryInfographicGroup = {
  id: SummaryInfographicGroupId;
  title: string;
  description: string;
  accent: string;
  headingAccent?: string;
};

type SummaryInfographicMetricDefinition = {
  id: string;
  label: string;
  icon: SummaryInfographicIconKind;
  groupId: SummaryInfographicGroupId;
  key?: keyof WeeklyMetricRow;
  derived?: "contacts_total" | "cleaning_total_bags" | "fines_issued" | "social_touch_points" | "parks_total_bags";
};

type SummaryInfographicMetric = SummaryInfographicMetricDefinition & {
  current: number | null | undefined;
  previous: number | null | undefined;
};

type SummaryInfographicGroupWithMetrics = SummaryInfographicGroup & {
  metrics: SummaryInfographicMetric[];
};

type TrendChartPoint = {
  period_start: string;
  period_end: string;
  period_label: string;
  urban_total: number | null;
  criminal_incidents: number | null;
  cleaning_bags_collected: number | null;
  contacts_total: number | null;
  urban_ma4: number | null;
  criminal_ma4: number | null;
  cleaning_ma4: number | null;
  contacts_total_ma4: number | null;
};

const THEME_COLOR: Record<MetricTheme, string> = {
  safety: BRAND.colors.safety,
  cleaning: BRAND.colors.cleaning,
  social: BRAND.colors.social,
  parks: BRAND.colors.parks,
  neutral: BRAND.colors.black
};
const C3_RESOLVED_GREY = "rgba(0, 0, 0, 0.35)";
const CRIME_TREND_COLOR = BRAND.colors.safety;
const CLEANING_TREND_COLOR = BRAND.colors.cleaning;
const URBAN_TREND_COLOR = BRAND.colors.safety;
const CONTACTS_TREND_COLOR = BRAND.colors.black;
const SUMMARY_PUBLIC_SAFETY_COLOR = BRAND.colors.safety;
const SUMMARY_CLEANING_COLOR = BRAND.colors.cleaning;
const SCREENSHOT_EXPORT_SCALE = 2;

const DASHBOARD_TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: "summary", label: "Summary" },
  { id: "main", label: "Current Week" },
  { id: "trends", label: "Trends" },
  { id: "c3", label: "C3 Tracker" }
];
const TREND_GRANULARITY_OPTIONS: Array<{ id: TrendGranularity; label: string }> = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" }
];

const SUMMARY_INFOGRAPHIC_GROUPS: SummaryInfographicGroup[] = [
  {
    id: "safety_response",
    title: "Public Safety",
    description: "Public safety and urban managenment outcomes",
    accent: SUMMARY_PUBLIC_SAFETY_COLOR
  },
  {
    id: "cleaning_urban",
    title: "Cleaning & Maintenance",
    description: "Cleaning and maintenance outputs",
    accent: SUMMARY_CLEANING_COLOR
  },
  {
    id: "social_services",
    title: "Social Services",
    description: "Community support and outreach touch points",
    accent: BRAND.colors.social
  },
  {
    id: "communications",
    title: "Communications",
    description: "Resident reporting and service request activity",
    accent: BRAND.colors.black,
    headingAccent: BRAND.colors.white
  },
  {
    id: "parks",
    title: "Parks",
    description: "Bags collected across all tracked parks sites",
    accent: BRAND.colors.parks
  }
];

const SUMMARY_INFOGRAPHIC_METRICS: SummaryInfographicMetricDefinition[] = [
  { id: "urban_total", label: "Urban management incidents", icon: "urban", groupId: "safety_response", key: "urban_total" },
  { id: "fines_issued", label: "Fines issued", icon: "logged", groupId: "safety_response", derived: "fines_issued" },
  { id: "criminal_incidents", label: "Criminal incidents", icon: "crime", groupId: "safety_response", key: "criminal_incidents" },
  { id: "arrests_made", label: "Arrests", icon: "arrests", groupId: "safety_response", key: "arrests_made" },
  { id: "proactive_actions", label: "Proactive interventions", icon: "proactive", groupId: "safety_response", key: "proactive_actions" },
  {
    id: "cleaning_total_bags",
    label: "Cleaning bags collected",
    icon: "bags",
    groupId: "cleaning_urban",
    derived: "cleaning_total_bags"
  },
  { id: "cleaning_servitudes_cleaned", label: "Servitudes cleaned", icon: "shelter", groupId: "cleaning_urban", key: "cleaning_servitudes_cleaned" },
  {
    id: "cleaning_stormwater_drains_cleaned",
    label: "Stormwater drains cleaned",
    icon: "drain",
    groupId: "cleaning_urban",
    key: "cleaning_stormwater_drains_cleaned"
  },
  {
    id: "social_touch_points",
    label: "Touch points",
    icon: "calls",
    groupId: "social_services",
    derived: "social_touch_points"
  },
  { id: "c3_logged_total", label: "C3 logged requests", icon: "logged", groupId: "communications", key: "c3_logged_total" },
  { id: "contacts_total", label: "Calls + WhatsApp received", icon: "calls", groupId: "communications", derived: "contacts_total" },
  {
    id: "parks_total_bags",
    label: "Bags",
    icon: "bags",
    groupId: "parks",
    derived: "parks_total_bags"
  }
];

const SOCIAL_TOUCH_POINT_KEYS: Array<keyof WeeklyMetricRow> = [
  "social_incidents",
  "social_client_follow_ups",
  "social_successful_id_applications",
  "social_shelter_referrals",
  "social_work_readiness_bags"
];

const PARKS_BAG_KEYS: Array<keyof WeeklyMetricRow> = [
  "parks_jutland_park_bags",
  "parks_maynard_park_bags",
  "parks_tuin_plein_bags",
  "parks_gordon_street_verge_bags",
  "parks_wembley_square_verge_bags"
];

function themeRailClass(theme: MetricTheme): string {
  if (theme === "safety") {
    return "rail-safety";
  }
  if (theme === "cleaning") {
    return "rail-cleaning";
  }
  if (theme === "social") {
    return "rail-social";
  }
  if (theme === "parks") {
    return "rail-parks";
  }
  return "rail-neutral";
}

function deltaPillClass(tone: ComparisonTone): string {
  return summaryDeltaPillClass(tone);
}

function valueText(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return NO_DATA_LABEL;
  }
  return value.toLocaleString();
}

function IncidentCategoryTag({ category, compact = false }: { category: string; compact?: boolean }) {
  const label = category.trim();
  if (!label) {
    return null;
  }

  return (
    <span
      className={clsx(
        "inline-flex max-w-full items-center rounded-full border border-black bg-brand-safety px-2 py-0.5 font-semibold normal-case tracking-normal text-black",
        compact ? "text-[9px]" : "text-[10px]"
      )}
    >
      {label}
    </span>
  );
}

function formatWeekDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd MMM yyyy");
  } catch {
    return iso;
  }
}

const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatDataUpdate(value: string): string {
  const pattern = ISO_DATE_ONLY_PATTERN.test(value) ? "dd MMM yyyy" : "dd MMM yyyy, HH:mm";
  try {
    return format(parseISO(value), pattern);
  } catch {
    return value;
  }
}

function formatWeekRange(weekStart: string, weekEnd: string): string {
  return `${formatWeekDate(weekStart)} to ${formatWeekDate(weekEnd)}`;
}

function formatIsoWithPattern(iso: string, pattern: string): string {
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return iso;
  }
}

function toMetricNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
  const total = window.reduce((sum, value) => sum + value, 0);
  return Number((total / window.length).toFixed(2));
}

function trendContactsTotal(row: WeeklyMetricRow): number | null {
  const calls = toMetricNumber(row.calls_received);
  const whatsapps = toMetricNumber(row.whatsapps_received);
  if (calls === null && whatsapps === null) {
    return null;
  }
  return (calls ?? 0) + (whatsapps ?? 0);
}

function trendDateBounds(rows: WeeklyMetricRow[], fallbackDate: string): { from: string; to: string } {
  const sorted = [...rows].sort((a, b) => a.week_start.localeCompare(b.week_start));
  const reported = sorted.filter((row) => row.record_status === "REPORTED");
  const sourceRows = reported.length ? reported : sorted;
  const from = sourceRows[0]?.week_start ?? fallbackDate;
  const to = sourceRows[sourceRows.length - 1]?.week_start ?? fallbackDate;

  return { from, to };
}

function buildTrendSeries(rows: WeeklyMetricRow[], granularity: TrendGranularity): TrendChartPoint[] {
  const sorted = [...rows]
    .filter((row) => row.record_status === "REPORTED")
    .sort((a, b) => a.week_start.localeCompare(b.week_start));

  if (!sorted.length) {
    return [];
  }

  const aggregated: Array<{
    period_start: string;
    period_end: string;
    period_label: string;
    urban_total: number | null;
    criminal_incidents: number | null;
    cleaning_bags_collected: number | null;
    contacts_total: number | null;
  }> = [];

  if (granularity === "week") {
    for (const row of sorted) {
      aggregated.push({
        period_start: row.week_start,
        period_end: row.week_end,
        period_label: formatIsoWithPattern(row.week_start, "dd MMM"),
        urban_total: toMetricNumber(row.urban_total),
        criminal_incidents: toMetricNumber(row.criminal_incidents),
        cleaning_bags_collected: toMetricNumber(row.cleaning_bags_collected),
        contacts_total: trendContactsTotal(row)
      });
    }
  } else {
    const grouped = new Map<
      string,
      {
        period_start: string;
        period_end: string;
        period_label: string;
        urban: number[];
        criminal: number[];
        cleaning: number[];
        contacts: number[];
      }
    >();

    for (const row of sorted) {
      const keyPattern = granularity === "month" ? "yyyy-MM" : "yyyy";
      const periodKey = formatIsoWithPattern(row.week_start, keyPattern);
      const periodLabel = granularity === "month"
        ? formatIsoWithPattern(row.week_start, "MMM yyyy")
        : formatIsoWithPattern(row.week_start, "yyyy");

      const existing = grouped.get(periodKey);
      if (!existing) {
        grouped.set(periodKey, {
          period_start: row.week_start,
          period_end: row.week_end,
          period_label: periodLabel,
          urban: [],
          criminal: [],
          cleaning: [],
          contacts: []
        });
      }

      const bucket = grouped.get(periodKey);
      if (!bucket) {
        continue;
      }

      bucket.period_end = row.week_end;
      const urban = toMetricNumber(row.urban_total);
      const criminal = toMetricNumber(row.criminal_incidents);
      const cleaning = toMetricNumber(row.cleaning_bags_collected);
      const contacts = trendContactsTotal(row);

      if (urban !== null) {
        bucket.urban.push(urban);
      }
      if (criminal !== null) {
        bucket.criminal.push(criminal);
      }
      if (cleaning !== null) {
        bucket.cleaning.push(cleaning);
      }
      if (contacts !== null) {
        bucket.contacts.push(contacts);
      }
    }

    for (const bucket of grouped.values()) {
      aggregated.push({
        period_start: bucket.period_start,
        period_end: bucket.period_end,
        period_label: bucket.period_label,
        urban_total: sumMetric(bucket.urban),
        criminal_incidents: sumMetric(bucket.criminal),
        cleaning_bags_collected: sumMetric(bucket.cleaning),
        contacts_total: sumMetric(bucket.contacts)
      });
    }
  }

  const urbanValues = aggregated.map((point) => point.urban_total);
  const crimeValues = aggregated.map((point) => point.criminal_incidents);
  const cleaningValues = aggregated.map((point) => point.cleaning_bags_collected);
  const contactsValues = aggregated.map((point) => point.contacts_total);

  return aggregated.map((point, index) => ({
    ...point,
    urban_ma4: movingAverage(urbanValues, index, 4),
    criminal_ma4: movingAverage(crimeValues, index, 4),
    cleaning_ma4: movingAverage(cleaningValues, index, 4),
    contacts_total_ma4: movingAverage(contactsValues, index, 4)
  }));
}

function getPreviousReportedWeek(weekly: WeeklyMetricRow[], weekStart: string): WeeklyMetricRow | null {
  const currentIndex = weekly.findIndex((row) => row.week_start === weekStart);
  if (currentIndex <= 0) {
    return null;
  }

  for (let i = currentIndex - 1; i >= 0; i -= 1) {
    if (weekly[i].record_status === "REPORTED") {
      return weekly[i];
    }
  }

  return null;
}

function comparisonMeta(current: number | null | undefined, previous: number | null | undefined): {
  tone: ComparisonTone;
  text: string;
} {
  if (current === null || current === undefined) {
    return { tone: "none", text: NO_DATA_LABEL };
  }
  if (previous === null || previous === undefined) {
    return { tone: "none", text: "No prior reported week" };
  }

  const diff = current - previous;
  if (diff === 0) {
    return { tone: "flat", text: "No change from previous week" };
  }

  if (diff > 0) {
    return { tone: "increase", text: `Increase of ${Math.abs(diff).toLocaleString()} vs previous week` };
  }

  return { tone: "decrease", text: `Decrease of ${Math.abs(diff).toLocaleString()} vs previous week` };
}

function incidentsForWeek(incidents: IncidentRow[], weekStart: string): IncidentRow[] {
  return incidents.filter((incident) => incident.week_start === weekStart);
}

function isSafetyWin(incident: IncidentRow): boolean {
  return /arrest|apprehend|interven/i.test(incident.summary);
}

function ThemeIcon({ theme, className }: { theme: MetricTheme; className?: string }) {
  if (theme === "safety") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
        <path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z" />
      </svg>
    );
  }

  if (theme === "social") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
        <path d="M12 20s-7-4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 6-7 10-7 10Z" />
      </svg>
    );
  }

  if (theme === "parks") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
        <path d="M12 4 7 11h3l-3 4h3l-2 3h8l-2-3h3l-3-4h3l-5-7Z" />
        <path d="M12 18v3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M6 19V9m6 10V5m6 14v-7" />
    </svg>
  );
}

function SectionIcon({ kind, className }: { kind: SectionIconKind; className?: string }) {
  if (kind === "summary") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M7 15h2M11 12h2M15 9h2" />
      </svg>
    );
  }

  if (kind === "currentWeek") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M8 2v4M16 2v4M3 9h18M7 13h4M7 17h6" />
      </svg>
    );
  }

  if (kind === "incidents") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
        <path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
    );
  }

  if (kind === "trends") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
        <path d="M4 18h16M5 16l4-4 3 2 6-6" />
        <path d="M16 8h2v2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 8h8M8 12h5M8 16h6" />
    </svg>
  );
}

function SectionHeading({
  title,
  description,
  icon,
  accent = false,
  iconColor,
  accentColor,
  iconBackground
}: {
  title: string;
  description?: string;
  icon: SectionIconKind;
  accent?: boolean;
  iconColor?: string;
  accentColor?: string;
  iconBackground?: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex min-h-10 items-center gap-3">
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-black"
          style={{
            backgroundColor: iconBackground ?? (accent ? (accentColor ?? BRAND.colors.safety) : BRAND.colors.white),
            color: iconColor ?? BRAND.colors.black
          }}
        >
          <SectionIcon kind={icon} className="h-5 w-5" />
        </span>
        <h2 className="text-2xl font-bold leading-none md:text-3xl">{title}</h2>
      </div>
      {description ? <p className="mt-1 pl-12 text-sm md:text-base">{description}</p> : null}
    </div>
  );
}

function StatCard({
  title,
  current,
  previous,
  theme
}: {
  title: string;
  current: number | null | undefined;
  previous: number | null | undefined;
  theme: MetricTheme;
}) {
  const trend = comparisonMeta(current, previous);

  return (
    <article className="card-frame rounded-xl border-2 border-black p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em]">{title}</p>
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black"
          style={{ backgroundColor: THEME_COLOR[theme] }}
        >
          <ThemeIcon theme={theme} className="h-4 w-4" />
        </span>
      </div>

      <p className="mt-3 text-3xl font-bold">{valueText(current)}</p>
      <p
        className={clsx(
          "mt-3 text-[11px] font-semibold uppercase tracking-[0.06em]",
          trend.tone === "increase" && "underline decoration-2 underline-offset-4",
          trend.tone === "decrease" && "underline decoration-2 underline-offset-4",
          trend.tone === "none" && "text-black/70"
        )}
      >
        {trend.text}
      </p>
    </article>
  );
}

function metricValueText(value: number | null | undefined, unitPlural?: string, unitSingular?: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return NO_DATA_LABEL;
  }
  if (!unitPlural) {
    return value.toLocaleString();
  }

  if (value === 1 && unitSingular) {
    return `${value.toLocaleString()} ${unitSingular}`;
  }
  return `${value.toLocaleString()} ${unitPlural}`;
}

function deltaWithValue(current: number | null | undefined, previous: number | null | undefined): {
  tone: ComparisonTone;
  text: string;
} {
  if (current === null || current === undefined || Number.isNaN(current)) {
    return { tone: "none", text: NO_DATA_LABEL };
  }

  if (previous === null || previous === undefined || Number.isNaN(previous)) {
    return { tone: "none", text: "No prior reported week" };
  }

  const diff = current - previous;
  if (diff === 0) {
    return { tone: "flat", text: "0 vs previous week" };
  }

  if (diff > 0) {
    return { tone: "increase", text: `+${diff.toLocaleString()} vs previous week` };
  }

  return { tone: "decrease", text: `${diff.toLocaleString()} vs previous week` };
}

function deltaSigned(current: number | null | undefined, previous: number | null | undefined): {
  tone: ComparisonTone;
  text: string;
} {
  if (current === null || current === undefined || Number.isNaN(current)) {
    return { tone: "none", text: NO_DATA_LABEL };
  }
  if (previous === null || previous === undefined || Number.isNaN(previous)) {
    return { tone: "none", text: "--" };
  }

  const diff = current - previous;
  if (diff === 0) {
    return { tone: "flat", text: "0" };
  }
  if (diff > 0) {
    return { tone: "increase", text: `+${diff.toLocaleString()}` };
  }

  return { tone: "decrease", text: diff.toLocaleString() };
}

function summaryDeltaPillClass(tone: ComparisonTone): string {
  if (tone === "increase" || tone === "decrease" || tone === "flat") {
    return "border-black bg-black text-white";
  }
  return "border-black bg-white text-black/70";
}

function callsAndWhatsappsTotal(row: WeeklyMetricRow | null): number | null {
  if (!row) {
    return null;
  }
  const calls = row.calls_received;
  const whatsapps = row.whatsapps_received;
  if ((calls === null || calls === undefined) && (whatsapps === null || whatsapps === undefined)) {
    return null;
  }
  return (calls ?? 0) + (whatsapps ?? 0);
}

function summaryMetricsTotal(row: WeeklyMetricRow | null, keys: Array<keyof WeeklyMetricRow>): number | null {
  if (!row) {
    return null;
  }

  const values = keys
    .map((key) => toMetricNumber(row[key] as number | null | undefined))
    .filter((value): value is number => value !== null);
  if (!values.length) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0);
}

function summaryMetricValue(
  metric: SummaryInfographicMetricDefinition,
  row: WeeklyMetricRow | null,
  contactsTotal: number | null
): number | null | undefined {
  if (metric.derived === "contacts_total") {
    return contactsTotal;
  }
  if (metric.derived === "cleaning_total_bags") {
    if (!row) {
      return null;
    }
    const cleaning = row.cleaning_bags_collected;
    const stormwater = row.cleaning_stormwater_bags_filled;
    if ((cleaning === null || cleaning === undefined) && (stormwater === null || stormwater === undefined)) {
      return null;
    }
    return (cleaning ?? 0) + (stormwater ?? 0);
  }
  if (metric.derived === "fines_issued") {
    if (!row) {
      return null;
    }
    const section56 = row.section56_notices;
    const section341 = row.section341_notices;
    if ((section56 === null || section56 === undefined) && (section341 === null || section341 === undefined)) {
      return null;
    }
    return (section56 ?? 0) + (section341 ?? 0);
  }
  if (metric.derived === "social_touch_points") {
    return summaryMetricsTotal(row, SOCIAL_TOUCH_POINT_KEYS);
  }
  if (metric.derived === "parks_total_bags") {
    return summaryMetricsTotal(row, PARKS_BAG_KEYS);
  }

  if (!row || !metric.key) {
    return null;
  }

  return row[metric.key] as number | null | undefined;
}

function SummaryInfographicIcon({ kind, className }: { kind: SummaryInfographicIconKind; className?: string }) {
  if (kind === "urban") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className={className} aria-hidden>
        <path d="M4 20h16M7 20V9l5-3 5 3v11M9 12h2M13 12h2M9 16h2M13 16h2" />
      </svg>
    );
  }

  if (kind === "crime") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className={className} aria-hidden>
        <path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z" />
        <path d="M12 8v4M12 15h.01" />
      </svg>
    );
  }

  if (kind === "arrests") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className={className} aria-hidden>
        <circle cx="7.5" cy="12" r="3.4" />
        <circle cx="16.5" cy="12" r="3.4" />
        <path d="M10.8 12h2.4" />
      </svg>
    );
  }

  if (kind === "proactive") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className={className} aria-hidden>
        <path d="M8 18h8" />
        <path d="M9 18v-6a3 3 0 0 1 6 0v6" />
        <path d="M12 4v2M6 8l1.4 1.4M18 8l-1.4 1.4M4 13h2M18 13h2" />
      </svg>
    );
  }

  if (kind === "cleaning") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className={className} aria-hidden>
        <path d="M7 19h10M9 19v-6M15 19v-6M8 13h8l-1.2-7h-5.6L8 13Z" />
      </svg>
    );
  }

  if (kind === "drain") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className={className} aria-hidden>
        <circle cx="12" cy="12" r="8" />
        <path d="M8 9h8M7 12h10M8 15h8" />
        <path d="M10 7.6v8.8M12 7.2v9.6M14 7.6v8.8" />
      </svg>
    );
  }

  if (kind === "shelter") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className={className} aria-hidden>
        <path d="M4 12 12 5l8 7" />
        <path d="M6 11.5V20h12v-8.5" />
        <path d="M10 20v-4h4v4" />
      </svg>
    );
  }

  if (kind === "bags") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className={className} aria-hidden>
        <path d="M11 3.8h2l.7 1.7h-3.4l.7-1.7Z" />
        <path d="M9 6.4h6a2 2 0 0 1 2 2v1l1.2 8c.2 1.4-.8 2.6-2.3 2.6H8.1c-1.5 0-2.5-1.2-2.3-2.6l1.2-8v-1a2 2 0 0 1 2-2Z" />
        <path d="M8.6 9.8c1.3.8 2.3 1.2 3.4 1.2 1.1 0 2.1-.4 3.4-1.2" />
        <path d="M9.4 13.4h5.2M9.2 16.1h5.6" />
      </svg>
    );
  }

  if (kind === "logged") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className={className} aria-hidden>
        <rect x="5" y="4" width="14" height="16" rx="2" />
        <path d="M9 9h6M9 13h6M9 17h4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className={className} aria-hidden>
      <path d="M7.8 4h2.6l1.2 3.2-1.9 1.3a12.5 12.5 0 0 0 5.8 5.8l1.3-1.9L20 13.6v2.6a1.8 1.8 0 0 1-2 1.8A14.6 14.6 0 0 1 6 6a1.8 1.8 0 0 1 1.8-2Z" />
    </svg>
  );
}

function SummaryInfographicRow({
  label,
  current,
  previous,
  accent,
  icon,
  index
}: {
  label: string;
  current: number | null | undefined;
  previous: number | null | undefined;
  accent: string;
  icon: SummaryInfographicIconKind;
  index: number;
}) {
  const delta = deltaSigned(current, previous);
  const hasValue = current !== null && current !== undefined && !Number.isNaN(current);
  const style = {
    ["--summary-accent" as string]: accent,
    ["--summary-icon-color" as string]: accent === BRAND.colors.black ? BRAND.colors.white : BRAND.colors.black,
    ["--summary-index" as string]: String(index)
  } as CSSProperties;

  return (
    <article className="summary-ribbon" style={style}>
      <div className="summary-ribbon__icon-box">
        <SummaryInfographicIcon kind={icon} className="summary-ribbon__icon-glyph" />
      </div>
      <div className="summary-ribbon__body">
        <p className="summary-ribbon__label">{label}</p>
        <span className={clsx("summary-ribbon__delta", summaryDeltaPillClass(delta.tone))}>{delta.text}</span>
      </div>
      <div className="summary-ribbon__value-box">
        <p className={clsx("summary-ribbon__value", !hasValue && "summary-ribbon__value--no-data")}>{valueText(current)}</p>
      </div>
    </article>
  );
}

function SummaryGroupCard({
  group,
  groupIndex
}: {
  group: SummaryInfographicGroupWithMetrics;
  groupIndex: number;
}) {
  const groupStyle = {
    ["--summary-group-accent" as string]: group.headingAccent ?? group.accent
  } as CSSProperties;

  return (
    <article className="summary-group-card">
      <div className="summary-group-card__header" style={groupStyle}>
        <h3 className="summary-group-card__title">{group.title}</h3>
        <p className="summary-group-card__description">{group.description}</p>
      </div>

      <div className="summary-ribbon-list">
        {group.metrics.map((metric, metricIndex) => (
          <SummaryInfographicRow
            key={metric.id}
            label={metric.label}
            current={metric.current}
            previous={metric.previous}
            accent={group.accent}
            icon={metric.icon}
            index={groupIndex * 10 + metricIndex}
          />
        ))}
      </div>
    </article>
  );
}

function SummaryMetricCard({
  label,
  current,
  previous,
  valueSuffix,
  railClass,
  showDelta = true
}: {
  label: string;
  current: number | null | undefined;
  previous: number | null | undefined;
  valueSuffix?: string;
  railClass?: string;
  showDelta?: boolean;
}) {
  const delta = deltaSigned(current, previous);
  const hasNumericValue = current !== null && current !== undefined && !Number.isNaN(current);
  const currentText = hasNumericValue ? `${valueText(current)}${valueSuffix ?? ""}` : NO_DATA_LABEL;

  return (
    <article className={clsx("rounded-xl border border-black bg-white p-4", railClass && "rail-card", railClass)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.09em]">{label}</p>
      <div className={clsx("mt-3", showDelta && "flex items-end justify-between gap-3")}>
        <p className="text-3xl font-bold">{currentText}</p>
        {showDelta ? (
          <span
            className={clsx(
              "inline-grid h-7 min-w-[2.5rem] place-items-center rounded-full border px-2.5 text-xs font-semibold tabular-nums",
              deltaPillClass(delta.tone)
            )}
          >
            <span className="block leading-none">{delta.text}</span>
          </span>
        ) : null}
      </div>
    </article>
  );
}

function PillarMetricRow({
  label,
  current,
  previous,
  unitPlural,
  unitSingular
}: {
  label: string;
  current: number | null | undefined;
  previous: number | null | undefined;
  unitPlural?: string;
  unitSingular?: string;
}) {
  const delta = deltaSigned(current, previous);

  return (
    <li className="flex items-center justify-between gap-3 border-b border-black/15 py-2 last:border-b-0">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.08em]">{label}</p>
        <p className="mt-1 text-xl font-bold">{metricValueText(current, unitPlural, unitSingular)}</p>
      </div>
      <div className="shrink-0">
        <span
          className={clsx(
            "inline-grid h-7 min-w-[2.5rem] place-items-center rounded-full border px-2.5 text-xs font-semibold tabular-nums",
            deltaPillClass(delta.tone)
          )}
        >
          <span className="block leading-none">{delta.text}</span>
        </span>
      </div>
    </li>
  );
}

function PillarSection({
  title,
  iconPath,
  theme,
  summary,
  currentWeek,
  previousWeek,
  metrics
}: {
  title: string;
  iconPath: string;
  theme: MetricTheme;
  summary: string;
  currentWeek: WeeklyMetricRow | null;
  previousWeek: WeeklyMetricRow | null;
  metrics: Array<{
    label: string;
    key: keyof WeeklyMetricRow;
    unitPlural?: string;
    unitSingular?: string;
  }>;
}) {
  return (
    <article className={clsx("rail-card rounded-2xl border border-black bg-white p-4", themeRailClass(theme))}>
      <div className="flex items-center gap-3 border-b border-black/20 pb-3">
        <img src={iconPath} alt={title} width={48} height={48} className="h-12 w-12 shrink-0 rounded-full object-contain" />
        <h3 className="text-2xl font-bold text-black">
          {title}
        </h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-black/80">{summary}</p>

      <ul className="mt-2">
        {metrics.map((metric) => (
          <PillarMetricRow
            key={metric.key}
            label={metric.label}
            current={currentWeek?.[metric.key] as number | null | undefined}
            previous={previousWeek?.[metric.key] as number | null | undefined}
            unitPlural={metric.unitPlural}
            unitSingular={metric.unitSingular}
          />
        ))}
      </ul>
    </article>
  );
}

function CurrentWeekBreakdownChart({
  title,
  subtitle,
  data,
  color,
  railClass
}: {
  title: string;
  subtitle?: string;
  data: Array<{ category: string; value: number }>;
  color: string;
  railClass?: string;
}) {
  return (
    <article className={clsx("rounded-2xl border border-black bg-white p-4", railClass && "rail-card", railClass)}>
      <h3 className="text-lg font-bold">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-black/75">{subtitle}</p> : null}
      <div className="mt-3 h-[290px] rounded-xl border border-black p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 6, right: 10, left: 0, bottom: 6 }}>
            <CartesianGrid strokeDasharray="2 2" stroke="#000000" opacity={0.2} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis
              type="category"
              dataKey="category"
              width={100}
              tick={{ fontSize: 10 }}
              interval={0}
            />
            <Tooltip />
            <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]}>
              <LabelList
                dataKey="value"
                position="right"
                fill="#000000"
                fontSize={10}
                formatter={(value: number) => value.toLocaleString()}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function SnapshotPanel({
  captureRef,
  currentWeek,
  previousWeek,
  c3Breakdown,
  hotspots,
  incidents,
  selectedWeekStart,
  dataSource
}: {
  captureRef: RefObject<HTMLDivElement>;
  currentWeek: WeeklyMetricRow | null;
  previousWeek: WeeklyMetricRow | null;
  c3Breakdown: Array<{ department: string; logged: number | null; resolved: number | null }>;
  hotspots: Array<{ street: string; incident_count: number }>;
  incidents: IncidentRow[];
  selectedWeekStart: string;
  dataSource: string;
}) {
  return (
    <section ref={captureRef} className="snapshot-panel fixed left-[-10000px] top-0 w-[390px] border-2 border-black bg-white p-4 text-black">
      <div className="border-b-2 border-black bg-black px-3 py-2 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Lower Gardens CID</p>
        <p className="mt-1 text-xl font-bold">Weekly Snapshot</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">{formatWeekDate(selectedWeekStart)}</p>
      </div>

      <div className="mt-3 space-y-3">
        <div className="border border-black p-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em]">Current Week Stats</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
            <p>Urban: <strong>{valueText(currentWeek?.urban_total)}</strong></p>
            <p>Criminal: <strong>{valueText(currentWeek?.criminal_incidents)}</strong></p>
            <p>Arrests: <strong>{valueText(currentWeek?.arrests_made)}</strong></p>
            <p>Proactive: <strong>{valueText(currentWeek?.proactive_actions)}</strong></p>
            <p>Cleaning bags: <strong>{valueText(currentWeek?.cleaning_bags_collected)}</strong></p>
            <p>Shelter referrals: <strong>{valueText(currentWeek?.social_shelter_referrals)}</strong></p>
            <p>Work readiness bags: <strong>{valueText(currentWeek?.social_work_readiness_bags)}</strong></p>
            <p>C3 logged: <strong>{valueText(currentWeek?.c3_logged_total)}</strong></p>
            <p>C3 resolved: <strong>{valueText(currentWeek?.c3_resolved_total)}</strong></p>
            <p>Calls: <strong>{valueText(currentWeek?.calls_received)}</strong></p>
            <p>WhatsApps: <strong>{valueText(currentWeek?.whatsapps_received)}</strong></p>
          </div>
        </div>

        <div className="border border-black p-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em]">Week-on-Week Change</p>
          <div className="mt-2 space-y-1 text-[11px]">
            <p>Criminal incidents: {comparisonMeta(currentWeek?.criminal_incidents, previousWeek?.criminal_incidents).text}</p>
            <p>Arrests: {comparisonMeta(currentWeek?.arrests_made, previousWeek?.arrests_made).text}</p>
            <p>Cleaning bags: {comparisonMeta(currentWeek?.cleaning_bags_collected, previousWeek?.cleaning_bags_collected).text}</p>
            <p>C3 logged: {comparisonMeta(currentWeek?.c3_logged_total, previousWeek?.c3_logged_total).text}</p>
            <p>C3 resolved: {comparisonMeta(currentWeek?.c3_resolved_total, previousWeek?.c3_resolved_total).text}</p>
          </div>
        </div>

        <div className="border border-black p-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em]">C3 Department Breakdown</p>
          <table className="mt-2 w-full text-[10px]">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1 text-left">Dept</th>
                <th className="py-1 text-right">Logged</th>
                <th className="py-1 text-right">Resolved</th>
              </tr>
            </thead>
            <tbody>
              {c3Breakdown.map((row) => (
                <tr key={row.department} className="border-b border-black/30">
                  <td className="py-1">{row.department}</td>
                  <td className="py-1 text-right">{valueText(row.logged)}</td>
                  <td className="py-1 text-right">{valueText(row.resolved)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border border-black p-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em]">Top {HOTSPOT_LIMIT} Streets</p>
          <ol className="mt-2 space-y-1 text-[11px]">
            {hotspots.length ? (
              hotspots.map((spot, index) => (
                <li key={spot.street}>
                  {index + 1}. {spot.street} ({spot.incident_count})
                </li>
              ))
            ) : (
              <li>{NO_DATA_LABEL}</li>
            )}
          </ol>
        </div>

        <div className="border border-black p-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em]">Incident Log ({incidents.length})</p>
          <div className="mt-2 space-y-2 text-[10px]">
            {incidents.length ? (
                incidents.map((incident, index) => (
                  <div key={`${incident.week_start}-${index}`} className="border border-black/40 p-2">
                    <p className="font-semibold">{incident.incident_date ?? "No date"} - {incident.place}</p>
                    <div className="mt-1">
                      <IncidentCategoryTag category={incident.category} compact />
                    </div>
                    <p className="mt-1">{incident.summary}</p>
                  </div>
                ))
              ) : (
                <p>{NO_DATA_LABEL}</p>
            )}
          </div>
        </div>
      </div>

      <p className="mt-3 text-[9px] uppercase tracking-[0.08em]">Source: {dataSource.replace("_", " ")}</p>
    </section>
  );
}

function ExportImageHeader() {
  return (
    <header className="export-image-header" aria-hidden>
      <div className="export-image-header__cell export-image-header__cell--logo">
        <img
          src={BRAND.logoPath}
          alt="Lower Gardens CID"
          width={280}
          height={52}
          className="export-image-header__logo"
        />
      </div>
      <p className="export-image-header__cell export-image-header__tagline">Your Eyes, Our Impact: See it, Share it.</p>
    </header>
  );
}

function ExportImageFooter() {
  return (
    <footer className="export-image-footer" aria-hidden>
      <p className="export-image-footer__cell">LGCID Phone (24hr): 087 330 2177</p>
      <p className="export-image-footer__cell">WhatsApp: 069 007 8644 (message only)</p>
      <p className="export-image-footer__cell">lowergardenscid.co.za</p>
    </footer>
  );
}

export default function DashboardClient({ initialData }: Props) {
  const weekly = initialData.weekly;
  const defaultTrendBounds = trendDateBounds(weekly, initialData.meta.selected_week_start);

  const [selectedWeekStart, setSelectedWeekStart] = useState(initialData.meta.selected_week_start);
  const [activeTab, setActiveTab] = useState<DashboardTab>("summary");
  const [trendFromDate, setTrendFromDate] = useState(defaultTrendBounds.from);
  const [trendToDate, setTrendToDate] = useState(defaultTrendBounds.to);
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>("week");
  const captureRef = useRef<HTMLDivElement>(null);
  const mainPrintableRef = useRef<HTMLDivElement>(null);
  const summaryPrintableRef = useRef<HTMLDivElement>(null);
  const trendsPrintableRef = useRef<HTMLDivElement>(null);
  const c3PrintableRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const weeklyByStart = useMemo(
    () => new Map(weekly.map((row) => [row.week_start, row])),
    [weekly]
  );
  const weekOptions = useMemo(
    () =>
      initialData.meta.available_weeks.map((weekStart) => {
        const row = weeklyByStart.get(weekStart);
        const weekEnd = row?.week_end ?? weekStart;
        return {
          weekStart,
          label: formatWeekRange(weekStart, weekEnd)
        };
      }),
    [initialData.meta.available_weeks, weeklyByStart]
  );

  const currentWeek = useMemo(
    () => weekly.find((row) => row.week_start === selectedWeekStart) ?? null,
    [weekly, selectedWeekStart]
  );
  const selectedWeekRange = useMemo(
    () => (currentWeek ? formatWeekRange(currentWeek.week_start, currentWeek.week_end) : formatWeekDate(selectedWeekStart)),
    [currentWeek, selectedWeekStart]
  );
  const previousWeek = useMemo(
    () => getPreviousReportedWeek(weekly, selectedWeekStart),
    [weekly, selectedWeekStart]
  );
  const currentContactsTotal = useMemo(
    () => callsAndWhatsappsTotal(currentWeek),
    [currentWeek]
  );
  const previousContactsTotal = useMemo(
    () => callsAndWhatsappsTotal(previousWeek),
    [previousWeek]
  );
  const summaryInfographicGroups = useMemo<SummaryInfographicGroupWithMetrics[]>(
    () =>
      SUMMARY_INFOGRAPHIC_GROUPS.map((group) => ({
        ...group,
        metrics: SUMMARY_INFOGRAPHIC_METRICS.filter((metric) => metric.groupId === group.id).map((metric) => ({
          ...metric,
          current: summaryMetricValue(metric, currentWeek, currentContactsTotal),
          previous: summaryMetricValue(metric, previousWeek, previousContactsTotal)
        }))
      })),
    [currentWeek, currentContactsTotal, previousWeek, previousContactsTotal]
  );
  const summaryGroupsById = useMemo(() => {
    const groups: Partial<Record<SummaryInfographicGroupId, SummaryInfographicGroupWithMetrics>> = {};
    for (const group of summaryInfographicGroups) {
      groups[group.id] = group;
    }
    return groups;
  }, [summaryInfographicGroups]);

  const currentIncidents = useMemo(
    () => incidentsForWeek(initialData.incidents, selectedWeekStart),
    [initialData.incidents, selectedWeekStart]
  );

  const c3Ratio = useMemo(() => {
    const logged = currentWeek?.c3_logged_total;
    const resolved = currentWeek?.c3_resolved_total;
    if (logged === null || logged === undefined || resolved === null || resolved === undefined) {
      return null;
    }
    return logged === 0 ? 0 : resolved / logged;
  }, [currentWeek]);
  const reportedWeeks = useMemo(
    () => weekly.filter((row) => row.record_status === "REPORTED"),
    [weekly]
  );
  const trendDateBoundsConfig = useMemo(
    () => trendDateBounds(weekly, initialData.meta.selected_week_start),
    [weekly, initialData.meta.selected_week_start]
  );
  const trendFrom = trendFromDate <= trendToDate ? trendFromDate : trendToDate;
  const trendTo = trendFromDate <= trendToDate ? trendToDate : trendFromDate;
  const trendRangeLabel = `${formatWeekDate(trendFrom)} to ${formatWeekDate(trendTo)}`;
  const trendAverageLabel = trendGranularity === "week"
    ? "4-week average"
    : trendGranularity === "month"
      ? "4-month average"
      : "4-year average";
  const trendPeriodLabel = trendGranularity === "week"
    ? "Weekly"
    : trendGranularity === "month"
      ? "Monthly"
      : "Yearly";
  const trendSeries = useMemo(
    () => buildTrendSeries(
      weekly.filter((row) => row.week_start >= trendFrom && row.week_start <= trendTo),
      trendGranularity
    ),
    [weekly, trendFrom, trendTo, trendGranularity]
  );
  const c3OverallBreakdown = useMemo(
    () =>
      C3_DEPARTMENTS.map((department) => {
        const loggedKey = `c3_logged_${department}` as keyof WeeklyMetricRow;
        const resolvedKey = `c3_resolved_${department}` as keyof WeeklyMetricRow;

        const logged = reportedWeeks.reduce((sum, row) => sum + ((row[loggedKey] as number | null) ?? 0), 0);
        const resolved = reportedWeeks.reduce((sum, row) => sum + ((row[resolvedKey] as number | null) ?? 0), 0);
        const backlog = Math.max(logged - resolved, 0);
        const resolutionRatio = logged === 0 ? null : resolved / logged;

        return {
          department: C3_DEPARTMENT_LABELS[department],
          logged,
          resolved,
          backlog,
          resolutionRatio
        };
      }),
    [reportedWeeks]
  );
  const c3OverallTotals = useMemo(
    () =>
      c3OverallBreakdown.reduce(
        (acc, row) => ({
          logged: acc.logged + row.logged,
          resolved: acc.resolved + row.resolved,
          backlog: acc.backlog + row.backlog
        }),
        { logged: 0, resolved: 0, backlog: 0 }
      ),
    [c3OverallBreakdown]
  );
  const c3OverallResolutionRatio = useMemo(
    () => (c3OverallTotals.logged === 0 ? null : c3OverallTotals.resolved / c3OverallTotals.logged),
    [c3OverallTotals]
  );
  const c3BacklogTop3 = useMemo(
    () =>
      [...c3OverallBreakdown]
        .sort((a, b) => {
          if (b.backlog !== a.backlog) {
            return b.backlog - a.backlog;
          }
          return a.department.localeCompare(b.department);
        })
        .slice(0, 3),
    [c3OverallBreakdown]
  );
  const currentWeekUrbanBreakdown = useMemo(
    () => [
      { category: "Accidents", value: currentWeek?.urban_accidents ?? 0 },
      { category: "Emergency / Medical", value: currentWeek?.urban_emergency_medical_assistance ?? 0 },
      { category: "Pro-active Actions", value: currentWeek?.proactive_actions ?? 0 },
      { category: "Safety & Security", value: currentWeek?.urban_public_safety_and_security ?? 0 },
      { category: "Public Space", value: currentWeek?.urban_public_space_interventions ?? 0 }
    ],
    [currentWeek]
  );
  const currentWeekC3LoggedBreakdown = useMemo(
    () => [
      { category: "Roads & Infrastructure", value: currentWeek?.c3_logged_roads_and_infrastructure ?? 0 },
      { category: "Water & Sanitation", value: currentWeek?.c3_logged_water_and_sanitation ?? 0 },
      { category: "Electricity", value: currentWeek?.c3_logged_electricity ?? 0 },
      { category: "Parks & Recreation", value: currentWeek?.c3_logged_parks_and_recreation ?? 0 },
      { category: "Waste Management", value: currentWeek?.c3_logged_waste_management ?? 0 },
      { category: "Environmental Health", value: currentWeek?.c3_logged_environmental_health ?? 0 },
      { category: "Law Enforcement", value: currentWeek?.c3_logged_law_enforcement ?? 0 },
      { category: "Traffic", value: currentWeek?.c3_logged_traffic ?? 0 }
    ],
    [currentWeek]
  );
  const pillarSections: Array<{
    id: string;
    title: string;
    theme: MetricTheme;
    iconPath: string;
    summary: string;
    metrics: Array<{
      label: string;
      key: keyof WeeklyMetricRow;
      unitPlural?: string;
      unitSingular?: string;
    }>;
  }> = [
    {
      id: "public-safety",
      title: "Public Safety",
      theme: "safety",
      iconPath: "/icons/pillar-safety.webp",
      summary: "Security patrols and emergency response to ensure community safety.",
      metrics: [
        { label: "Criminal Incidents", key: "criminal_incidents" },
        { label: "Arrests Made", key: "arrests_made" },
        { label: "Section 56 Notices", key: "section56_notices" },
        { label: "Section 341 Notices", key: "section341_notices" }
      ]
    },
    {
      id: "cleaning",
      title: "Cleaning & Maintenance",
      theme: "cleaning",
      iconPath: "/icons/pillar-cleaning.webp",
      summary: "Public cleaning and infrastructure maintenance to keep our district pristine.",
      metrics: [
        { label: "Bags Filled and Collected", key: "cleaning_bags_collected", unitPlural: "bags", unitSingular: "bag" },
        { label: "Servitudes Cleaned", key: "cleaning_servitudes_cleaned" },
        { label: "Stormwater Drains Cleaned", key: "cleaning_stormwater_drains_cleaned" },
        { label: "Stormwater Bags Filled", key: "cleaning_stormwater_bags_filled", unitPlural: "bags", unitSingular: "bag" }
      ]
    },
    {
      id: "social-services",
      title: "Social Services",
      theme: "social",
      iconPath: "/icons/pillar-social.webp",
      summary: "Community support programs and social development initiatives",
      metrics: [
        { label: "Incidents", key: "social_incidents" },
        { label: "Client Follow Ups", key: "social_client_follow_ups" },
        { label: "Successful ID Applications", key: "social_successful_id_applications" },
        { label: "Referred Clients to Shelters", key: "social_shelter_referrals" },
        { label: "Work Readiness Bags Collected", key: "social_work_readiness_bags", unitPlural: "bags", unitSingular: "bag" }
      ]
    },
    {
      id: "parks-recreation",
      title: "Parks and Recreation",
      theme: "parks",
      iconPath: "/icons/pillar-parks.webp",
      summary: "Maintaining and improving green spaces and recreational facilities.",
      metrics: [
        { label: "Jutland Park", key: "parks_jutland_park_bags", unitPlural: "bags", unitSingular: "bag" },
        { label: "Maynard Park", key: "parks_maynard_park_bags", unitPlural: "bags", unitSingular: "bag" },
        { label: "Tuin Plein", key: "parks_tuin_plein_bags", unitPlural: "bags", unitSingular: "bag" },
        { label: "Gordon Street Verge", key: "parks_gordon_street_verge_bags", unitPlural: "bags", unitSingular: "bag" },
        { label: "Wembley Square Verge", key: "parks_wembley_square_verge_bags", unitPlural: "bags", unitSingular: "bag" }
      ]
    }
  ];
  const publicSafetyPillar = pillarSections[0];
  const cleaningPillar = pillarSections[1];
  const socialPillar = pillarSections[2];
  const parksPillar = pillarSections[3];
  async function handlePrintScreenshot() {
    if (typeof window === "undefined") {
      return;
    }

    const exportRefByTab: Record<DashboardTab, RefObject<HTMLDivElement>> = {
      main: mainPrintableRef,
      summary: summaryPrintableRef,
      trends: trendsPrintableRef,
      c3: c3PrintableRef
    };
    const exportNode = exportRefByTab[activeTab].current;
    if (!exportNode) {
      return;
    }

    setIsPrinting(true);
    try {
      exportNode.classList.add("dashboard-export-mode");
      exportNode.classList.add("summary-export-mode");
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      if (typeof document !== "undefined" && "fonts" in document) {
        await document.fonts.ready;
      }

      const exportWidth = Math.ceil(exportNode.scrollWidth);
      const exportHeight = Math.ceil(exportNode.scrollHeight);
      const pngDataUrl = await domtoimage.toPng(exportNode, {
        bgcolor: BRAND.colors.white,
        cacheBust: true,
        width: exportWidth * SCREENSHOT_EXPORT_SCALE,
        height: exportHeight * SCREENSHOT_EXPORT_SCALE,
        style: {
          transform: `scale(${SCREENSHOT_EXPORT_SCALE})`,
          transformOrigin: "top left",
          width: `${exportWidth}px`,
          height: `${exportHeight}px`
        }
      });
      const weekToken = currentWeek
        ? `${currentWeek.week_start}_to_${currentWeek.week_end}`
        : selectedWeekStart;
      const tabToken = activeTab === "main" ? "current-week" : activeTab;
      const downloadName = `lgcid-${tabToken}-${weekToken}.png`;
      const link = document.createElement("a");
      link.href = pngDataUrl;
      link.download = downloadName;
      link.click();
    } finally {
      exportNode.classList.remove("dashboard-export-mode");
      exportNode.classList.remove("summary-export-mode");
      setIsPrinting(false);
    }
  }

  return (
    <main className="dashboard-shell min-h-screen bg-white text-black">
      <header className="header">
        <div className="mx-auto w-full max-w-[1140px] px-4">
          <div className="flex min-h-[78px] items-center justify-between gap-4">
            <Image src={BRAND.logoPath} alt="Lower Gardens CID" width={240} height={44} className="h-auto w-[190px] md:w-[230px]" priority />

            <a
              href="https://www.lowergardenscid.co.za/contact-us?hsLang=en"
              className="header__button button shrink-0"
              target="_blank"
              rel="noreferrer"
            >
              Contact us
            </a>
          </div>
        </div>
      </header>

      <section className="border-b-2 border-black bg-black text-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-7 md:py-9">
          <div className="relative text-left">
            <button
              type="button"
              onClick={handlePrintScreenshot}
              disabled={isPrinting}
              className="absolute right-0 top-0 inline-flex items-center rounded-md border border-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPrinting ? "Preparing..." : "Print"}
            </button>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">Lower Gardens City Improvement District</p>
            <h1 className="mt-3 max-w-4xl pr-24 text-3xl font-bold leading-tight md:text-5xl">Weekly Operations Dashboard</h1>
            <p className="mt-3 max-w-3xl text-sm md:text-base">
              Weekly and historical operational performance for stakeholders, covering safety, cleaning, social upliftment, and urban management.
            </p>

            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.08em]">
              Last Update <strong>{formatDataUpdate(initialData.meta.data_updated_at)}</strong>
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-black/20 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {DASHBOARD_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors",
                  activeTab === tab.id
                    ? "border-black bg-black text-white"
                    : "border-black/25 bg-white text-black hover:border-black"
                )}
                aria-pressed={activeTab === tab.id}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8">
        {activeTab === "main" || activeTab === "summary" ? (
        <div className="mb-4 max-w-[420px]">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.14em]">Reporting week</label>
          <select
            value={selectedWeekStart}
            onChange={(event) => setSelectedWeekStart(event.target.value)}
            className="mt-1 w-full border-2 border-black bg-white px-3 py-2 text-sm text-black"
          >
            {weekOptions.map((option) => (
              <option key={option.weekStart} value={option.weekStart}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        ) : null}

        {activeTab === "trends" ? (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="w-full min-w-0 sm:w-[220px]">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em]">From</label>
            <input
              type="date"
              value={trendFromDate}
              min={trendDateBoundsConfig.from}
              max={trendToDate}
              onChange={(event) => {
                const nextFrom = event.target.value;
                if (!nextFrom) {
                  return;
                }
                const boundedFrom = nextFrom < trendDateBoundsConfig.from ? trendDateBoundsConfig.from : nextFrom;
                setTrendFromDate(boundedFrom);
                if (boundedFrom > trendToDate) {
                  setTrendToDate(boundedFrom);
                }
              }}
              className="mt-1 block w-full min-w-0 max-w-full border-2 border-black bg-white px-3 py-2 text-sm text-black"
            />
          </div>
          <div className="w-full min-w-0 sm:w-[220px]">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em]">To</label>
            <input
              type="date"
              value={trendToDate}
              min={trendFromDate}
              max={trendDateBoundsConfig.to}
              onChange={(event) => {
                const nextTo = event.target.value;
                if (!nextTo) {
                  return;
                }
                const boundedTo = nextTo > trendDateBoundsConfig.to ? trendDateBoundsConfig.to : nextTo;
                setTrendToDate(boundedTo);
                if (boundedTo < trendFromDate) {
                  setTrendFromDate(boundedTo);
                }
              }}
              className="mt-1 block w-full min-w-0 max-w-full border-2 border-black bg-white px-3 py-2 text-sm text-black"
            />
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em]">View by</label>
            <div className="mt-1 inline-flex w-full overflow-hidden rounded-md border border-black sm:w-auto">
              {TREND_GRANULARITY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTrendGranularity(option.id)}
                  className={clsx(
                    "flex-1 border-r border-black px-3 py-2 text-xs font-semibold uppercase tracking-[0.09em] last:border-r-0 sm:flex-none",
                    trendGranularity === option.id ? "bg-black text-white" : "bg-white text-black hover:bg-black/5"
                  )}
                  aria-pressed={trendGranularity === option.id}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        ) : null}

        {activeTab === "main" ? (
        <div ref={mainPrintableRef} className="space-y-6">
          <ExportImageHeader />
          <section id="current-week" className="card-frame rounded-2xl border-2 border-black bg-white p-4 md:p-6">
          <SectionHeading
            title="Current Week"
            description={`Detailed operational results across each CID focus area for ${selectedWeekRange}.`}
            icon="currentWeek"
          />

          {currentWeek?.record_status === "NO_DATA_REPORTED" ? (
            <div className="border border-dashed border-black p-5 text-center font-semibold">{NO_DATA_LABEL}</div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <PillarSection
                  key={publicSafetyPillar.id}
                  title={publicSafetyPillar.title}
                  iconPath={publicSafetyPillar.iconPath}
                  theme={publicSafetyPillar.theme}
                  summary={publicSafetyPillar.summary}
                  currentWeek={currentWeek}
                  previousWeek={previousWeek}
                  metrics={publicSafetyPillar.metrics}
                />

                <PillarSection
                  key={cleaningPillar.id}
                  title={cleaningPillar.title}
                  iconPath={cleaningPillar.iconPath}
                  theme={cleaningPillar.theme}
                  summary={cleaningPillar.summary}
                  currentWeek={currentWeek}
                  previousWeek={previousWeek}
                  metrics={cleaningPillar.metrics}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <PillarSection
                  key={socialPillar.id}
                  title={socialPillar.title}
                  iconPath={socialPillar.iconPath}
                  theme={socialPillar.theme}
                  summary={socialPillar.summary}
                  currentWeek={currentWeek}
                  previousWeek={previousWeek}
                  metrics={socialPillar.metrics}
                />

                <PillarSection
                  key={parksPillar.id}
                  title={parksPillar.title}
                  iconPath={parksPillar.iconPath}
                  theme={parksPillar.theme}
                  summary={parksPillar.summary}
                  currentWeek={currentWeek}
                  previousWeek={previousWeek}
                  metrics={parksPillar.metrics}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <CurrentWeekBreakdownChart
                  title="Urban Management Incidents"
                  data={currentWeekUrbanBreakdown}
                  color={BRAND.colors.black}
                />

                <CurrentWeekBreakdownChart
                  title="CoCT C3 Logged Requests"
                  data={currentWeekC3LoggedBreakdown}
                  color={BRAND.colors.black}
                />
              </div>
            </div>
          )}
          </section>

          <section id="incidents" className="card-frame rounded-2xl border-2 border-black bg-white p-4 md:p-6">
          <SectionHeading
            title="Incidents"
            description={`Details of reported incidents for the current week: ${selectedWeekRange}`}
            icon="incidents"
          />

          <div className="mb-4 rounded-xl border border-black bg-white p-4">
            <h3 className="text-base font-bold">Your Eyes, Our Impact: See it, Share it.</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed">
              <li>
                If you are a victim of crime, please report the incident to SAPS and obtain a case number.
                Accurate reporting ensures our crime statistics reflect the true picture of the area.
              </li>
              <li>
                Report incidents to the CID Control Room on 087 330 2177 or via WhatsApp on 069 007 8644 (message only).
              </li>
            </ul>
          </div>

          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            <div className="rounded-xl border border-black p-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em]">Hotspot Intelligence (Top {HOTSPOT_LIMIT})</h3>
              <ol className="mt-3 space-y-2">
                {initialData.hotspots.length ? (
                  initialData.hotspots.map((spot, index) => (
                    <li key={spot.street} className="flex items-center justify-between rounded-lg border border-black bg-white px-3 py-2">
                      <span className="text-sm font-semibold">{index + 1}. {spot.street}</span>
                      <span className="inline-flex min-w-9 items-center justify-center rounded-full border border-black bg-brand-safety px-2 py-0.5 text-xs font-bold">
                        {spot.incident_count}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="border border-dashed border-black p-3 text-sm">{NO_DATA_LABEL}</li>
                )}
              </ol>
            </div>

            <div className="rounded-xl border border-black p-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                Incident Log (Selected Week: {selectedWeekRange})
              </h3>
              <div className="mt-3 grid gap-2">
                {currentIncidents.length ? (
                  currentIncidents.map((incident, index) => (
                    <article key={`${incident.week_start}-${index}`} className="rounded-lg border border-black bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
                        <span>{incident.incident_date ?? "No date"}</span>
                        <span>-</span>
                        <span className="normal-case tracking-normal">{incident.place}</span>
                        <IncidentCategoryTag category={incident.category} />
                      </div>
                      <p className="mt-2 text-sm leading-relaxed">{incident.summary}</p>
                    </article>
                  ))
                ) : (
                  <p className="border border-dashed border-black p-3 text-sm">{NO_DATA_LABEL}</p>
                )}
              </div>
            </div>
          </div>
          </section>
          <ExportImageFooter />
        </div>
        ) : null}

        {activeTab === "summary" ? (
          <div ref={summaryPrintableRef}>
            <ExportImageHeader />
            <section id="summary-infographic" className="card-frame rounded-2xl border-2 border-black bg-white p-4 md:p-6">
              <SectionHeading
                title="Summary"
                description={`Activity report showing the key Lower Gardens CID metrics for ${selectedWeekRange}.`}
                icon="summary"
                iconColor={BRAND.colors.black}
                iconBackground="transparent"
              />

              {currentWeek?.record_status === "NO_DATA_REPORTED" ? (
                <div className="border border-dashed border-black p-5 text-center font-semibold">{NO_DATA_LABEL}</div>
              ) : (
                <div className="summary-infographic-grid">
                  <div className="summary-infographic-column">
                    {summaryGroupsById.safety_response ? <SummaryGroupCard group={summaryGroupsById.safety_response} groupIndex={0} /> : null}
                  </div>
                  <div className="summary-infographic-column">
                    {summaryGroupsById.cleaning_urban ? <SummaryGroupCard group={summaryGroupsById.cleaning_urban} groupIndex={1} /> : null}
                    {summaryGroupsById.social_services ? <SummaryGroupCard group={summaryGroupsById.social_services} groupIndex={2} /> : null}
                  </div>
                  <div className="summary-infographic-column">
                    {summaryGroupsById.parks ? <SummaryGroupCard group={summaryGroupsById.parks} groupIndex={3} /> : null}
                    {summaryGroupsById.communications ? <SummaryGroupCard group={summaryGroupsById.communications} groupIndex={4} /> : null}
                  </div>
                </div>
              )}
            </section>
            <ExportImageFooter />
          </div>
        ) : null}

        {activeTab === "trends" ? (
          <div ref={trendsPrintableRef}>
            <ExportImageHeader />
            <section id="trends" className="card-frame rounded-2xl border-2 border-black bg-white p-4 md:p-6">
            <SectionHeading
              title="Trends"
              description={`${trendPeriodLabel} results from ${trendRangeLabel}, compared with a ${trendAverageLabel} to show underlying direction over time.`}
              icon="trends"
            />

            {trendSeries.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="h-[300px] rounded-xl border border-black p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]">Crime Trend</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendSeries} margin={{ top: 8, right: 18, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#000000" opacity={0.25} />
                      <XAxis dataKey="period_label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ paddingTop: 8, paddingBottom: 8 }} />
                      <Line
                        type="monotone"
                        dataKey="criminal_incidents"
                        stroke={CRIME_TREND_COLOR}
                        strokeWidth={2}
                        dot={false}
                        name={`${trendPeriodLabel} incidents`}
                      />
                      <Line
                        type="monotone"
                        dataKey="criminal_ma4"
                        stroke={BRAND.colors.black}
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                        name={trendAverageLabel}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="h-[300px] rounded-xl border border-black p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]">Cleaning Trend</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendSeries} margin={{ top: 8, right: 18, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#000000" opacity={0.25} />
                      <XAxis dataKey="period_label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ paddingTop: 8, paddingBottom: 8 }} />
                      <Line
                        type="monotone"
                        dataKey="cleaning_bags_collected"
                        stroke={CLEANING_TREND_COLOR}
                        strokeWidth={2}
                        dot={false}
                        name={`${trendPeriodLabel} bags`}
                      />
                      <Line
                        type="monotone"
                        dataKey="cleaning_ma4"
                        stroke={BRAND.colors.black}
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                        name={trendAverageLabel}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="h-[300px] rounded-xl border border-black p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]">Urban Management Incidents Trend</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendSeries} margin={{ top: 8, right: 18, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#000000" opacity={0.25} />
                      <XAxis dataKey="period_label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ paddingTop: 8, paddingBottom: 8 }} />
                      <Line
                        type="monotone"
                        dataKey="urban_total"
                        stroke={URBAN_TREND_COLOR}
                        strokeWidth={2}
                        dot={false}
                        name={`${trendPeriodLabel} incidents`}
                      />
                      <Line
                        type="monotone"
                        dataKey="urban_ma4"
                        stroke={BRAND.colors.black}
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                        name={trendAverageLabel}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="h-[300px] rounded-xl border border-black p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]">Calls + WhatsApp Trend</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendSeries} margin={{ top: 8, right: 18, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#000000" opacity={0.25} />
                      <XAxis dataKey="period_label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ paddingTop: 8, paddingBottom: 8 }} />
                      <Line
                        type="monotone"
                        dataKey="contacts_total"
                        stroke={CONTACTS_TREND_COLOR}
                        strokeWidth={2}
                        dot={false}
                        name={`${trendPeriodLabel} calls + WhatsApp`}
                      />
                      <Line
                        type="monotone"
                        dataKey="contacts_total_ma4"
                        stroke={BRAND.colors.black}
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                        name={trendAverageLabel}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-black p-5 text-center font-semibold">
                {NO_DATA_LABEL}
              </div>
            )}
            </section>
            <ExportImageFooter />
          </div>
        ) : null}

        {activeTab === "c3" ? (
          <div ref={c3PrintableRef}>
            <ExportImageHeader />
            <section id="c3" className="card-frame rounded-2xl border-2 border-black bg-white p-4 md:p-6">
            <SectionHeading
              title="C3 Tracker"
              description="Cumulative City service requests logged vs resolved by category across all reported weeks."
              icon="c3"
            />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryMetricCard label="Total Logged" current={c3OverallTotals.logged} previous={null} showDelta={false} />
            <SummaryMetricCard label="Total Resolved" current={c3OverallTotals.resolved} previous={null} showDelta={false} />
            <SummaryMetricCard label="Open Backlog" current={c3OverallTotals.backlog} previous={null} showDelta={false} />
            <SummaryMetricCard
              label="Resolution Rate"
              current={c3OverallResolutionRatio === null ? null : Math.round(c3OverallResolutionRatio * 100)}
              previous={null}
              valueSuffix="%"
              showDelta={false}
            />
          </div>

          <div className="mt-4 h-[340px] rounded-xl border border-black p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={c3OverallBreakdown} margin={{ top: 8, right: 8, left: 0, bottom: 70 }}>
                <defs>
                  <pattern id="resolvedHatch" patternUnits="userSpaceOnUse" width="8" height="8">
                    <rect width="8" height="8" fill={BRAND.colors.white} />
                    <path d="M-2 2l4-4M0 8l8-8M6 10l4-4" stroke={C3_RESOLVED_GREY} strokeWidth="1.2" />
                  </pattern>
                </defs>
                <CartesianGrid strokeDasharray="2 2" stroke="#000000" opacity={0.25} />
                <XAxis dataKey="department" tick={{ fontSize: 9 }} interval={0} angle={-24} textAnchor="end" height={74} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="logged" fill={BRAND.colors.black} name="Logged (overall)">
                  <LabelList dataKey="logged" position="top" fill="#000000" fontSize={9} />
                </Bar>
                <Bar dataKey="resolved" fill="url(#resolvedHatch)" stroke={C3_RESOLVED_GREY} strokeWidth={1} name="Resolved (overall)">
                  <LabelList dataKey="resolved" position="top" fill="#000000" fontSize={9} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="h-[300px] rounded-xl border border-black p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]">Open Backlog by Category</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={c3OverallBreakdown} layout="vertical" margin={{ top: 8, right: 18, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#000000" opacity={0.2} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="department" width={150} tick={{ fontSize: 9 }} interval={0} />
                  <Tooltip />
                  <Bar dataKey="backlog" fill={BRAND.colors.black} name="Open backlog">
                    <LabelList dataKey="backlog" position="right" fill="#000000" fontSize={9} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border border-black p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">Pressure Points</p>
              <ol className="mt-3 space-y-2 text-sm">
                {c3BacklogTop3.map((row, index) => (
                  <li key={row.department} className="rounded-md border border-black p-2">
                    <p className="font-semibold">{index + 1}. {row.department}</p>
                    <p className="mt-1">Open backlog: <strong>{row.backlog.toLocaleString()}</strong></p>
                    <p className="text-xs">
                      Resolution rate: <strong>{row.resolutionRatio === null ? NO_DATA_LABEL : `${Math.round(row.resolutionRatio * 100)}%`}</strong>
                    </p>
                  </li>
                ))}
              </ol>
            </div>
            </div>
            </section>
            <ExportImageFooter />
          </div>
        ) : null}

        <SnapshotPanel
          captureRef={captureRef}
          currentWeek={currentWeek}
          previousWeek={previousWeek}
          c3Breakdown={C3_DEPARTMENTS.map((department) => ({
            department: C3_DEPARTMENT_LABELS[department],
            logged: (currentWeek?.[`c3_logged_${department}` as keyof WeeklyMetricRow] as number | null | undefined) ?? null,
            resolved: (currentWeek?.[`c3_resolved_${department}` as keyof WeeklyMetricRow] as number | null | undefined) ?? null
          }))}
          hotspots={initialData.hotspots}
          incidents={currentIncidents}
          selectedWeekStart={selectedWeekStart}
          dataSource={initialData.meta.data_source}
        />
      </div>

      <footer className="bg-black text-white">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <Image src={BRAND.logoPathWhite} alt="Lower Gardens CID" width={300} height={54} className="h-auto w-[240px] md:w-[300px]" />
            <p className="mt-4 text-base leading-relaxed text-white/90">
              Lower Gardens City Improvement, Gardens,
              <br />
              Cape Town, Western Cape, 8001, South Africa
            </p>
          </div>

          <div className="md:col-span-4">
            <h5 className="text-lg font-bold">Contact info</h5>
            <p className="mt-4 text-base leading-relaxed text-white/90">
              Phone (24hr):
              <br />
              <a href="tel:0873302177" className="underline underline-offset-4">
                087 330 2177
              </a>
            </p>
            <p className="mt-4 text-base leading-relaxed text-white/90">
              Email:
              <br />
              <a href="mailto:cidmanager@lowergardenscid.co.za" className="underline underline-offset-4">
                cidmanager@lowergardenscid.co.za
              </a>
            </p>
          </div>

          <div className="md:col-span-3">
            <h5 className="text-lg font-bold">Important Links</h5>
            <ul className="footer-link-list mt-4 text-base text-white/90">
              <li>
                <a href="https://www.lowergardenscid.co.za/cid-control-room?hsLang=en" target="_blank" rel="noreferrer">
                  CID Control Room
                </a>
              </li>
              <li>
                <a href="https://www.lowergardenscid.co.za/lgcid-connect?hsLang=en" target="_blank" rel="noreferrer">
                  LGCID Connect
                </a>
              </li>
            </ul>

            <a
              className="footer-cta button mt-5"
              href="https://www.lowergardenscid.co.za/contact-us?hsLang=en"
              target="_blank"
              rel="noreferrer"
            >
              Report an Incident
            </a>
          </div>
        </div>

        <div className="border-t border-white/15">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 text-sm text-white/70">
            Copyright © 2025 - Lower Gardens City Improvement District.
          </div>
        </div>
      </footer>
    </main>
  );
}
