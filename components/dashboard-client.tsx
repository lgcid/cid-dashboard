"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
import Image from "next/image";
import clsx from "clsx";
import html2canvas from "html2canvas";
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
import { BRAND, C3_DEPARTMENT_LABELS, C3_DEPARTMENTS, NO_DATA_LABEL } from "@/lib/config";
import type { DashboardResponse, IncidentRow, WeeklyMetricRow } from "@/types/dashboard";

type Props = {
  initialData: DashboardResponse;
};

type MetricTheme = "safety" | "cleaning" | "social" | "parks" | "neutral";
type SectionIconKind = "summary" | "currentWeek" | "incidents" | "trends" | "c3";
type ComparisonTone = "increase" | "decrease" | "flat" | "none";
type DashboardTab = "main" | "trends" | "c3";

const THEME_COLOR: Record<MetricTheme, string> = {
  safety: "#FFF300",
  cleaning: "#C5FF2F",
  social: "#FF3087",
  parks: "#44D62C",
  neutral: BRAND.colors.black
};
const C3_RESOLVED_GREY = "#9CA3AF";
const URBAN_TREND_COLOR = "#C59A00";
const CONTACTS_TREND_COLOR = "#C92A7A";

const DASHBOARD_TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: "main", label: "Current Week" },
  { id: "trends", label: "Trends" },
  { id: "c3", label: "C3 Efficiency Tracker" }
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
  if (tone === "increase") {
    return "border-[#b7dfc5] bg-[#edf9f1] text-[#0b7f2a]";
  }
  if (tone === "decrease") {
    return "border-[#efc4c4] bg-[#fff1f1] text-[#b30000]";
  }
  if (tone === "flat") {
    return "border-[#d7d7d7] bg-[#f5f5f5] text-black";
  }
  return "border-[#e3e3e3] bg-[#f8f8f8] text-black/60";
}

function valueText(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return NO_DATA_LABEL;
  }
  return value.toLocaleString();
}

function formatWeekDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd MMM yyyy");
  } catch {
    return iso;
  }
}

function formatTimestamp(iso: string): string {
  try {
    return format(parseISO(iso), "dd MMM yyyy, HH:mm");
  } catch {
    return iso;
  }
}

function formatWeekRange(weekStart: string, weekEnd: string): string {
  return `${formatWeekDate(weekStart)} to ${formatWeekDate(weekEnd)}`;
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
  accent = false
}: {
  title: string;
  description?: string;
  icon: SectionIconKind;
  accent?: boolean;
}) {
  return (
    <div className="mb-4">
      <div className="flex min-h-10 items-center gap-3">
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-black"
          style={{ backgroundColor: accent ? BRAND.colors.safetyCleaning : BRAND.colors.white }}
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

      <p className="mt-3 text-3xl font-extrabold">{valueText(current)}</p>
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

function SummaryMetricCard({
  label,
  current,
  previous,
  valueSuffix,
  railClass
}: {
  label: string;
  current: number | null | undefined;
  previous: number | null | undefined;
  valueSuffix?: string;
  railClass?: string;
}) {
  const delta = deltaSigned(current, previous);
  const hasNumericValue = current !== null && current !== undefined && !Number.isNaN(current);
  const currentText = hasNumericValue ? `${valueText(current)}${valueSuffix ?? ""}` : NO_DATA_LABEL;

  return (
    <article className={clsx("rounded-xl border border-black bg-white p-4", railClass && "rail-card", railClass)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.09em]">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-3xl font-extrabold">{currentText}</p>
        <span
          className={clsx(
            "inline-grid h-7 min-w-[2.5rem] place-items-center rounded-full border px-2.5 text-xs font-semibold tabular-nums",
            deltaPillClass(delta.tone)
          )}
        >
          <span className="block leading-none" style={{ fontFamily: "Arial, Helvetica, sans-serif", transform: "translateY(-0.5px)" }}>
            {delta.text}
          </span>
        </span>
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
          <span className="block leading-none" style={{ fontFamily: "Arial, Helvetica, sans-serif", transform: "translateY(-0.5px)" }}>
            {delta.text}
          </span>
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
        <h3 className="text-2xl font-bold" style={{ color: THEME_COLOR[theme] === BRAND.colors.black ? BRAND.colors.black : "#1e1e1e" }}>
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
          <BarChart data={data} layout="vertical" margin={{ top: 6, right: 10, left: 6, bottom: 6 }}>
            <CartesianGrid strokeDasharray="2 2" stroke="#000000" opacity={0.2} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis
              type="category"
              dataKey="category"
              width={160}
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
          <p className="text-[10px] font-bold uppercase tracking-[0.12em]">Top Streets</p>
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
                  <p className="font-semibold">{incident.incident_date ?? "No date"} - {incident.place_raw}</p>
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

export default function DashboardClient({ initialData }: Props) {
  const [selectedWeekStart, setSelectedWeekStart] = useState(initialData.meta.selected_week_start);
  const [activeTab, setActiveTab] = useState<DashboardTab>("main");
  const captureRef = useRef<HTMLDivElement>(null);
  const printableRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const weekly = initialData.weekly;
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
      summary: "Security patrols and emergency response services to ensure community safety.",
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
      summary: "Maintaining and improving green spaces, recreational facilities, and community areas",
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
  const summaryMetrics: Array<{ label: string; key: keyof WeeklyMetricRow }> = [
    { label: "Urban Management Incidents", key: "urban_total" },
    { label: "Criminal Incidents", key: "criminal_incidents" },
    { label: "Arrests", key: "arrests_made" },
    { label: "Proactive interventions", key: "proactive_actions" },
    { label: "Cleaning bags", key: "cleaning_bags_collected" },
    { label: "C3 logged requests", key: "c3_logged_total" },
    { label: "Calls received", key: "calls_received" },
    { label: "Whatsapp received", key: "whatsapps_received" }
  ];

  async function handlePrintScreenshot() {
    if (!printableRef.current || typeof window === "undefined") {
      return;
    }

    setIsPrinting(true);
    try {
      const canvas = await html2canvas(printableRef.current, {
        backgroundColor: "#FFFFFF",
        scale: 2,
        useCORS: true
      });
      const weekToken = currentWeek
        ? `${currentWeek.week_start}_to_${currentWeek.week_end}`
        : selectedWeekStart;
      const downloadName = `lgcid-summary-current-week-incidents-${weekToken}.png`;
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = downloadName;
      link.click();
    } finally {
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
              disabled={isPrinting || activeTab !== "main"}
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
              Last Update <strong>{formatTimestamp(initialData.meta.generated_at)}</strong>
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
        {activeTab === "main" ? (
        <>
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

        <div ref={printableRef} className="space-y-6">
          <section id="summary" className="card-frame rounded-2xl border-2 border-black bg-white p-4 md:p-6">
          <SectionHeading
            title="Summary"
            description="High-level operational snapshot for the selected week, including week-on-week movement."
            icon="summary"
          />
          {currentWeek?.record_status === "NO_DATA_REPORTED" ? (
            <div className="border border-dashed border-black p-5 text-center font-semibold">{NO_DATA_LABEL}</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {summaryMetrics.map((metric) => (
                <SummaryMetricCard
                  key={metric.key}
                  label={metric.label}
                  current={currentWeek?.[metric.key] as number | null | undefined}
                  previous={previousWeek?.[metric.key] as number | null | undefined}
                />
              ))}
            </div>
          )}
          </section>

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
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em]">Hotspot Intelligence (Cumulative)</h3>
              <ol className="mt-3 space-y-2">
                {initialData.hotspots.length ? (
                  initialData.hotspots.map((spot, index) => (
                    <li key={spot.street} className="flex items-center justify-between rounded-lg border border-black bg-white px-3 py-2">
                      <span className="text-sm font-semibold capitalize">{index + 1}. {spot.street}</span>
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
                        <span className="normal-case tracking-normal">{incident.place_raw}</span>
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
        </div>
        </>
        ) : null}

        {activeTab === "trends" ? (
          <section id="trends" className="card-frame rounded-2xl border-2 border-black bg-white p-4 md:p-6">
          <SectionHeading
            title="Trends"
            description="Weekly results compared with a 4-week moving average (MA(4)) to show underlying direction over time."
            icon="trends"
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-[300px] rounded-xl border border-black p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]">Crime Trend</p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={initialData.trends} margin={{ top: 8, right: 18, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#000000" opacity={0.25} />
                  <XAxis dataKey="week_label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ paddingTop: 8, paddingBottom: 8 }} />
                  <Line type="monotone" dataKey="criminal_incidents" stroke={BRAND.colors.safetyCleaning} strokeWidth={2} dot={false} name="Weekly incidents" />
                  <Line
                    type="monotone"
                    dataKey="criminal_ma4"
                    stroke={BRAND.colors.black}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    name="MA(4) incidents"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="h-[300px] rounded-xl border border-black p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]">Cleaning Trend</p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={initialData.trends} margin={{ top: 8, right: 18, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#000000" opacity={0.25} />
                  <XAxis dataKey="week_label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ paddingTop: 8, paddingBottom: 8 }} />
                  <Line type="monotone" dataKey="cleaning_bags_collected" stroke={BRAND.colors.parks} strokeWidth={2} dot={false} name="Weekly bags" />
                  <Line
                    type="monotone"
                    dataKey="cleaning_ma4"
                    stroke={BRAND.colors.black}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    name="MA(4) bags"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="h-[300px] rounded-xl border border-black p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]">Urban Management Incidents Trend</p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={initialData.trends} margin={{ top: 8, right: 18, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#000000" opacity={0.25} />
                  <XAxis dataKey="week_label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ paddingTop: 8, paddingBottom: 8 }} />
                  <Line type="monotone" dataKey="urban_total" stroke={URBAN_TREND_COLOR} strokeWidth={2} dot={false} name="Weekly incidents" />
                  <Line
                    type="monotone"
                    dataKey="urban_ma4"
                    stroke={BRAND.colors.black}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    name="MA(4) incidents"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="h-[300px] rounded-xl border border-black p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]">Calls + WhatsApp Trend</p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={initialData.trends} margin={{ top: 8, right: 18, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#000000" opacity={0.25} />
                  <XAxis dataKey="week_label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ paddingTop: 8, paddingBottom: 8 }} />
                  <Line type="monotone" dataKey="contacts_total" stroke={CONTACTS_TREND_COLOR} strokeWidth={2} dot={false} name="Weekly calls + WhatsApp" />
                  <Line
                    type="monotone"
                    dataKey="contacts_total_ma4"
                    stroke={BRAND.colors.black}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    name="MA(4) calls + WhatsApp"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          </section>
        ) : null}

        {activeTab === "c3" ? (
          <section id="c3" className="card-frame rounded-2xl border-2 border-black bg-white p-4 md:p-6">
          <SectionHeading
            title="C3 Efficiency Tracker"
            description="Cumulative City service requests logged vs resolved by category across all reported weeks."
            icon="c3"
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryMetricCard label="Total Logged" current={c3OverallTotals.logged} previous={null} />
            <SummaryMetricCard label="Total Resolved" current={c3OverallTotals.resolved} previous={null} />
            <SummaryMetricCard label="Open Backlog" current={c3OverallTotals.backlog} previous={null} />
            <SummaryMetricCard
              label="Resolution Rate"
              current={c3OverallResolutionRatio === null ? null : Math.round(c3OverallResolutionRatio * 100)}
              previous={null}
              valueSuffix="%"
            />
          </div>

          <div className="mt-4 h-[340px] rounded-xl border border-black p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={c3OverallBreakdown} margin={{ top: 8, right: 8, left: 0, bottom: 70 }}>
                <defs>
                  <pattern id="resolvedHatch" patternUnits="userSpaceOnUse" width="8" height="8">
                    <rect width="8" height="8" fill="#F3F4F6" />
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
          <div className="mx-auto w-full max-w-6xl px-4 py-5 text-sm text-[#999999]">
            Copyright © 2025 - Lower Gardens City Improvement District.
          </div>
        </div>
      </footer>
    </main>
  );
}
