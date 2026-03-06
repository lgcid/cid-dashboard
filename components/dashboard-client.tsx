"use client";

import { useCallback, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
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
import { BRAND, HOTSPOT_LIMIT, NO_DATA_LABEL } from "@/lib/config";
import type {
  DashboardResponse,
  HardcodedWeeklyMetricKey,
  IncidentRow,
  SectionData,
  WeeklyMetricRow
} from "@/types/dashboard";

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
  key?: HardcodedWeeklyMetricKey;
  derived?: "contacts_total" | "cleaning_total_bags" | "fines_issued";
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
  social_touch_points: number | null;
  parks_total_bags: number | null;
  contacts_total: number | null;
  urban_ma4: number | null;
  criminal_ma4: number | null;
  cleaning_ma4: number | null;
  social_touch_points_ma4: number | null;
  parks_total_bags_ma4: number | null;
  contacts_total_ma4: number | null;
};

const C3_RESOLVED_GREY = "rgba(0, 0, 0, 0.35)";
const CRIME_TREND_COLOR = BRAND.colors.safety;
const CLEANING_TREND_COLOR = BRAND.colors.cleaning;
const URBAN_TREND_COLOR = BRAND.colors.black;
const SOCIAL_TREND_COLOR = BRAND.colors.social;
const PARKS_TREND_COLOR = BRAND.colors.parks;
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
    title: "Parks & Recreation",
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
    key: "social_touch_points"
  },
  { id: "c3_logged_total", label: "C3 logged requests", icon: "logged", groupId: "communications", key: "c3_logged_total" },
  { id: "contacts_total", label: "Calls + WhatsApp received", icon: "calls", groupId: "communications", derived: "contacts_total" },
  {
    id: "parks_total_bags",
    label: "Bags",
    icon: "bags",
    groupId: "parks",
    key: "parks_total_bags"
  }
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

function legendLabelFormatter(value: string) {
  return <span style={{ color: BRAND.colors.black }}>{value}</span>;
}

function TrendLegend({
  payload
}: {
  payload?: Array<{ value?: string; color?: string; dataKey?: string | number }>;
}) {
  if (!payload?.length) {
    return null;
  }

  return (
    <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px]">
      {payload.map((entry, index) => {
        const isMovingAverage = typeof entry.dataKey === "string" && entry.dataKey.endsWith("_ma4");
        const color = entry.color ?? BRAND.colors.black;
        const key = `${entry.dataKey ?? entry.value ?? index}`;

        return (
          <li key={key} className="flex items-center gap-2">
            <svg width="24" height="10" viewBox="0 0 24 10" aria-hidden>
              <line x1="0" y1="5" x2="24" y2="5" stroke={color} strokeWidth={2} strokeDasharray={isMovingAverage ? "6 4" : undefined} />
            </svg>
            <span style={{ color: BRAND.colors.black }}>{entry.value}</span>
          </li>
        );
      })}
    </ul>
  );
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

function normalizeCategoryLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function sectionCategoryValue(section: SectionData, weekStart: string, category: string): number | null {
  const normalized = normalizeCategoryLabel(category);
  const matched = section.categories.find((row) => normalizeCategoryLabel(row.category) === normalized);
  if (!matched) {
    return null;
  }
  return toMetricNumber(matched.values[weekStart] ?? null);
}

function weekChartDataFromSection(section: SectionData, weekStart: string | null): Array<{ category: string; value: number }> {
  if (!weekStart) {
    return section.categories.map((row) => ({ category: row.category, value: 0 }));
  }
  return section.categories.map((row) => ({
    category: row.category,
    value: toMetricNumber(row.values[weekStart] ?? null) ?? 0
  }));
}

function unitForCategoryLabel(label: string): { unitPlural?: string; unitSingular?: string } {
  const normalized = normalizeCategoryLabel(label);
  if (normalized.includes("bag")) {
    return {
      unitPlural: "bags",
      unitSingular: "bag"
    };
  }
  return {};
}

function unionSectionCategories(primary: SectionData, secondary: SectionData): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const row of primary.categories) {
    const normalized = normalizeCategoryLabel(row.category);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    ordered.push(row.category);
  }

  for (const row of secondary.categories) {
    const normalized = normalizeCategoryLabel(row.category);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    ordered.push(row.category);
  }

  return ordered;
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
    social_touch_points: number | null;
    parks_total_bags: number | null;
    contacts_total: number | null;
  }> = [];

  if (granularity === "week") {
    for (const row of sorted) {
      aggregated.push({
        period_start: row.week_start,
        period_end: row.week_end,
        period_label: formatIsoWithPattern(row.week_start, "dd MMM"),
        urban_total: toMetricNumber(row.metrics.urban_total),
        criminal_incidents: toMetricNumber(row.metrics.criminal_incidents),
        cleaning_bags_collected: trendCleaningTotal(row),
        social_touch_points: toMetricNumber(row.metrics.social_touch_points),
        parks_total_bags: toMetricNumber(row.metrics.parks_total_bags),
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
        social: number[];
        parks: number[];
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
          social: [],
          parks: [],
          contacts: []
        });
      }

      const bucket = grouped.get(periodKey);
      if (!bucket) {
        continue;
      }

      bucket.period_end = row.week_end;
      const urban = toMetricNumber(row.metrics.urban_total);
      const criminal = toMetricNumber(row.metrics.criminal_incidents);
      const cleaning = trendCleaningTotal(row);
      const social = toMetricNumber(row.metrics.social_touch_points);
      const parks = toMetricNumber(row.metrics.parks_total_bags);
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
      if (social !== null) {
        bucket.social.push(social);
      }
      if (parks !== null) {
        bucket.parks.push(parks);
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
        social_touch_points: sumMetric(bucket.social),
        parks_total_bags: sumMetric(bucket.parks),
        contacts_total: sumMetric(bucket.contacts)
      });
    }
  }

  const urbanValues = aggregated.map((point) => point.urban_total);
  const crimeValues = aggregated.map((point) => point.criminal_incidents);
  const cleaningValues = aggregated.map((point) => point.cleaning_bags_collected);
  const socialValues = aggregated.map((point) => point.social_touch_points);
  const parksValues = aggregated.map((point) => point.parks_total_bags);
  const contactsValues = aggregated.map((point) => point.contacts_total);

  return aggregated.map((point, index) => ({
    ...point,
    urban_ma4: movingAverage(urbanValues, index, 4),
    criminal_ma4: movingAverage(crimeValues, index, 4),
    cleaning_ma4: movingAverage(cleaningValues, index, 4),
    social_touch_points_ma4: movingAverage(socialValues, index, 4),
    parks_total_bags_ma4: movingAverage(parksValues, index, 4),
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

function incidentsForWeek(incidents: IncidentRow[], weekStart: string): IncidentRow[] {
  return incidents.filter((incident) => incident.week_start === weekStart);
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
  const calls = row.metrics.calls_received;
  const whatsapps = row.metrics.whatsapps_received;
  if ((calls === null || calls === undefined) && (whatsapps === null || whatsapps === undefined)) {
    return null;
  }
  return (calls ?? 0) + (whatsapps ?? 0);
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
    const cleaning = row.metrics.cleaning_bags_collected;
    const stormwater = row.metrics.cleaning_stormwater_bags_filled;
    if ((cleaning === null || cleaning === undefined) && (stormwater === null || stormwater === undefined)) {
      return null;
    }
    return (cleaning ?? 0) + (stormwater ?? 0);
  }
  if (metric.derived === "fines_issued") {
    if (!row) {
      return null;
    }
    const section56 = row.metrics.section56_notices;
    const section341 = row.metrics.section341_notices;
    if ((section56 === null || section56 === undefined) && (section341 === null || section341 === undefined)) {
      return null;
    }
    return (section56 ?? 0) + (section341 ?? 0);
  }
  if (!row || !metric.key) {
    return null;
  }

  return row.metrics[metric.key];
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
  metrics
}: {
  title: string;
  iconPath: string;
  theme: MetricTheme;
  summary: string;
  metrics: Array<{
    label: string;
    current: number | null | undefined;
    previous: number | null | undefined;
    unitPlural?: string;
    unitSingular?: string;
  }>;
}) {
  return (
    <article className={clsx("rail-card rounded-2xl border border-black bg-white p-4", themeRailClass(theme))}>
      <div className="flex items-center gap-3 border-b border-black/20 pb-3">
        <Image
          src={iconPath}
          alt={title}
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-full object-contain"
          unoptimized
        />
        <h3 className="text-2xl font-bold text-black">
          {title}
        </h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-black/80">{summary}</p>

      <ul className="mt-2">
        {metrics.map((metric, index) => (
          <PillarMetricRow
            key={`${metric.label}-${index}`}
            label={metric.label}
            current={metric.current}
            previous={metric.previous}
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

function ExportImageHeader() {
  return (
    <header className="export-image-header" aria-hidden>
      <div className="export-image-header__cell export-image-header__cell--logo">
        <Image
          src={BRAND.logoPath}
          alt="Lower Gardens CID"
          width={280}
          height={52}
          className="export-image-header__logo"
          unoptimized
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
          year: weekStart.slice(0, 4),
          label: formatWeekRange(weekStart, weekEnd)
        };
      }),
    [initialData.meta.available_weeks, weeklyByStart]
  );
  const weekYears = useMemo(
    () => [...new Set(weekOptions.map((option) => option.year))].sort((a, b) => b.localeCompare(a)),
    [weekOptions]
  );
  const selectedWeekYear = useMemo(
    () => weekOptions.find((option) => option.weekStart === selectedWeekStart)?.year ?? weekYears[0] ?? "",
    [weekOptions, selectedWeekStart, weekYears]
  );
  const visibleWeekOptions = useMemo(
    () => weekOptions.filter((option) => option.year === selectedWeekYear),
    [weekOptions, selectedWeekYear]
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
  const c3Categories = useMemo(
    () => unionSectionCategories(initialData.sections.c3_logged, initialData.sections.c3_resolved),
    [initialData.sections.c3_logged, initialData.sections.c3_resolved]
  );
  const c3OverallBreakdown = useMemo(
    () =>
      c3Categories.map((category) => {
        const logged = reportedWeeks.reduce(
          (sum, row) => sum + (sectionCategoryValue(initialData.sections.c3_logged, row.week_start, category) ?? 0),
          0
        );
        const resolved = reportedWeeks.reduce(
          (sum, row) => sum + (sectionCategoryValue(initialData.sections.c3_resolved, row.week_start, category) ?? 0),
          0
        );
        const backlog = Math.max(logged - resolved, 0);
        const resolutionRatio = logged === 0 ? null : resolved / logged;

        return {
          department: category,
          logged,
          resolved,
          backlog,
          resolutionRatio
        };
      }),
    [c3Categories, initialData.sections.c3_logged, initialData.sections.c3_resolved, reportedWeeks]
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
  const currentWeekStart = currentWeek?.week_start ?? null;
  const previousWeekStart = previousWeek?.week_start ?? null;
  const currentWeekUrbanBreakdown = useMemo(
    () => weekChartDataFromSection(initialData.sections.urban_management, currentWeekStart),
    [currentWeekStart, initialData.sections.urban_management]
  );
  const currentWeekCommunicationBreakdown = useMemo(
    () => [
      { category: "Calls", value: toMetricNumber(currentWeek?.metrics.calls_received) ?? 0 },
      { category: "WhatsApp", value: toMetricNumber(currentWeek?.metrics.whatsapps_received) ?? 0 }
    ],
    [currentWeek]
  );
  const currentWeekC3LoggedBreakdown = useMemo(
    () => weekChartDataFromSection(initialData.sections.c3_logged, currentWeekStart),
    [currentWeekStart, initialData.sections.c3_logged]
  );
  const currentWeekC3ResolvedBreakdown = useMemo(
    () => weekChartDataFromSection(initialData.sections.c3_resolved, currentWeekStart),
    [currentWeekStart, initialData.sections.c3_resolved]
  );

  const toPillarMetrics = useCallback(
    (section: SectionData) =>
      section.categories.map((row) => {
        const units = unitForCategoryLabel(row.category);
        return {
          label: row.category,
          current: currentWeekStart ? toMetricNumber(row.values[currentWeekStart] ?? null) : null,
          previous: previousWeekStart ? toMetricNumber(row.values[previousWeekStart] ?? null) : null,
          ...units
        };
      }),
    [currentWeekStart, previousWeekStart]
  );

  const publicSafetyPillar = useMemo(
    () => ({
      id: "public-safety",
      title: "Public Safety",
      theme: "safety" as const,
      iconPath: "/icons/pillar-safety.webp",
      summary: "Security patrols and emergency response to ensure community safety.",
      metrics: toPillarMetrics(initialData.sections.public_safety)
    }),
    [initialData.sections.public_safety, toPillarMetrics]
  );
  const cleaningPillar = useMemo(
    () => ({
      id: "cleaning",
      title: "Cleaning & Maintenance",
      theme: "cleaning" as const,
      iconPath: "/icons/pillar-cleaning.webp",
      summary: "Public cleaning and infrastructure maintenance to keep our district pristine.",
      metrics: toPillarMetrics(initialData.sections.cleaning)
    }),
    [initialData.sections.cleaning, toPillarMetrics]
  );
  const socialPillar = useMemo(
    () => ({
      id: "social-services",
      title: "Social Services",
      theme: "social" as const,
      iconPath: "/icons/pillar-social.webp",
      summary: "Community support programs and social development initiatives",
      metrics: toPillarMetrics(initialData.sections.social_services)
    }),
    [initialData.sections.social_services, toPillarMetrics]
  );
  const parksPillar = useMemo(
    () => ({
      id: "parks-recreation",
      title: "Parks & Recreation",
      theme: "parks" as const,
      iconPath: "/icons/pillar-parks.webp",
      summary: "Maintaining and improving green spaces and recreational facilities.",
      metrics: toPillarMetrics(initialData.sections.parks).map((metric) => ({
        ...metric,
        label: metric.label,
        unitPlural: "bags",
        unitSingular: "bag"
      }))
    }),
    [initialData.sections.parks, toPillarMetrics]
  );
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
          <div className="text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">Lower Gardens City Improvement District</p>
            <h1 className="mt-3 max-w-4xl text-3xl font-bold leading-tight md:text-5xl">Weekly Operations Dashboard</h1>
            <p className="mt-3 max-w-3xl text-sm md:text-base">
              Weekly and historical operational performance for stakeholders, covering safety, cleaning, social upliftment, and urban management.
            </p>

            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.08em]">
                Last Update <strong>{formatDataUpdate(initialData.meta.data_updated_at)}</strong>
              </p>
              <button
                type="button"
                onClick={handlePrintScreenshot}
                disabled={isPrinting}
                className="inline-flex items-center rounded-md border border-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPrinting ? "Preparing..." : "Print"}
              </button>
            </div>
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
        <div className="mb-4 grid max-w-[520px] gap-3 sm:grid-cols-[130px_minmax(0,1fr)]">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.14em]">Year</label>
            <select
              value={selectedWeekYear}
              onChange={(event) => {
                const nextYear = event.target.value;
                const nextWeek = [...weekOptions].reverse().find((option) => option.year === nextYear);
                if (nextWeek) {
                  setSelectedWeekStart(nextWeek.weekStart);
                }
              }}
              className="mt-1 h-11 w-full border-2 border-black bg-white px-3 text-sm text-black"
            >
              {weekYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.14em]">Reporting week</label>
            <select
              value={selectedWeekStart}
              onChange={(event) => setSelectedWeekStart(event.target.value)}
              className="mt-1 h-11 w-full border-2 border-black bg-white px-3 text-sm text-black"
            >
              {visibleWeekOptions.map((option) => (
                <option key={option.weekStart} value={option.weekStart}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
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
              className="mt-1 block w-full min-w-0 max-w-full border-2 border-black bg-white px-0 py-2 text-sm text-black sm:px-3"
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
              className="mt-1 block w-full min-w-0 max-w-full border-2 border-black bg-white px-0 py-2 text-sm text-black sm:px-3"
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
                  metrics={publicSafetyPillar.metrics}
                />

                <PillarSection
                  key={cleaningPillar.id}
                  title={cleaningPillar.title}
                  iconPath={cleaningPillar.iconPath}
                  theme={cleaningPillar.theme}
                  summary={cleaningPillar.summary}
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
                  metrics={socialPillar.metrics}
                />

                <PillarSection
                  key={parksPillar.id}
                  title={parksPillar.title}
                  iconPath={parksPillar.iconPath}
                  theme={parksPillar.theme}
                  summary={parksPillar.summary}
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
                  title="Communication"
                  data={currentWeekCommunicationBreakdown}
                  color={BRAND.colors.black}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <CurrentWeekBreakdownChart
                  title="CoCT C3 Logged Requests"
                  data={currentWeekC3LoggedBreakdown}
                  color={BRAND.colors.black}
                />

                <CurrentWeekBreakdownChart
                  title="CoCT C3 Resolved Requests"
                  data={currentWeekC3ResolvedBreakdown}
                  color={BRAND.colors.black}
                />
              </div>
            </div>
          )}
          </section>

          <section id="incidents" className="card-frame rounded-2xl border-2 border-black bg-white p-4 md:p-6">
          <SectionHeading
            title="Criminal Incidents"
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
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]">Public Safety Trend</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendSeries} margin={{ top: 8, right: 18, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#000000" opacity={0.25} />
                      <XAxis dataKey="period_label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend content={<TrendLegend />} />
                      <Line
                        type="monotone"
                        dataKey="criminal_incidents"
                        stroke={CRIME_TREND_COLOR}
                        strokeWidth={3}
                        dot={false}
                        name={`${trendPeriodLabel} criminal incidents`}
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
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]">Cleaning & Maintenance Trend</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendSeries} margin={{ top: 8, right: 18, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#000000" opacity={0.25} />
                      <XAxis dataKey="period_label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend content={<TrendLegend />} />
                      <Line
                        type="monotone"
                        dataKey="cleaning_bags_collected"
                        stroke={CLEANING_TREND_COLOR}
                        strokeWidth={3}
                        dot={false}
                        name={`${trendPeriodLabel} bags (total)`}
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
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]">Social Services Trend</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendSeries} margin={{ top: 8, right: 18, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#000000" opacity={0.25} />
                      <XAxis dataKey="period_label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend content={<TrendLegend />} />
                      <Line
                        type="monotone"
                        dataKey="social_touch_points"
                        stroke={SOCIAL_TREND_COLOR}
                        strokeWidth={3}
                        dot={false}
                        name={`${trendPeriodLabel} touch points`}
                      />
                      <Line
                        type="monotone"
                        dataKey="social_touch_points_ma4"
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
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]">Parks & Recreation Trend</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendSeries} margin={{ top: 8, right: 18, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#000000" opacity={0.25} />
                      <XAxis dataKey="period_label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend content={<TrendLegend />} />
                      <Line
                        type="monotone"
                        dataKey="parks_total_bags"
                        stroke={PARKS_TREND_COLOR}
                        strokeWidth={3}
                        dot={false}
                        name={`${trendPeriodLabel} bags (total)`}
                      />
                      <Line
                        type="monotone"
                        dataKey="parks_total_bags_ma4"
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
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]">Urban Management Trend</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendSeries} margin={{ top: 8, right: 18, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#000000" opacity={0.25} />
                      <XAxis dataKey="period_label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend content={<TrendLegend />} />
                      <Line
                        type="monotone"
                        dataKey="urban_total"
                        stroke={URBAN_TREND_COLOR}
                        strokeWidth={3}
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
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]">Communication Trend</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendSeries} margin={{ top: 8, right: 18, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#000000" opacity={0.25} />
                      <XAxis dataKey="period_label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend content={<TrendLegend />} />
                      <Line
                        type="monotone"
                        dataKey="contacts_total"
                        stroke={CONTACTS_TREND_COLOR}
                        strokeWidth={3}
                        dot={false}
                        name={`${trendPeriodLabel} calls + Whatsapps`}
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
                <Legend formatter={legendLabelFormatter} />
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
