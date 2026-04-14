"use client";

import { startTransition, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import Image from "next/image";
import clsx from "clsx";
import { format, parseISO } from "date-fns";
import {
  AlertCircle,
  Building2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  File,
  FileText,
  BookOpenText,
  House,
  Leaf,
  OctagonAlert,
  OctagonX,
  PersonStanding,
  Phone,
  PhoneCall,
  Printer,
  Scale,
  Shield,
  SquareUserRound,
  Trees,
  TrendingUp,
  Trash2,
  type LucideIcon,
  Waves
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  type DefaultLegendContentProps,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  type TooltipValueType,
  XAxis,
  YAxis
} from "recharts";
import {
  DASHBOARD_TERMS_INTRO,
  DASHBOARD_TERMS_SECTIONS,
  DASHBOARD_TERMS_TITLE,
  type DashboardTermsSection
} from "@/lib/dashboard-terms";
import { BRAND, HOTSPOT_LIMIT, NO_DATA_LABEL } from "@/lib/config";
import {
  type DashboardPdfDetail,
  type DashboardPdfDetailLine,
  SUMMARY_IMAGE_EXPORT_HEIGHT,
  SUMMARY_IMAGE_EXPORT_WIDTH,
  exportDashboardPdf,
  exportNodePng
} from "@/lib/dashboard-export";
import {
  SUMMARY_PERIOD_OPTIONS,
  buildSummaryReportingOptions,
  findSummaryReportingOption
} from "@/lib/summary-periods";
import type {
  C3TrackerBreakdownRow,
  DashboardC3Data,
  DashboardPageData,
  DashboardSummaryMetrics,
  DashboardSummaryPeriodData,
  DashboardTrendsData,
  MetricComparisonRow,
  SummaryPeriod,
  TrendChartPoint,
  TrendGranularity,
} from "@/types/dashboard";

type Props = {
  initialData: DashboardPageData;
  initialTab?: DashboardTab;
};

type MetricTheme = "safety" | "cleaning" | "social" | "parks" | "neutral";
type SectionIconKind = "summary" | "currentWeek" | "incidents" | "trends" | "c3";
type ComparisonTone = "increase" | "decrease" | "flat" | "none";
type StandardDashboardTab = "main" | "summary" | "trends" | "c3";
type DashboardTab = StandardDashboardTab | "summary-image";
type SummaryInfographicGroupId =
  | "safety_response"
  | "law_enforcement"
  | "general_incidents"
  | "cleaning_maintenance"
  | "social_services"
  | "control_room_engagement"
  | "parks";
type SummaryInfographicIconKind =
  | "publicSpace"
  | "generalIncidents"
  | "crime"
  | "arrests"
  | "proactive"
  | "cleaning"
  | "drain"
  | "shelter"
  | "tree"
  | "cleaningBags"
  | "parksBags"
  | "logged"
  | "file"
  | "calls"
  | "touchPoints";

type SummaryInfographicGroup = {
  id: SummaryInfographicGroupId;
  title: string;
  description: ReactNode;
  accent: string;
  headingAccent?: string;
  background?: string;
  headerTextColor?: string;
  iconColor?: string;
};

const SECTION_NOTICE_EXPLANATIONS = {
  combined: [
    "Section 56 notices are summons issued to court for by-law infringements.",
    "Section 341 notices are fines issued with respect to vehicles."
  ],
  section56: "Section 56 notices are summons issued to court for by-law infringements.",
  section341: "Section 341 notices are fines issued with respect to vehicles."
} as const;

function InlineDefinitionTooltip({
  label,
  details
}: {
  label: string;
  details: readonly string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <span
      ref={containerRef}
      className={clsx("inline-definition-tooltip", isOpen && "inline-definition-tooltip--open")}
    >
      <button
        type="button"
        className="inline-definition-tooltip__trigger"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        {label}
      </button>
      <div
        className="inline-definition-tooltip__panel"
        hidden={!isOpen}
        role="tooltip"
      >
        {details.map((detail) => (
          <p key={detail} className="inline-definition-tooltip__text">
            {detail}
          </p>
        ))}
      </div>
    </span>
  );
}

type SummaryInfographicMetricDefinition = {
  id: keyof DashboardSummaryMetrics;
  label: string;
  icon: SummaryInfographicIconKind;
  groupId: SummaryInfographicGroupId;
};

type SummaryInfographicMetric = SummaryInfographicMetricDefinition & {
  current: number | null | undefined;
  previous: number | null | undefined;
};

type SummaryInfographicGroupWithMetrics = SummaryInfographicGroup & {
  metrics: SummaryInfographicMetric[];
};

const CURRENT_WEEK_THEME = {
  safety: {
    accent: BRAND.colors.safety,
    headerBackground: BRAND.colors.safetyBackground,
    iconBackground: BRAND.colors.safety,
    iconColor: BRAND.colors.black
  },
  cleaning: {
    accent: BRAND.colors.cleaning,
    headerBackground: BRAND.colors.cleaningBackground,
    iconBackground: BRAND.colors.cleaning,
    iconColor: BRAND.colors.black
  },
  social: {
    accent: BRAND.colors.social,
    headerBackground: BRAND.colors.socialBackground,
    iconBackground: BRAND.colors.social,
    iconColor: BRAND.colors.white
  },
  parks: {
    accent: BRAND.colors.parks,
    headerBackground: BRAND.colors.parksBackground,
    iconBackground: BRAND.colors.parks,
    iconColor: BRAND.colors.white
  },
  law: {
    accent: BRAND.colors.lawEnforcement,
    headerBackground: BRAND.colors.lawEnforcementBackground,
    iconBackground: BRAND.colors.lawEnforcement,
    iconColor: BRAND.colors.white
  },
  generalIncidents: {
    accent: BRAND.colors.generalIncidents,
    headerBackground: BRAND.colors.generalIncidentsBackground,
    iconBackground: BRAND.colors.generalIncidents,
    iconColor: BRAND.colors.white
  },
  neutral: {
    accent: BRAND.colors.neutralStrong,
    headerBackground: BRAND.colors.neutralBackground,
    iconBackground: BRAND.colors.neutralStrong,
    iconColor: BRAND.colors.white
  }
} as const;

const DASHBOARD_TABS: Array<{ id: StandardDashboardTab; label: string }> = [
  { id: "summary", label: "Summary" },
  { id: "main", label: "Current Week" },
  { id: "trends", label: "Trends" },
  { id: "c3", label: "C3 Tracker" }
];

const SUMMARY_IMAGE_TABS: Array<{ id: DashboardTab; label: string }> = [
  ...DASHBOARD_TABS,
  { id: "summary-image", label: "Summary Image" }
];
const TREND_GRANULARITY_OPTIONS: Array<{ id: TrendGranularity; label: string }> = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" }
];

const DASHBOARD_ROUTE_BY_TAB: Record<StandardDashboardTab, string> = {
  summary: "/",
  main: "/current-week",
  trends: "/trends",
  c3: "/c3-tracker"
};

function routeTabFromPathname(pathname: string): StandardDashboardTab {
  switch (pathname) {
    case "/current-week":
      return "main";
    case "/trends":
      return "trends";
    case "/c3-tracker":
      return "c3";
    default:
      return "summary";
  }
}

function getTermsAccentStyles(section: DashboardTermsSection) {
  switch (section.accentToken) {
    case "safety":
      return {
        iconBackground: BRAND.colors.safety,
        sectionBorder: BRAND.colors.safety
      };
    case "cleaning":
      return {
        iconBackground: BRAND.colors.cleaning,
        sectionBorder: BRAND.colors.cleaning
      };
    case "social":
      return {
        iconBackground: BRAND.colors.social,
        sectionBorder: BRAND.colors.social
      };
    case "parks":
      return {
        iconBackground: BRAND.colors.parks,
        sectionBorder: BRAND.colors.parks
      };
    case "lawEnforcement":
      return {
        iconBackground: BRAND.colors.lawEnforcement,
        sectionBorder: BRAND.colors.lawEnforcement
      };
    case "generalIncidents":
      return {
        iconBackground: BRAND.colors.generalIncidents,
        sectionBorder: BRAND.colors.generalIncidents
      };
    default:
      return {
        iconBackground: BRAND.colors.neutralBackground,
        sectionBorder: BRAND.colors.borderSubtle
      };
  }
}

const SUMMARY_INFOGRAPHIC_GROUPS: SummaryInfographicGroup[] = [
  {
    id: "safety_response",
    title: "Public Safety",
    description: "Crime and crime prevention activities",
    accent: BRAND.colors.safety,
    background: BRAND.colors.safetyBackground,
    headerTextColor: BRAND.colors.textStrong,
    iconColor: BRAND.colors.black
  },
  {
    id: "law_enforcement",
    title: "Law Enforcement",
    description: (
      <>
        Total fines issued (
        <InlineDefinitionTooltip label="Section 56 + 341" details={SECTION_NOTICE_EXPLANATIONS.combined} />
        )
      </>
    ),
    accent: BRAND.colors.lawEnforcement,
    headingAccent: BRAND.colors.lawEnforcement,
    background: BRAND.colors.lawEnforcementBackground,
    headerTextColor: BRAND.colors.textStrong,
    iconColor: BRAND.colors.white
  },
  {
    id: "general_incidents",
    title: "General Incidents",
    description: "Operational incidents and actions",
    accent: BRAND.colors.generalIncidents,
    headingAccent: BRAND.colors.generalIncidents,
    background: BRAND.colors.generalIncidentsBackground,
    headerTextColor: BRAND.colors.textStrong,
    iconColor: BRAND.colors.white
  },
  {
    id: "cleaning_maintenance",
    title: "Cleaning & Maintenance",
    description: "Street and public area maintenance",
    accent: BRAND.colors.cleaning,
    background: BRAND.colors.cleaningBackground,
    headerTextColor: BRAND.colors.textStrong,
    iconColor: BRAND.colors.black
  },
  {
    id: "social_services",
    title: "Social Services",
    description: "Engagements with the vulnerable",
    accent: BRAND.colors.social,
    background: BRAND.colors.socialBackground,
    headerTextColor: BRAND.colors.textStrong,
    iconColor: BRAND.colors.white
  },
  {
    id: "parks",
    title: "Parks & Recreation",
    description: "Management of public green spaces",
    accent: BRAND.colors.parks,
    background: BRAND.colors.parksBackground,
    headerTextColor: BRAND.colors.textStrong,
    iconColor: BRAND.colors.black
  },
  {
    id: "control_room_engagement",
    title: "Control Room Engagement",
    description: "Reporting to the 24-hour control room",
    accent: BRAND.colors.neutralStrong,
    headingAccent: BRAND.colors.neutralStrong,
    background: BRAND.colors.neutralBackground,
    headerTextColor: BRAND.colors.textStrong,
    iconColor: BRAND.colors.white
  }
];

const SUMMARY_INFOGRAPHIC_RENDER_ORDER: SummaryInfographicGroupId[] = [
  "safety_response",
  "cleaning_maintenance",
  "law_enforcement",
  "general_incidents",
  "social_services",
  "parks",
  "control_room_engagement"
];

const SUMMARY_INFOGRAPHIC_ROWS: SummaryInfographicGroupId[][] = [
  ["safety_response", "cleaning_maintenance"],
  ["law_enforcement", "general_incidents", "social_services"],
  ["parks", "control_room_engagement"]
];

const SUMMARY_INFOGRAPHIC_METRICS: SummaryInfographicMetricDefinition[] = [
  { id: "criminal_incidents", label: "Criminal incidents", icon: "crime", groupId: "safety_response" },
  { id: "arrests_made", label: "Arrests", icon: "arrests", groupId: "safety_response" },
  { id: "proactive_actions", label: "Stop and Search", icon: "proactive", groupId: "safety_response" },
  {
    id: "public_space_interventions",
    label: "Public space interventions",
    icon: "publicSpace",
    groupId: "safety_response"
  },
  { id: "fines_issued", label: "Fines issued", icon: "file", groupId: "law_enforcement" },
  { id: "general_incidents_total", label: "Total incidents", icon: "generalIncidents", groupId: "general_incidents" },
  {
    id: "cleaning_total_bags",
    label: "Cleaning bags collected",
    icon: "cleaningBags",
    groupId: "cleaning_maintenance"
  },
  { id: "cleaning_servitudes_cleaned", label: "Servitudes cleaned", icon: "shelter", groupId: "cleaning_maintenance" },
  {
    id: "cleaning_stormwater_drains_cleaned",
    label: "Stormwater drains cleaned",
    icon: "drain",
    groupId: "cleaning_maintenance"
  },
  {
    id: "social_touch_points",
    label: "Touch points",
    icon: "touchPoints",
    groupId: "social_services"
  },
  { id: "c3_logged_total", label: "C3 logged requests", icon: "logged", groupId: "control_room_engagement" },
  { id: "contacts_total", label: "Calls + WhatsApp received", icon: "calls", groupId: "control_room_engagement" },
  {
    id: "parks_total_bags",
    label: "Bags",
    icon: "parksBags",
    groupId: "parks"
  },
  { id: "parks_pruned_trees", label: "Pruned trees", icon: "tree", groupId: "parks" }
];

const SUMMARY_IMAGE_LAYOUT: Array<
  Array<{
    groupId: SummaryInfographicGroupId;
    iconPath?: string;
    iconScale?: number;
    iconComponent?: LucideIcon;
    description: string;
    metrics: Array<{ id: string; label: string; spanTwoColumns?: boolean }>;
    wide?: boolean;
  }>
> = [
  [
    {
      groupId: "safety_response",
      iconPath: "/icons/safety.svg",
      iconScale: 1.02,
      description: "Crime and crime prevention activities",
      metrics: [
        { id: "criminal_incidents", label: "Criminal incidents" },
        { id: "arrests_made", label: "Arrests" },
        { id: "proactive_actions", label: "Stop and Search" },
        { id: "public_space_interventions", label: "Public Space Interventions" }
      ]
    },
    {
      groupId: "cleaning_maintenance",
      iconPath: "/icons/cleaning.svg",
      iconScale: 1,
      description: "Street and public area cleaning and maintenance",
      metrics: [
        { id: "cleaning_total_bags", label: "Bags Collected" },
        { id: "cleaning_servitudes_cleaned", label: "Servitudes Cleaned" },
        { id: "cleaning_stormwater_drains_cleaned", label: "Stormwater Drains\nCleaned", spanTwoColumns: true }
      ]
    }
  ],
  [
    {
      groupId: "parks",
      iconPath: "/icons/parks.svg",
      iconScale: 1,
      description: "Maintenance of green spaces and public areas",
      metrics: [
        { id: "parks_total_bags", label: "Bags" },
        { id: "parks_pruned_trees", label: "Pruned Trees" }
      ]
    },
    {
      groupId: "social_services",
      iconPath: "/icons/social%20services.svg",
      iconScale: 1,
      description: "Engagements with the homeless and vulnerable",
      metrics: [{ id: "social_touch_points", label: "Touch points", spanTwoColumns: true }]
    }
  ],
  [
    {
      groupId: "law_enforcement",
      iconComponent: Scale,
      description: "Total fines issued  (Section 56 + Section 341)",
      metrics: [{ id: "fines_issued", label: "Fines Issued", spanTwoColumns: true }]
    },
    {
      groupId: "general_incidents",
      iconComponent: Building2,
      description: "Operational incidents and actions",
      metrics: [{ id: "general_incidents_total", label: "Total Incidents", spanTwoColumns: true }]
    }
  ],
  [
    {
      groupId: "control_room_engagement",
      iconComponent: PhoneCall,
      description: "Reporting to the 24-hour control room",
      metrics: [
        { id: "c3_logged_total", label: "C3 Logged Requests" },
        { id: "contacts_total", label: "Total Calls + WhatsApp Received" }
      ],
      wide: true
    }
  ]
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

function colorToRgb(color: string): { r: number; g: number; b: number } | null {
  const normalized = color.trim().toLowerCase();
  const shortHexMatch = normalized.match(/^#([0-9a-f]{3})$/i);
  if (shortHexMatch) {
    const [r, g, b] = shortHexMatch[1].split("").map((channel) => Number.parseInt(`${channel}${channel}`, 16));
    return { r, g, b };
  }

  const hexMatch = normalized.match(/^#([0-9a-f]{6})$/i);
  if (hexMatch) {
    const value = hexMatch[1];
    return {
      r: Number.parseInt(value.slice(0, 2), 16),
      g: Number.parseInt(value.slice(2, 4), 16),
      b: Number.parseInt(value.slice(4, 6), 16)
    };
  }

  const rgbMatch = normalized.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (rgbMatch) {
    return {
      r: Number.parseInt(rgbMatch[1], 10),
      g: Number.parseInt(rgbMatch[2], 10),
      b: Number.parseInt(rgbMatch[3], 10)
    };
  }

  return null;
}

function tooltipTextColorForBackground(color: string): string {
  const rgb = colorToRgb(color);
  if (!rgb) {
    return BRAND.colors.black;
  }

  const luminance = (0.299 * rgb.r) + (0.587 * rgb.g) + (0.114 * rgb.b);
  return luminance > 150 ? BRAND.colors.black : BRAND.colors.white;
}

type TooltipNameType = string | number;
type TooltipSwatchStyle = "solid" | "dashed" | "dotted" | "hatched" | "block" | "lineDot";
type TooltipPayloadEntry = NonNullable<TooltipContentProps<TooltipValueType, TooltipNameType>["payload"]>[number];
type TooltipSeriesConfig = {
  label?: string;
  color?: string;
  swatchStyle?: TooltipSwatchStyle;
  valueBackgroundColor?: string;
  valueBorderColor?: string;
  valueTextColor?: string;
};
type TooltipRowDefinition = {
  key: string;
  label: string;
  value: TooltipValueType | undefined;
  color: string;
  swatchStyle: TooltipSwatchStyle;
  valueBackgroundColor: string;
  valueBorderColor?: string;
  valueTextColor: string;
};

const RESPONSIVE_CHART_INITIAL_DIMENSION = { width: 1, height: 1 } as const;

const C3_TOOLTIP_SERIES_CONFIG: Record<string, TooltipSeriesConfig> = {
  logged: {
    label: "Logged",
    color: BRAND.colors.black,
    swatchStyle: "block"
  },
  resolved: {
    label: "Resolved",
    color: BRAND.colors.trendAverage,
    swatchStyle: "block",
    valueBackgroundColor: BRAND.colors.trendAverage,
    valueBorderColor: BRAND.colors.trendAverage
  }
};

const C3_BACKLOG_TOOLTIP_SERIES_CONFIG: Record<string, TooltipSeriesConfig> = {
  backlog: {
    label: "Open backlog",
    color: BRAND.colors.black,
    swatchStyle: "block"
  }
};

function formatTrendTooltipValue(value: TooltipValueType | undefined): string {
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return NO_DATA_LABEL;
}

function resolveTooltipEntryColor(entry: TooltipPayloadEntry, configuredColor?: string): string {
  if (configuredColor) {
    return configuredColor;
  }

  const rawColorCandidates = [
    entry.color,
    (entry as { stroke?: string }).stroke,
    (entry as { fill?: string }).fill
  ];
  const rawColor = rawColorCandidates.find(
    (candidate): candidate is string => typeof candidate === "string" && !candidate.startsWith("url(")
  );

  return rawColor ?? BRAND.colors.black;
}

function buildTooltipRows(
  payload: readonly TooltipPayloadEntry[],
  seriesConfig?: Record<string, TooltipSeriesConfig>
): TooltipRowDefinition[] {
  return payload.map((entry, index) => {
    const dataKey = String(entry.dataKey ?? entry.name ?? index);
    const config = seriesConfig?.[dataKey] ?? {};
    const color = resolveTooltipEntryColor(entry, config.color);
    const swatchStyle = config.swatchStyle ?? (typeof entry.dataKey === "string" && entry.dataKey.endsWith("_ma4") ? "dotted" : "solid");
    const valueBackgroundColor = config.valueBackgroundColor ?? color;
    const valueTextColor = config.valueTextColor ?? tooltipTextColorForBackground(valueBackgroundColor);

    return {
      key: dataKey,
      label: config.label ?? String(entry.name ?? "Value"),
      value: entry.value,
      color,
      swatchStyle,
      valueBackgroundColor,
      valueBorderColor: config.valueBorderColor,
      valueTextColor
    };
  });
}

function TooltipSwatch({
  color,
  style
}: {
  color: string;
  style: TooltipSwatchStyle;
}) {
  if (style === "hatched") {
    return (
      <span
        className="inline-block h-3 w-5 rounded-[4px] border"
        style={{
          borderColor: color,
          backgroundColor: BRAND.colors.white,
          backgroundImage: `repeating-linear-gradient(135deg, ${color} 0 2px, transparent 2px 5px)`
        }}
      />
    );
  }

  if (style === "block") {
    return (
      <span
        className="inline-block h-3 w-5 rounded-[4px] border"
        style={{
          borderColor: color,
          backgroundColor: color
        }}
      />
    );
  }

  if (style === "lineDot") {
    return (
      <span className="inline-flex h-3.5 w-6 items-center" aria-hidden>
        <span className="block h-0.5 w-full rounded-full" style={{ backgroundColor: color }}>
          <span
            className="relative top-[-5px] mx-auto block h-2.5 w-2.5 rounded-full border-2 bg-white"
            style={{ borderColor: color }}
          />
        </span>
      </span>
    );
  }

  return (
    <span
      className={clsx(
        "inline-block w-5",
        style === "dotted" ? "border-t-2" : "border-t-[3px]"
      )}
      style={{
        borderTopColor: color,
        borderTopStyle: style === "dashed" ? "dashed" : style === "dotted" ? "dotted" : "solid"
      }}
    />
  );
}

function ChartTooltipCard({
  title,
  rows,
  showSwatch = true,
  descriptions
}: {
  title: string;
  rows: TooltipRowDefinition[];
  showSwatch?: boolean;
  descriptions?: string[];
}) {
  return (
    <div
      className="rounded-lg border bg-white px-5 py-4"
      style={{
        width: "min(20rem, calc(100vw - 2rem))",
        borderColor: BRAND.colors.borderSubtle,
        boxShadow: `0 12px 28px ${BRAND.colors.shadowStrong}`
      }}
    >
      <p className="text-lg font-semibold leading-none" style={{ fontFamily: "var(--font-heading)" }}>
        {title || NO_DATA_LABEL}
      </p>

      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-2.5">
            {showSwatch ? <TooltipSwatch color={row.color} style={row.swatchStyle} /> : null}
            <span className="text-[16px] leading-none text-black">{row.label}:</span>
            <span
              className="ml-auto inline-flex min-w-8 items-center justify-center rounded-md border px-2 py-1 text-[16px] font-semibold leading-none"
              style={{
                backgroundColor: row.valueBackgroundColor,
                borderColor: row.valueBorderColor ?? "transparent",
                color: row.valueTextColor
              }}
            >
              {formatTrendTooltipValue(row.value)}
            </span>
          </div>
        ))}
      </div>

      {descriptions?.length ? (
        <div className="mt-4 space-y-2 border-t pt-3" style={{ borderColor: BRAND.colors.borderSubtle }}>
          {descriptions.map((description) => (
            <p key={description} className="text-[13px] leading-5" style={{ color: BRAND.colors.textMuted }}>
              {description}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CategoricalTooltip({
  active,
  payload,
  label,
  labelKey,
  seriesConfig,
  descriptionByLabel
}: TooltipContentProps<TooltipValueType, TooltipNameType> & {
  labelKey: string;
  seriesConfig?: Record<string, TooltipSeriesConfig>;
  descriptionByLabel?: Record<string, string[]>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const chartPoint = payload[0]?.payload as Record<string, string | number> | undefined;
  const title = typeof label === "string" || typeof label === "number"
    ? String(label)
    : chartPoint && chartPoint[labelKey] !== undefined
      ? String(chartPoint[labelKey])
      : "";

  return (
    <ChartTooltipCard
      title={title}
      rows={buildTooltipRows(payload, seriesConfig)}
      showSwatch={false}
      descriptions={descriptionByLabel?.[title]}
    />
  );
}

function TrendTooltip({
  active,
  payload
}: TooltipContentProps<TooltipValueType, TooltipNameType>) {
  if (!active || !payload?.length) {
    return null;
  }

  const chartPoint = payload[0]?.payload as TrendChartPoint | undefined;
  const dateLabel = chartPoint?.period_start ? formatWeekDate(chartPoint.period_start) : "";

  return (
    <ChartTooltipCard
      title={dateLabel}
      rows={buildTooltipRows(payload, {
        criminal_incidents: { swatchStyle: "solid" },
        criminal_ma4: { swatchStyle: "dotted" },
        cleaning_bags_collected: { swatchStyle: "solid" },
        cleaning_ma4: { swatchStyle: "dotted" },
        social_touch_points: { swatchStyle: "solid" },
        social_touch_points_ma4: { swatchStyle: "dotted" },
        parks_total_bags: { swatchStyle: "solid" },
        parks_total_bags_ma4: { swatchStyle: "dotted" },
        fines_total: { swatchStyle: "solid" },
        fines_total_ma4: { swatchStyle: "dotted" },
        general_incidents_total: { swatchStyle: "solid" },
        general_incidents_ma4: { swatchStyle: "dotted" },
        contacts_total: { swatchStyle: "solid" },
        contacts_total_ma4: { swatchStyle: "dotted" },
        c3_logged_total: { swatchStyle: "solid" },
        c3_logged_total_ma4: { swatchStyle: "dotted" }
      })}
    />
  );
}

function TrendLegend({
  payload
}: DefaultLegendContentProps) {
  if (!payload?.length) {
    return null;
  }

  const sorted = [...payload].sort((left, right) => {
    const leftIsAverage = typeof left.dataKey === "string" && left.dataKey.endsWith("_ma4");
    const rightIsAverage = typeof right.dataKey === "string" && right.dataKey.endsWith("_ma4");

    if (leftIsAverage === rightIsAverage) {
      return 0;
    }

    return leftIsAverage ? 1 : -1;
  });

  return (
    <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] md:text-[13px]">
      {sorted.map((entry, index) => {
        const color = entry.color ?? BRAND.colors.black;
        const key = `${entry.dataKey ?? entry.value ?? index}`;

        return (
          <li key={key} className="flex items-center gap-2">
            <span
              className="inline-block h-5 w-5 rounded-[4px]"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <span style={{ color: BRAND.colors.black }}>{entry.value}</span>
          </li>
        );
      })}
    </ul>
  );
}

function getTrendXAxisInterval(length: number, granularity: TrendGranularity): number {
  if (granularity !== "week") {
    return 0;
  }

  return Math.max(0, Math.ceil(length / 6) - 1);
}

type TrendCardProps = {
  title: string;
  dataKey: keyof TrendChartPoint;
  averageKey: keyof TrendChartPoint;
  stroke: string;
  dataName: string;
  averageName: string;
  data: TrendChartPoint[];
  granularity: TrendGranularity;
};

function TrendLineCard({
  title,
  dataKey,
  averageKey,
  stroke,
  dataName,
  averageName,
  data,
  granularity
}: TrendCardProps) {
  return (
    <div className="rounded-[28px] border bg-white px-4 pb-4 pt-5 md:px-5 md:pb-5" style={{ borderColor: BRAND.colors.borderSubtle, boxShadow: `0 2px 10px ${BRAND.colors.shadowSoft}` }}>
      <h3 className="dashboard-heading-3 dashboard-heading-3--compact mb-3 pb-4" style={{ ["--dashboard-heading-color" as string]: BRAND.colors.textStrong }}>{title}</h3>
      <div className="min-h-0 min-w-0 h-[280px] md:h-[300px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={RESPONSIVE_CHART_INITIAL_DIMENSION}>
          <LineChart data={data} margin={{ top: 4, right: 20, left: -6, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke={BRAND.colors.gridSubtle} strokeDasharray="3 6" />
            <XAxis
              dataKey="period_label"
              axisLine={false}
              tickLine={false}
              interval={getTrendXAxisInterval(data.length, granularity)}
              minTickGap={28}
              tick={{ fontSize: 12, fill: BRAND.colors.trendAxis }}
              tickMargin={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: BRAND.colors.trendAxis }}
              tickMargin={4}
              width={40}
            />
            <Tooltip content={(props) => <TrendTooltip {...props} />} />
            <Legend verticalAlign="bottom" align="center" content={(props) => <TrendLegend {...props} />} />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={stroke}
              strokeWidth={3.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: stroke, fill: BRAND.colors.white }}
              name={dataName}
            />
            <Line
              type="monotone"
              dataKey={averageKey}
              stroke={BRAND.colors.neutralMedium}
              strokeWidth={2.25}
              strokeDasharray="3 6"
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: BRAND.colors.neutralMedium, fill: BRAND.colors.white }}
              name={averageName}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function IncidentCategoryTag({ category, compact = false }: { category: string; compact?: boolean }) {
  const labels = category
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!labels.length) {
    return null;
  }

  return (
    <>
      {labels.map((label, index) => (
        <span
          key={`${label}-${index}`}
          className={clsx(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold normal-case tracking-normal",
            compact ? "text-[9px]" : "text-[10px]"
          )}
          style={{ borderColor: BRAND.colors.safety, backgroundColor: BRAND.colors.safety, color: BRAND.colors.black }}
        >
          {label}
        </span>
      ))}
    </>
  );
}

function wrapChartLabel(label: string, maxLineLength = 16): string[] {
  const words = label.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length > maxLineLength && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, 3);
}

function ChartCategoryTick({
  x,
  y,
  payload
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const label = payload?.value ?? "";
  const lines = wrapChartLabel(label);
  const lineHeight = 12;
  const startOffset = -((lines.length - 1) * lineHeight) / 2;

  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text
        x={0}
        y={0}
        textAnchor="end"
        fill={BRAND.colors.trendAxis}
        fontSize="11"
        dominantBaseline="middle"
      >
        {lines.map((line, index) => (
          <tspan key={`${label}-${index}`} x={0} dy={index === 0 ? startOffset : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
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

function buildExportDateToken(start: string, end: string): string {
  return `${start}_to_${end}`;
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

function SectionIcon({ kind, className }: { kind: SectionIconKind; className?: string }) {
  if (kind === "summary") {
    return <FileText className={className} strokeWidth={1.8} aria-hidden />;
  }

  if (kind === "currentWeek") {
    return <FileText className={className} strokeWidth={1.8} aria-hidden />;
  }

  if (kind === "incidents") {
    return <OctagonAlert className={className} strokeWidth={1.8} aria-hidden />;
  }

  if (kind === "trends") {
    return <TrendingUp className={className} strokeWidth={1.8} aria-hidden />;
  }

  return <ClipboardList className={className} strokeWidth={1.8} aria-hidden />;
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
  description?: React.ReactNode;
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
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
          style={{
            borderColor: iconBackground ?? BRAND.colors.textStrong,
            backgroundColor: iconBackground ?? (accent ? (accentColor ?? BRAND.colors.safety) : BRAND.colors.white),
            color: iconColor ?? BRAND.colors.black
          }}
        >
          <SectionIcon kind={icon} className="h-5 w-5" />
        </span>
        <h3 className="dashboard-heading-3" style={{ ["--dashboard-heading-color" as string]: BRAND.colors.textStrong }}>{title}</h3>
      </div>
      {description ? <p className="mt-3 text-[1.06rem]" style={{ color: BRAND.colors.textMuted }}>{description}</p> : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  children,
  mobileChildren,
  inlineLabelOnMobile = false,
  disabled = false
}: {
  id: string;
  label: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  children: React.ReactNode;
  mobileChildren?: React.ReactNode;
  inlineLabelOnMobile?: boolean;
  disabled?: boolean;
}) {
  const labelId = `${id}-label`;
  const selectClassName = "w-full min-w-0 appearance-none rounded-[6px] border bg-white px-4 py-2 pr-10 font-[var(--font-body)] text-[1rem] text-black outline-none";

  return (
    <div className={clsx(inlineLabelOnMobile && "grid grid-cols-[6.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 md:block")}>
      <label
        id={labelId}
        htmlFor={id}
        className={clsx(
          "font-[var(--font-heading)] text-[0.92rem] font-medium tracking-[-0.01em] text-black/80",
          inlineLabelOnMobile ? "max-w-[6.25rem] leading-[1.15] md:block md:max-w-none md:leading-normal" : "block"
        )}
      >
        {label}
      </label>
      <div className={clsx("relative min-w-0", inlineLabelOnMobile ? "md:mt-2" : "mt-2")}>
        {mobileChildren ? (
          <>
            <select
              id={`${id}-mobile`}
              aria-labelledby={labelId}
              value={value}
              onChange={onChange}
              disabled={disabled}
              className={clsx(selectClassName, "md:hidden")}
              style={{ borderColor: BRAND.colors.borderSubtle, boxShadow: `0 1px 2px ${BRAND.colors.overlaySubtle}` }}
            >
              {mobileChildren}
            </select>
            <select
              id={id}
              aria-labelledby={labelId}
              value={value}
              onChange={onChange}
              disabled={disabled}
              className={clsx(selectClassName, "hidden md:block")}
              style={{ borderColor: BRAND.colors.borderSubtle, boxShadow: `0 1px 2px ${BRAND.colors.overlaySubtle}` }}
            >
              {children}
            </select>
          </>
        ) : (
          <select
            id={id}
            aria-labelledby={labelId}
            value={value}
            onChange={onChange}
            disabled={disabled}
            className={selectClassName}
            style={{ borderColor: BRAND.colors.borderSubtle, boxShadow: `0 1px 2px ${BRAND.colors.overlaySubtle}` }}
          >
            {children}
          </select>
        )}
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/70" aria-hidden />
      </div>
    </div>
  );
}

function DateField({
  id,
  label,
  value,
  min,
  max,
  onChange,
  inlineLabelOnMobile = false,
  disabled = false
}: {
  id: string;
  label: string;
  value: string;
  min: string;
  max: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  inlineLabelOnMobile?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={clsx(inlineLabelOnMobile && "grid grid-cols-[6.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 md:block")}>
      <label
        htmlFor={id}
        className={clsx(
          "font-[var(--font-heading)] text-[0.92rem] font-medium tracking-[-0.01em] text-black/80",
          inlineLabelOnMobile ? "max-w-[6.25rem] leading-[1.15] md:block md:max-w-none md:leading-normal" : "block"
        )}
      >
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={onChange}
        disabled={disabled}
        className={clsx(
          "w-full rounded-[6px] border bg-white px-0 py-2 font-[var(--font-body)] text-[1rem] text-black outline-none sm:px-4",
          inlineLabelOnMobile ? "md:mt-2" : "mt-2"
        )}
        style={{ borderColor: BRAND.colors.borderSubtle, boxShadow: `0 1px 2px ${BRAND.colors.overlaySubtle}` }}
      />
    </div>
  );
}

function DashboardTopPanel({
  title,
  description,
  icon: Icon,
  controls,
  statusText
}: {
  title: string;
  description: React.ReactNode;
  icon: LucideIcon;
  controls?: React.ReactNode;
  statusText?: string;
}) {
  return (
    <div
      className="rounded-[24px] border bg-white px-6 py-6"
      style={{ borderColor: BRAND.colors.borderSubtle, boxShadow: `0 2px 8px ${BRAND.colors.shadowMedium}` }}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end">
        <div className="min-w-0 lg:flex-[1_1_24rem]">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black text-white">
              <Icon className="h-6 w-6" strokeWidth={2.1} aria-hidden />
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="dashboard-heading-2">
                {title}
              </h2>
              {statusText ? (
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-[0.78rem] font-semibold uppercase tracking-[0.06em]"
                  style={{ backgroundColor: BRAND.colors.neutralBackground, color: BRAND.colors.neutralStrong }}
                >
                  {statusText}
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-2 leading-7" style={{ color: BRAND.colors.textMuted }}>{description}</div>
        </div>
        {controls ? <div className="min-w-0 lg:flex-[1.35_1_34rem]">{controls}</div> : null}
      </div>
    </div>
  );
}

function DashboardTabButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-[12px] border-[1.5px] px-7 py-3 font-[var(--font-body)] text-[1rem] font-semibold transition-colors",
        active ? "border-black bg-black text-white" : "border-black bg-white text-black hover:border-black"
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function metricValueText(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return NO_DATA_LABEL;
  }
  return value.toLocaleString();
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

function buildSummaryInfographicGroups(summaryData: DashboardSummaryPeriodData): SummaryInfographicGroupWithMetrics[] {
  return SUMMARY_INFOGRAPHIC_GROUPS.map((group) => ({
    ...group,
    metrics: SUMMARY_INFOGRAPHIC_METRICS
      .filter((metric) => metric.groupId === group.id)
      .map((metric) => ({
        ...metric,
        current: summaryData.current.metrics[metric.id],
        previous: summaryData.previous.metrics[metric.id]
      }))
  }));
}

function buildSummaryDetailLines({
  currentLabel,
  previousLabel,
  coverageLabel,
  showCoverage,
  hasComparison
}: {
  currentLabel: string;
  previousLabel: string;
  coverageLabel: string | null;
  showCoverage: boolean;
  hasComparison: boolean;
}): DashboardPdfDetailLine[] {
  const lines: DashboardPdfDetailLine[] = [
    {
      type: "pair",
      label: "Detailed operational results across each CID focus area for:",
      value: currentLabel
    }
  ];

  if (showCoverage && coverageLabel) {
    lines.push({
      type: "pair",
      label: "Reporting weeks used:",
      value: coverageLabel
    });
  }

  if (hasComparison) {
    lines.push({
      type: "pair",
      label: "Compared with:",
      value: previousLabel
    });
  } else {
    lines.push({
      type: "note",
      text: "No earlier reporting weeks are available for comparison."
    });
  }

  return lines;
}

function SummaryInfographicIcon({ kind, className }: { kind: SummaryInfographicIconKind; className?: string }) {
  if (kind === "publicSpace") {
    return <SquareUserRound className={className} strokeWidth={1.7} aria-hidden />;
  }

  if (kind === "generalIncidents") {
    return <Building2 className={className} strokeWidth={1.7} aria-hidden />;
  }

  if (kind === "crime") {
    return <Shield className={className} strokeWidth={1.7} aria-hidden />;
  }

  if (kind === "arrests") {
    return <Scale className={className} strokeWidth={1.7} aria-hidden />;
  }

  if (kind === "proactive") {
    return <OctagonX className={className} strokeWidth={1.7} aria-hidden />;
  }

  if (kind === "cleaning") {
    return <Trash2 className={className} strokeWidth={1.7} aria-hidden />;
  }

  if (kind === "drain") {
    return <Waves className={className} strokeWidth={1.7} aria-hidden />;
  }

  if (kind === "shelter") {
    return <House className={className} strokeWidth={1.7} aria-hidden />;
  }

  if (kind === "tree") {
    return <Trees className={className} strokeWidth={1.7} aria-hidden />;
  }

  if (kind === "cleaningBags") {
    return <Trash2 className={className} strokeWidth={1.7} aria-hidden />;
  }

  if (kind === "parksBags") {
    return <Leaf className={className} strokeWidth={1.7} aria-hidden />;
  }

  if (kind === "logged") {
    return <ClipboardList className={className} strokeWidth={1.7} aria-hidden />;
  }

  if (kind === "file") {
    return <File className={className} strokeWidth={1.7} aria-hidden />;
  }

  if (kind === "calls") {
    return <Phone className={className} strokeWidth={1.7} aria-hidden />;
  }

  return <PersonStanding className={className} strokeWidth={1.7} aria-hidden />;
}

function SummaryInfographicRow({
  label,
  current,
  previous,
  accent,
  iconColor,
  icon,
  index
}: {
  label: string;
  current: number | null | undefined;
  previous: number | null | undefined;
  accent: string;
  iconColor: string;
  icon: SummaryInfographicIconKind;
  index: number;
}) {
  const delta = deltaSigned(current, previous);
  const hasValue = current !== null && current !== undefined && !Number.isNaN(current);
  const style = {
    ["--summary-accent" as string]: accent,
    ["--summary-icon-color" as string]: iconColor,
    ["--summary-index" as string]: String(index)
  } as CSSProperties;

  return (
    <article className="summary-ribbon" style={style}>
      <div className="summary-ribbon__icon-box">
        <SummaryInfographicIcon kind={icon} className="summary-ribbon__icon-glyph" />
      </div>
      <div className="summary-ribbon__body">
        <p className="summary-ribbon__label">{label}</p>
        <span
          className="summary-ribbon__delta"
          style={{
            backgroundColor: BRAND.colors.neutralBackground,
            color: BRAND.colors.neutralStrong,
            borderColor: "transparent"
          }}
        >
          {delta.text}
        </span>
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
    ["--summary-group-accent" as string]: group.headingAccent ?? group.accent,
    ["--summary-group-background" as string]: BRAND.colors.neutralBackground,
    ["--summary-group-text" as string]: group.headerTextColor ?? BRAND.colors.textStrong
  } as CSSProperties;

  const rowIconColor = group.iconColor ?? (group.accent === BRAND.colors.black ? BRAND.colors.white : BRAND.colors.black);

  return (
    <article className="summary-group-card">
      <div className="summary-group-card__header" style={groupStyle}>
        <h3
          className="summary-group-card__title dashboard-heading-3"
          style={{ ["--dashboard-heading-color" as string]: group.headerTextColor ?? BRAND.colors.textStrong }}
        >
          {group.title}
        </h3>
        <div className="summary-group-card__description">{group.description}</div>
      </div>

      <div className="summary-ribbon-list">
        {group.metrics.map((metric, metricIndex) => (
          <SummaryInfographicRow
            key={metric.id}
            label={metric.label}
            current={metric.current}
            previous={metric.previous}
            accent={group.accent}
            iconColor={rowIconColor}
            icon={metric.icon}
            index={groupIndex * 10 + metricIndex}
          />
        ))}
      </div>
    </article>
  );
}

function formatSummaryImageWeekRange(weekStart: string, weekEnd: string): string {
  return `${formatWeekDate(weekStart)} - ${formatWeekDate(weekEnd)}.`;
}

function SummaryImageMetric({
  value,
  label,
  spanTwoColumns = false
}: {
  value: number | null | undefined;
  label: string;
  spanTwoColumns?: boolean;
}) {
  return (
    <div className={clsx("summary-image-card__metric", spanTwoColumns && "summary-image-card__metric--span-2")}>
      <p className="summary-image-card__metric-value">{valueText(value)}</p>
      <p className="summary-image-card__metric-label">{label}</p>
    </div>
  );
}

function SummaryImageCard({
  title,
  description,
  accent,
  iconColor,
  iconPath,
  iconScale = 1,
  iconComponent: Icon,
  metrics,
  wide = false
}: {
  title: string;
  description: string;
  accent: string;
  iconColor: string;
  iconPath?: string;
  iconScale?: number;
  iconComponent?: LucideIcon;
  metrics: Array<{ id: string; label: string; value: number | null | undefined; spanTwoColumns?: boolean }>;
  wide?: boolean;
}) {
  const iconSize = Math.round(94 * iconScale);

  return (
    <article className={clsx("summary-image-card", wide && "summary-image-card--wide")} style={{ ["--summary-image-accent" as string]: accent }}>
      <div className="summary-image-card__header">
        <div className="summary-image-card__copy">
          <h3 className="summary-image-card__title">{title}</h3>
          <p className="summary-image-card__description">{description}</p>
        </div>
        <div
          className={clsx("summary-image-card__icon", iconPath && "summary-image-card__icon--asset")}
          style={iconPath ? undefined : { backgroundColor: accent, color: iconColor }}
        >
          {iconPath ? (
            <Image
              src={iconPath}
              alt=""
              width={iconSize}
              height={iconSize}
              className="summary-image-card__icon-asset"
              style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
              aria-hidden
              unoptimized
            />
          ) : Icon ? (
            <Icon className="summary-image-card__icon-glyph" strokeWidth={2.1} aria-hidden />
          ) : null}
        </div>
      </div>
        <div className={clsx("summary-image-card__metrics", wide && "summary-image-card__metrics--wide")}>
        {metrics.map((metric) => (
          <SummaryImageMetric key={metric.id} value={metric.value} label={metric.label} spanTwoColumns={metric.spanTwoColumns} />
        ))}
      </div>
    </article>
  );
}

function SummaryImageCanvas({
  selectedWeekRange,
  cards
}: {
  selectedWeekRange: string;
  cards: Array<
    Array<{
      groupId: SummaryInfographicGroupId;
      title: string;
      accent: string;
      iconColor: string;
      iconPath?: string;
      iconScale?: number;
      iconComponent?: LucideIcon;
      description: string;
      metrics: Array<{ id: string; label: string; value: number | null | undefined; spanTwoColumns?: boolean }>;
      wide?: boolean;
    }>
  >;
}) {
  return (
    <div className="summary-image-canvas">
      <div className="summary-image-canvas__hero">
        <img src="/logos/lgcid-horizontal-black.png" alt="Lower Gardens City Improvement District" className="summary-image-canvas__logo" />
        <h1 className="summary-image-canvas__title">Weekly Operational Performance</h1>
      </div>

      <div className="summary-image-canvas__body">
        <p className="summary-image-canvas__intro">Activity report showing the key metrics for:</p>
        <p className="summary-image-canvas__date">{selectedWeekRange}</p>

        <div className="summary-image-grid">
          {cards.map((row, rowIndex) => (
            <div key={`summary-image-row-${rowIndex}`} className={clsx("summary-image-grid__row", row.some((card) => card.wide) && "summary-image-grid__row--wide")}>
              {row.map((card) => (
                <SummaryImageCard
                  key={card.groupId}
                  title={card.title}
                  description={card.description}
                  accent={card.accent}
                  iconColor={card.iconColor}
                  iconPath={card.iconPath}
                  iconScale={card.iconScale}
                  iconComponent={card.iconComponent}
                  metrics={card.metrics}
                  wide={card.wide}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <footer className="summary-image-canvas__footer">
        <p className="summary-image-canvas__footer-copy">Report incidents to the CID Control Room:</p>
        <div className="summary-image-canvas__footer-contact">
          <img src="/logos/24hr-white.png" alt="CID Control Room contact number" className="summary-image-canvas__footer-logo" />
        </div>
      </footer>
    </div>
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
        <p className="text-[1.6rem] font-bold leading-none tracking-[-0.03em]">{currentText}</p>
        {showDelta ? (
          <span
            className={clsx(
              "inline-grid h-7 min-w-10 place-items-center rounded-full border px-2.5 text-xs font-semibold tabular-nums",
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
  previous
}: {
  label: string;
  current: number | null | undefined;
  previous: number | null | undefined;
}) {
  const delta = deltaSigned(current, previous);

  return (
    <li
      className="rounded-[10px] border bg-white px-3 py-2"
      style={{ borderColor: BRAND.colors.borderSubtle, boxShadow: `0 1px 2px ${BRAND.colors.overlaySubtleCool}` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className="summary-ribbon__label"
            style={{ color: BRAND.colors.textStrong }}
          >
            {label}
          </p>
          <span
            className="summary-ribbon__delta"
            style={{
              backgroundColor: BRAND.colors.neutralBackground,
              color: BRAND.colors.neutralStrong,
              borderColor: "transparent"
            }}
          >
            {delta.text}
          </span>
        </div>
        <span className="self-center text-[1.6rem] font-bold leading-none tracking-[-0.03em]" style={{ color: BRAND.colors.textStrong }}>
          {metricValueText(current)}
        </span>
      </div>
    </li>
  );
}

function PillarSection({
  title,
  iconPath,
  iconScale = 1,
  theme,
  summary,
  metrics
}: {
  title: string;
  iconPath: string;
  iconScale?: number;
  theme: MetricTheme;
  summary: string;
  metrics: Array<{
    label: string;
    current: number | null | undefined;
    previous: number | null | undefined;
  }>;
}) {
  const headerTheme = CURRENT_WEEK_THEME[theme];
  const iconSize = Math.round(58 * iconScale);

  return (
    <article
      className="rounded-[16px] border bg-white p-3.5"
      style={{ borderColor: BRAND.colors.borderSubtle, boxShadow: `0 2px 8px ${BRAND.colors.shadowSoft}` }}
    >
      <div
        className="relative flex items-center justify-between gap-4 overflow-hidden rounded-[10px] px-4 py-3"
        style={{ background: headerTheme.headerBackground }}
      >
        <span className="absolute inset-y-0 left-0 w-2 rounded-full" style={{ backgroundColor: headerTheme.accent }} aria-hidden />
        <h3 className="dashboard-heading-3 pl-2" style={{ ["--dashboard-heading-color" as string]: BRAND.colors.textStrong }}>{title}</h3>
        <Image
          src={iconPath}
          alt=""
          width={iconSize}
          height={iconSize}
          className="shrink-0 object-contain"
          style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
          aria-hidden
          unoptimized
        />
      </div>

      <ul className="mt-2.5 space-y-1.5">
        {metrics.map((metric, index) => (
          <PillarMetricRow
            key={`${metric.label}-${index}`}
            label={metric.label}
            current={metric.current}
            previous={metric.previous}
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
  railClass,
  valueLabel = "Total",
  theme = "neutral",
  icon: Icon = ClipboardList,
  tooltipDescriptions
}: {
  title: string;
  subtitle?: string;
  data: Array<{ category: string; value: number }>;
  color: string;
  railClass?: string;
  valueLabel?: string;
  theme?: keyof typeof CURRENT_WEEK_THEME;
  icon?: LucideIcon;
  tooltipDescriptions?: Record<string, string[]>;
}) {
  const headerTheme = CURRENT_WEEK_THEME[theme];

  return (
    <article
      className={clsx("rounded-[16px] border bg-white p-3.5", railClass && "rail-card", railClass)}
      style={{ borderColor: BRAND.colors.borderSubtle, boxShadow: `0 2px 8px ${BRAND.colors.shadowSoft}` }}
    >
      <div
        className="relative flex items-center justify-between gap-4 overflow-hidden rounded-[10px] px-4 py-3"
        style={{ background: headerTheme.headerBackground }}
      >
        <span className="absolute inset-y-0 left-0 w-2 rounded-full" style={{ backgroundColor: headerTheme.accent }} aria-hidden />
        <div>
          <h3 className="dashboard-heading-3 pl-2" style={{ ["--dashboard-heading-color" as string]: BRAND.colors.textStrong }}>{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs" style={{ color: BRAND.colors.textMuted }}>{subtitle}</p> : null}
        </div>
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: headerTheme.iconBackground, color: headerTheme.iconColor }}
          aria-hidden
        >
          <Icon className="h-5 w-5" strokeWidth={2.1} />
        </span>
      </div>
      <div className="mt-4 min-h-0 min-w-0 h-[268px] rounded-[10px] border bg-white px-2 py-2.5" style={{ borderColor: BRAND.colors.borderSubtle }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={RESPONSIVE_CHART_INITIAL_DIMENSION}>
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 16, left: 5, bottom: 6 }} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="2 3" stroke={BRAND.colors.gridSubtle} vertical horizontal={false} />
            <XAxis
              type="number"
              axisLine={{ stroke: BRAND.colors.axisSubtle }}
              tickLine={{ stroke: BRAND.colors.axisSubtle }}
              tick={{ fontSize: 11, fill: BRAND.colors.textMuted }}
            />
            <YAxis
              type="category"
              dataKey="category"
              width={104}
              tick={<ChartCategoryTick />}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <Tooltip
              cursor={{ fill: BRAND.colors.overlaySubtle }}
              wrapperStyle={{ zIndex: 60 }}
              content={(props) => (
                <CategoricalTooltip
                  {...props}
                  labelKey="category"
                  descriptionByLabel={tooltipDescriptions}
                  seriesConfig={{
                    value: {
                      label: valueLabel,
                      color,
                      swatchStyle: "block"
                    }
                  }}
                />
              )}
            />
            <Bar
              dataKey="value"
              fill={color}
              radius={[0, 6, 6, 0]}
              barSize={32}
              name={valueLabel}
              activeBar={{ fill: color, opacity: 0.9, stroke: BRAND.colors.black, strokeWidth: 1 }}
            >
              <LabelList
                dataKey="value"
                position="right"
                fill={BRAND.colors.black}
                fontSize={10}
                fontWeight={600}
                formatter={(value) => typeof value === "number" ? value.toLocaleString() : String(value ?? NO_DATA_LABEL)}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function c3DateBounds(reportingWindowStart: string, reportingWindowEnd: string): { from: string; to: string } {
  return {
    from: reportingWindowStart,
    to: reportingWindowEnd
  };
}

function TermsDefinitionsDialog({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-6 md:px-8 md:py-10"
      aria-labelledby="dashboard-terms-title"
      aria-modal="true"
      role="dialog"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close Terms and Definitions"
        onClick={onClose}
        style={{ backgroundColor: "rgba(0, 0, 0, 0.58)" }}
      />

      <div
        className="relative z-10 w-full max-w-5xl overflow-hidden rounded-[14px] border bg-white"
        style={{ borderColor: BRAND.colors.borderSubtle, boxShadow: `0 24px 60px ${BRAND.colors.shadowStrong}` }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 shrink-0 p-1 transition-opacity hover:opacity-70 md:right-6 md:top-6"
          style={{ color: BRAND.colors.textStrong }}
          aria-label="Close Terms and Definitions"
        >
          <span aria-hidden className="block text-2xl leading-none">
            ×
          </span>
        </button>

        <div className="max-h-[calc(100vh-3rem)] overflow-y-auto">
          <div
            className="border-b px-5 py-5 pr-14 md:px-8 md:py-7 md:pr-16"
            style={{ borderColor: BRAND.colors.borderSubtle }}
          >
            <div className="min-w-0">
              <h2
                id="dashboard-terms-title"
                className="text-2xl font-bold leading-tight md:text-[2.1rem]"
                style={{ color: BRAND.colors.textStrong }}
              >
                {DASHBOARD_TERMS_TITLE}
              </h2>
              <p className="mt-3 text-sm leading-6 md:text-[0.95rem]" style={{ color: BRAND.colors.textBody }}>
                {DASHBOARD_TERMS_INTRO}
              </p>
            </div>
          </div>

          <div className="px-5 py-5 md:px-8 md:py-7">
            <div className="space-y-8 md:space-y-10">
              {DASHBOARD_TERMS_SECTIONS.map((section) => {
                const accent = getTermsAccentStyles(section);
                const SectionIcon = section.icon;

                return (
                  <section key={section.id} aria-labelledby={`${section.id}-title`}>
                    <div className="flex items-start gap-4 md:gap-5">
                      {section.iconPath ? (
                        <Image
                          src={section.iconPath}
                          alt=""
                          width={48}
                          height={48}
                          className="h-12 w-12 shrink-0 object-contain"
                          aria-hidden
                          unoptimized
                        />
                      ) : (
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: accent.iconBackground, color: BRAND.colors.textStrong }}
                        >
                          {SectionIcon ? (
                          <SectionIcon className="h-6 w-6" strokeWidth={2.1} aria-hidden />
                          ) : null}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h3
                          id={`${section.id}-title`}
                          className="text-xl font-bold leading-tight md:text-[1.7rem]"
                          style={{ color: BRAND.colors.textStrong }}
                        >
                          {section.title}
                        </h3>
                        {section.description ? (
                          <p className="mt-2 text-base leading-7" style={{ color: BRAND.colors.textMuted }}>
                            {section.description}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <dl className="mt-5 space-y-4 border-t pt-5" style={{ borderColor: BRAND.colors.borderSubtle }}>
                      {section.definitions.map((definition) => (
                        <div key={definition.term}>
                          <dt className="inline text-base font-semibold" style={{ color: BRAND.colors.textStrong }}>
                            {definition.term}
                            {": "}
                          </dt>
                          <dd className="inline text-base leading-7" style={{ color: BRAND.colors.textBody }}>
                            {definition.definition}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function fetchDashboardSlice<T>(params: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/dashboard?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
    signal
  });

  if (!response.ok) {
    let message = `Dashboard request failed with ${response.status}`;

    try {
      const payload = await response.json() as { message?: string };
      if (typeof payload.message === "string" && payload.message.trim()) {
        message = payload.message.trim();
      }
    } catch {
      // Keep the default message when the error body cannot be parsed.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "The dashboard data could not be loaded.";
}

function toPillarConfig(metrics: MetricComparisonRow[], config: {
  id: string;
  title: string;
  theme: MetricTheme;
  iconPath: string;
  summary: string;
}) {
  return {
    ...config,
    metrics
  };
}

export default function DashboardClient({ initialData, initialTab = "summary" }: Props) {
  const [pageData, setPageData] = useState(initialData);
  const [trendData, setTrendData] = useState(initialData.trends);
  const [c3Data, setC3Data] = useState(initialData.c3);
  const [selectedWeekStart, setSelectedWeekStart] = useState(initialData.meta.selected_week_start);
  const [requestedWeekStart, setRequestedWeekStart] = useState(initialData.meta.selected_week_start);
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);
  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>(initialData.summary.default_period);
  const [trendFromDate, setTrendFromDate] = useState(initialData.trends.from);
  const [trendToDate, setTrendToDate] = useState(initialData.trends.to);
  const [requestedTrendFromDate, setRequestedTrendFromDate] = useState(initialData.trends.from);
  const [requestedTrendToDate, setRequestedTrendToDate] = useState(initialData.trends.to);
  const [c3FromDate, setC3FromDate] = useState(initialData.c3.from);
  const [c3ToDate, setC3ToDate] = useState(initialData.c3.to);
  const [requestedC3FromDate, setRequestedC3FromDate] = useState(initialData.c3.from);
  const [requestedC3ToDate, setRequestedC3ToDate] = useState(initialData.c3.to);
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>(initialData.trends.granularity);
  const [requestedTrendGranularity, setRequestedTrendGranularity] = useState<TrendGranularity>(initialData.trends.granularity);
  const mainPrintableRef = useRef<HTMLDivElement>(null);
  const summaryPrintableRef = useRef<HTMLDivElement>(null);
  const trendsPrintableRef = useRef<HTMLDivElement>(null);
  const c3PrintableRef = useRef<HTMLDivElement>(null);
  const summaryImagePrintableRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [isTermsDialogOpen, setIsTermsDialogOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [isTrendsLoading, setIsTrendsLoading] = useState(false);
  const [isC3Loading, setIsC3Loading] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncTabFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const nextTab = params.get("tab") === "summary-image"
        ? "summary-image"
        : routeTabFromPathname(window.location.pathname);
      setActiveTab(nextTab);
    };

    window.addEventListener("popstate", syncTabFromLocation);

    return () => {
      window.removeEventListener("popstate", syncTabFromLocation);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleChange = () => setIsMobileViewport(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    if (requestedWeekStart === pageData.meta.selected_week_start) {
      return undefined;
    }

    const controller = new AbortController();
    setIsPageLoading(true);
    setLoadErrorMessage(null);
    const params = new URLSearchParams({
      view: "page",
      weekStart: requestedWeekStart
    });

    void fetchDashboardSlice<DashboardPageData>(params, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }

        startTransition(() => {
          setPageData(payload);
          setSelectedWeekStart(payload.meta.selected_week_start);
          setRequestedWeekStart(payload.meta.selected_week_start);
          setLoadErrorMessage(null);
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setRequestedWeekStart(pageData.meta.selected_week_start);
        setLoadErrorMessage(getLoadErrorMessage(error));
        console.error(error);
      })
      .finally(() => {
        if (controller.signal.aborted) {
          return;
        }
        setIsPageLoading(false);
      });

    return () => controller.abort();
  }, [pageData.meta.selected_week_start, requestedWeekStart]);

  useEffect(() => {
    if (
      requestedTrendFromDate === trendData.from &&
      requestedTrendToDate === trendData.to &&
      requestedTrendGranularity === trendData.granularity
    ) {
      return undefined;
    }

    const controller = new AbortController();
    setIsTrendsLoading(true);
    setLoadErrorMessage(null);
    const params = new URLSearchParams({
      view: "trends",
      from: requestedTrendFromDate,
      to: requestedTrendToDate,
      granularity: requestedTrendGranularity
    });

    void fetchDashboardSlice<DashboardTrendsData>(params, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }

        startTransition(() => {
          setTrendData(payload);
          setTrendFromDate(payload.from);
          setTrendToDate(payload.to);
          setTrendGranularity(payload.granularity);
          setRequestedTrendFromDate(payload.from);
          setRequestedTrendToDate(payload.to);
          setRequestedTrendGranularity(payload.granularity);
          setLoadErrorMessage(null);
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setRequestedTrendFromDate(trendData.from);
        setRequestedTrendToDate(trendData.to);
        setRequestedTrendGranularity(trendData.granularity);
        setLoadErrorMessage(getLoadErrorMessage(error));
        console.error(error);
      })
      .finally(() => {
        if (controller.signal.aborted) {
          return;
        }
        setIsTrendsLoading(false);
      });

    return () => controller.abort();
  }, [requestedTrendFromDate, requestedTrendGranularity, requestedTrendToDate, trendData.from, trendData.granularity, trendData.to]);

  useEffect(() => {
    if (requestedC3FromDate === c3Data.from && requestedC3ToDate === c3Data.to) {
      return undefined;
    }

    const controller = new AbortController();
    setIsC3Loading(true);
    setLoadErrorMessage(null);
    const params = new URLSearchParams({
      view: "c3",
      from: requestedC3FromDate,
      to: requestedC3ToDate
    });

    void fetchDashboardSlice<DashboardC3Data>(params, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }

        startTransition(() => {
          setC3Data(payload);
          setC3FromDate(payload.from);
          setC3ToDate(payload.to);
          setRequestedC3FromDate(payload.from);
          setRequestedC3ToDate(payload.to);
          setLoadErrorMessage(null);
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setRequestedC3FromDate(c3Data.from);
        setRequestedC3ToDate(c3Data.to);
        setLoadErrorMessage(getLoadErrorMessage(error));
        console.error(error);
      })
      .finally(() => {
        if (controller.signal.aborted) {
          return;
        }
        setIsC3Loading(false);
      });

    return () => controller.abort();
  }, [c3Data.from, c3Data.to, requestedC3FromDate, requestedC3ToDate]);

  const summaryReportingOptions = useMemo(
    () => buildSummaryReportingOptions(pageData.meta.available_weeks),
    [pageData.meta.available_weeks]
  );
  const weekOptions = summaryReportingOptions.week;
  const weekYears = useMemo(
    () => [...new Set(weekOptions.map((option) => option.year))].sort((left, right) => right.localeCompare(left)),
    [weekOptions]
  );
  const selectedWeekYear = useMemo(
    () => findSummaryReportingOption(weekOptions, requestedWeekStart)?.year ?? weekYears[0] ?? "",
    [requestedWeekStart, weekOptions, weekYears]
  );
  const visibleWeekOptions = useMemo(
    () => weekOptions.filter((option) => option.year === selectedWeekYear),
    [selectedWeekYear, weekOptions]
  );
  const activeSummaryReportingOptions = summaryReportingOptions[summaryPeriod];
  const selectedSummaryReportingOption = useMemo(
    () => findSummaryReportingOption(activeSummaryReportingOptions, requestedWeekStart),
    [activeSummaryReportingOptions, requestedWeekStart]
  );
  const showSummaryYearFilter = summaryPeriod === "week" || summaryPeriod === "month" || summaryPeriod === "quarter";
  const summaryFilterYears = useMemo(
    () => [...new Set(activeSummaryReportingOptions.map((option) => option.year))].sort((left, right) => right.localeCompare(left)),
    [activeSummaryReportingOptions]
  );
  const selectedSummaryFilterYear = selectedSummaryReportingOption?.year ?? summaryFilterYears[0] ?? "";
  const visibleSummaryReportingOptions = useMemo(
    () => (
      showSummaryYearFilter
        ? activeSummaryReportingOptions.filter((option) => option.year === selectedSummaryFilterYear)
        : activeSummaryReportingOptions
    ),
    [activeSummaryReportingOptions, selectedSummaryFilterYear, showSummaryYearFilter]
  );
  const summaryReportingFieldLabel = summaryPeriod === "week"
    ? "Reporting Week"
    : summaryPeriod === "month"
      ? "Reporting Month"
      : summaryPeriod === "quarter"
        ? "Reporting Quarter"
        : summaryPeriod === "calendar_year"
          ? "Reporting Calendar Year"
          : "Reporting Financial Year";

  const currentWeek = pageData.week_context.current_week;
  const selectedWeekRange = useMemo(
    () => (currentWeek ? formatWeekRange(currentWeek.week_start, currentWeek.week_end) : formatWeekDate(selectedWeekStart)),
    [currentWeek, selectedWeekStart]
  );
  const activeSummaryData = pageData.summary.periods[summaryPeriod];
  const weeklySummaryData = pageData.summary.periods.week;
  const summaryInfographicGroups = useMemo<SummaryInfographicGroupWithMetrics[]>(
    () => buildSummaryInfographicGroups(activeSummaryData),
    [activeSummaryData]
  );
  const weeklySummaryInfographicGroups = useMemo<SummaryInfographicGroupWithMetrics[]>(
    () => buildSummaryInfographicGroups(weeklySummaryData),
    [weeklySummaryData]
  );
  const summaryGroupsById = useMemo(() => {
    const groups: Partial<Record<SummaryInfographicGroupId, SummaryInfographicGroupWithMetrics>> = {};
    for (const group of summaryInfographicGroups) {
      groups[group.id] = group;
    }
    return groups;
  }, [summaryInfographicGroups]);
  const summaryImageGroupsById = useMemo(() => {
    const groups: Partial<Record<SummaryInfographicGroupId, SummaryInfographicGroupWithMetrics>> = {};
    for (const group of weeklySummaryInfographicGroups) {
      groups[group.id] = group;
    }
    return groups;
  }, [weeklySummaryInfographicGroups]);
  const summaryImageMetricsById = useMemo(() => {
    const metrics = new Map<string, SummaryInfographicMetric>();
    for (const group of weeklySummaryInfographicGroups) {
      for (const metric of group.metrics) {
        metrics.set(metric.id, metric);
      }
    }
    return metrics;
  }, [weeklySummaryInfographicGroups]);

  const currentIncidents = pageData.current_week_tab.incidents;
  const incidentLogEmptyLabel = currentWeek?.metrics.criminal_incidents === 0 ? "No incidents this week" : NO_DATA_LABEL;
  const trendDateBoundsConfig = useMemo(
    () => ({
      from: trendData.available_from,
      to: trendData.available_to
    }),
    [trendData.available_from, trendData.available_to]
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
  const c3DateBoundsConfig = c3DateBounds(c3Data.available_from, c3Data.available_to);
  const c3From = c3FromDate <= c3ToDate ? c3FromDate : c3ToDate;
  const c3To = c3FromDate <= c3ToDate ? c3ToDate : c3FromDate;
  const c3RangeLabel = `${formatWeekDate(c3From)} to ${formatWeekDate(c3To)}`;
  const trendSeries = trendData.series;
  const c3OverallBreakdown = c3Data.breakdown;
  const c3OverallTotals = c3Data.totals;
  const c3OverallResolutionRatio = c3Data.totals.resolution_ratio;
  const activeTabLabel = SUMMARY_IMAGE_TABS.find((tab) => tab.id === activeTab)?.label ?? "Summary";
  const summaryPeriodLabel = activeSummaryData.current.label;
  const summaryCoverageLabel = activeSummaryData.current.coverage_label;
  const showSummaryCoverage = summaryCoverageLabel !== null && summaryCoverageLabel !== summaryPeriodLabel;
  const hasSummaryComparison = activeSummaryData.previous.coverage_label !== null;
  const summaryDetailLines = useMemo(
    () => buildSummaryDetailLines({
      currentLabel: summaryPeriodLabel,
      previousLabel: activeSummaryData.previous.label,
      coverageLabel: summaryCoverageLabel,
      showCoverage: showSummaryCoverage,
      hasComparison: hasSummaryComparison
    }),
    [activeSummaryData.previous.label, hasSummaryComparison, showSummaryCoverage, summaryCoverageLabel, summaryPeriodLabel]
  );
  const c3BacklogTop3 = c3Data.pressure_points;
  const currentWeekGeneralIncidentsBreakdown = pageData.current_week_tab.general_incidents_breakdown;
  const currentWeekLawEnforcementBreakdown = useMemo(
    () => [
      { category: "Section 56 Notices", value: toMetricNumber(currentWeek?.metrics.section56_notices) ?? 0 },
      { category: "Section 341 Notices", value: toMetricNumber(currentWeek?.metrics.section341_notices) ?? 0 }
    ],
    [currentWeek]
  );
  const currentWeekControlRoomBreakdown = pageData.current_week_tab.control_room_breakdown;
  const currentWeekC3LoggedBreakdown = pageData.current_week_tab.c3_logged_breakdown;
  const summaryImageWeekRange = useMemo(
    () => (currentWeek ? formatSummaryImageWeekRange(currentWeek.week_start, currentWeek.week_end) : `${formatWeekDate(selectedWeekStart)}.`),
    [currentWeek, selectedWeekStart]
  );
  const summaryImageCards = useMemo(
    () =>
      SUMMARY_IMAGE_LAYOUT.map((row) =>
        row
          .map((card) => {
            const group = summaryImageGroupsById[card.groupId];
            if (!group) {
              return null;
            }

            return {
              groupId: card.groupId,
              title: group.title,
              accent: group.accent,
              iconColor: group.iconColor ?? (group.accent === BRAND.colors.black ? BRAND.colors.white : BRAND.colors.black),
              iconPath: card.iconPath,
              iconScale: card.iconScale,
              iconComponent: card.iconComponent,
              description: card.description,
              metrics: card.metrics.map((metric) => ({
                ...metric,
                value: summaryImageMetricsById.get(metric.id)?.current ?? null
              })),
              wide: card.wide
            };
          })
          .filter((card): card is NonNullable<typeof card> => card !== null)
      ),
    [summaryImageGroupsById, summaryImageMetricsById]
  );

  const publicSafetyPillar = useMemo(
    () =>
      toPillarConfig(pageData.current_week_tab.public_safety_metrics, {
        id: "public-safety",
        title: "Public Safety",
        theme: "safety",
        iconPath: "/icons/safety.svg",
        summary: "Security patrols and emergency response to ensure community safety."
      }),
    [pageData.current_week_tab.public_safety_metrics]
  );
  const cleaningPillar = useMemo(
    () =>
      toPillarConfig(pageData.current_week_tab.cleaning_metrics, {
        id: "cleaning",
        title: "Cleaning & Maintenance",
        theme: "cleaning",
        iconPath: "/icons/cleaning.svg",
        summary: "Public cleaning and infrastructure maintenance to keep our district pristine."
      }),
    [pageData.current_week_tab.cleaning_metrics]
  );
  const socialPillar = useMemo(
    () =>
      toPillarConfig(pageData.current_week_tab.social_services_metrics, {
        id: "social-services",
        title: "Social Services",
        theme: "social",
        iconPath: "/icons/social%20services.svg",
        summary: "Community support programs and social development initiatives"
      }),
    [pageData.current_week_tab.social_services_metrics]
  );
  const parksPillar = useMemo(
    () =>
      toPillarConfig(pageData.current_week_tab.parks_metrics, {
        id: "parks-recreation",
        title: "Parks & Recreation",
        theme: "parks",
        iconPath: "/icons/parks.svg",
        summary: "Maintaining and improving green spaces and recreational facilities."
      }),
    [pageData.current_week_tab.parks_metrics]
  );

  async function handlePrintPdf() {
    if (typeof window === "undefined") {
      return;
    }
    if (window.matchMedia("(max-width: 767px)").matches) {
      return;
    }
    const exportRefByTab: Record<StandardDashboardTab, RefObject<HTMLDivElement | null>> = {
      main: mainPrintableRef,
      summary: summaryPrintableRef,
      trends: trendsPrintableRef,
      c3: c3PrintableRef
    };
    if (activeTab === "summary-image") {
      return;
    }
    const exportNode = exportRefByTab[activeTab].current;
    if (!exportNode) {
      return;
    }

    const weekToken = currentWeek
      ? `${currentWeek.week_start}_to_${currentWeek.week_end}`
      : selectedWeekStart;
    const summaryPeriodToken = selectedSummaryReportingOption
      ? buildExportDateToken(selectedSummaryReportingOption.start, selectedSummaryReportingOption.end)
      : weekToken;
    const pdfFilenameTokenByTab: Record<StandardDashboardTab, string> = {
      main: weekToken,
      summary: summaryPeriodToken,
      trends: weekToken,
      c3: weekToken
    };

    const pdfMetaByTab: Record<StandardDashboardTab, { title: string; detailLine: DashboardPdfDetail }> = {
      main: {
        title: "Current Week",
        detailLine: `Detailed operational results across each CID focus area from ${selectedWeekRange}.`
      },
      summary: {
        title: "Summary",
        detailLine: summaryDetailLines
      },
      trends: {
        title: "Trends",
        detailLine: `${trendPeriodLabel} results from ${trendRangeLabel}, compared with a ${trendAverageLabel.toLowerCase()} to show underlying direction over time.`
      },
      c3: {
        title: "C3 Tracker",
        detailLine: `City service requests logged vs resolved by category from ${c3RangeLabel}.`
      }
    };

    setIsExportingPdf(true);
    try {
      await exportDashboardPdf({
        exportNode,
        tab: activeTab,
        filenameToken: pdfFilenameTokenByTab[activeTab],
        ...pdfMetaByTab[activeTab]
      });
    } finally {
      setIsExportingPdf(false);
    }
  }

  async function handleExportSummaryImage() {
    if (typeof window === "undefined") {
      return;
    }
    const exportNode = summaryImagePrintableRef.current;
    if (!exportNode) {
      return;
    }

    setIsExportingImage(true);
    try {
      const weekToken = currentWeek
        ? `${currentWeek.week_start}_to_${currentWeek.week_end}`
        : selectedWeekStart;

      await exportNodePng({
        exportNode,
        downloadName: `lgcid-summary-image-${weekToken}.png`,
        width: SUMMARY_IMAGE_EXPORT_WIDTH,
        height: SUMMARY_IMAGE_EXPORT_HEIGHT
      });
    } finally {
      setIsExportingImage(false);
    }
  }

  function handleSummaryPeriodChange(nextPeriod: SummaryPeriod) {
    setSummaryPeriod(nextPeriod);

    const nextOption = findSummaryReportingOption(summaryReportingOptions[nextPeriod], requestedWeekStart);
    if (nextOption && nextOption.value !== requestedWeekStart) {
      setRequestedWeekStart(nextOption.value);
    }
  }

  function handleSummaryYearChange(nextYear: string) {
    const nextOption = [...activeSummaryReportingOptions]
      .reverse()
      .find((option) => option.year === nextYear);

    if (nextOption) {
      setRequestedWeekStart(nextOption.value);
    }
  }

  function handleTabChange(nextTab: StandardDashboardTab) {
    if (typeof window === "undefined") {
      return;
    }

    setActiveTab(nextTab);

    const params = new URLSearchParams(window.location.search);
    params.delete("tab");

    const nextPath = DASHBOARD_ROUTE_BY_TAB[nextTab];
    const query = params.toString();
    window.history.pushState(null, "", query ? `${nextPath}?${query}` : nextPath);
  }

  return (
    <main className="dashboard-shell min-h-screen text-black" style={{ backgroundColor: BRAND.colors.pageBackground }}>
      <header className="header">
        <div className="dashboard-container">
          <div className="flex min-h-[78px] items-center justify-between gap-4">
            <a href="https://lowergardenscid.co.za" target="_blank" rel="noreferrer" aria-label="Visit the Lower Gardens CID website">
              <Image
                src={BRAND.logoPath}
                alt="Lower Gardens CID"
                width={240}
                height={44}
                className="h-auto w-[190px] md:w-[230px]"
                priority
              />
            </a>

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
        <div className="dashboard-container py-9 md:py-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">Lower Gardens City Improvement District</p>
              <h1 className="mt-3 max-w-4xl text-3xl font-bold leading-tight md:text-5xl">Weekly Operations Dashboard</h1>
              <p className="mt-3 max-w-3xl text-sm md:text-base">
                Weekly and historical operational performance for stakeholders, covering safety, cleaning, social upliftment, and general incidents.
              </p>
              <p className="mt-9 font-[var(--font-heading)] text-[0.83rem] font-semibold uppercase tracking-[0.08em] text-white/92">
                Last Update <strong>{formatDataUpdate(pageData.meta.data_updated_at)}</strong>
              </p>
            </div>
            <div className="hidden flex-wrap justify-start gap-3 md:flex lg:justify-end">
              {activeTab !== "summary-image" ? (
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  disabled={isExportingPdf || isPageLoading || isTrendsLoading || isC3Loading}
                  className="inline-flex items-center gap-3 rounded-[14px] border-1 border-white px-6 py-2 font-[var(--font-heading)] text-[0.98rem] font-semibold uppercase tracking-[0.02em] text-white transition-colors hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Printer className="h-5 w-5" strokeWidth={2.2} aria-hidden />
                  <span>{isExportingPdf ? "Preparing..." : "Print"}</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section style={{ backgroundColor: BRAND.colors.pageBackground }}>
        <div className="dashboard-container flex flex-col gap-6 py-7 md:py-8">
          {loadErrorMessage ? (
            <div
              role="alert"
              className="flex items-start gap-4 rounded-[20px] border px-5 py-4"
              style={{
                borderColor: BRAND.colors.alertCritical,
                backgroundColor: BRAND.colors.alertCriticalBackground
              }}
            >
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: BRAND.colors.white, color: BRAND.colors.alertCritical }}
                aria-hidden
              >
                <AlertCircle className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p
                  className="font-[var(--font-heading)] text-[0.92rem] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: BRAND.colors.alertCritical }}
                >
                  Loading error
                </p>
                <p className="mt-1 text-sm leading-6" style={{ color: BRAND.colors.textBody }}>
                  {loadErrorMessage}
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap gap-4">
              {DASHBOARD_TABS.map((tab) => (
                <DashboardTabButton key={tab.id} active={activeTab === tab.id} label={tab.label} onClick={() => handleTabChange(tab.id)} />
              ))}
            </div>

            <div className="flex w-full justify-start md:ml-auto md:w-auto md:justify-end">
              <button
                type="button"
                onClick={() => setIsTermsDialogOpen(true)}
                className="inline-flex items-center gap-2 font-[var(--font-body)] text-base underline underline-offset-4 transition-opacity hover:opacity-70"
                style={{ color: BRAND.colors.textMuted }}
              >
                Terms and Definitions
                <BookOpenText className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="md:sticky md:top-0 md:z-30" style={{ backgroundColor: BRAND.colors.pageBackground }}>
        <div className="dashboard-container py-1 md:py-2">
          {activeTab === "main" || activeTab === "summary" || activeTab === "summary-image" ? (
            <DashboardTopPanel
              title={activeTabLabel}
              icon={activeTab === "summary-image" ? File : FileText}
              description={
                activeTab === "summary-image" ? (
                  <p>
                    Generate the stakeholder-ready PNG for
                    <span className="mt-1 font-semibold" style={{ color: BRAND.colors.textMuted }}> {summaryImageWeekRange}</span>
                  </p>
                ) : activeTab === "summary" ? (
                  <p>
                    Activity report showing the key metrics for
                    <span className="mt-1 font-semibold" style={{ color: BRAND.colors.textMuted }}> {summaryPeriodLabel}</span>.
                    {showSummaryCoverage ? (
                      <> Using reporting weeks from
                      <span className="font-semibold" style={{ color: BRAND.colors.textMuted }}> {summaryCoverageLabel}</span>.</>
                    ) : null}{" "}
                    {activeSummaryData.comparison_text}
                  </p>
                ) : (
                  <p>Detailed operational results across each CID focus area from
                  <span className="mt-1 font-semibold" style={{ color: BRAND.colors.textMuted }}>{selectedWeekRange}.</span></p>
                )
              }
              statusText={isPageLoading ? "Updating..." : undefined}
              controls={
                activeTab === "summary" ? (
                  <div
                    className={clsx(
                      "grid gap-4",
                      showSummaryYearFilter
                        ? "md:grid-cols-[200px_96px_minmax(0,1fr)]"
                        : "md:grid-cols-[220px_minmax(0,1fr)]"
                    )}
                  >
                    <SelectField
                      id="dashboard-summary-period"
                      label="Summary Period"
                      value={summaryPeriod}
                      inlineLabelOnMobile
                      disabled={isPageLoading}
                      onChange={(event) => handleSummaryPeriodChange(event.target.value as SummaryPeriod)}
                    >
                      {SUMMARY_PERIOD_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </SelectField>

                    {showSummaryYearFilter ? (
                      <SelectField
                        id="dashboard-summary-year"
                        label="Year"
                        value={selectedSummaryFilterYear}
                        inlineLabelOnMobile
                        disabled={isPageLoading}
                        onChange={(event) => handleSummaryYearChange(event.target.value)}
                      >
                        {summaryFilterYears.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </SelectField>
                    ) : null}

                    <SelectField
                      id="dashboard-summary-reporting-period"
                      label={summaryReportingFieldLabel}
                      value={selectedSummaryReportingOption?.value ?? requestedWeekStart}
                      inlineLabelOnMobile
                      disabled={isPageLoading}
                      onChange={(event) => setRequestedWeekStart(event.target.value)}
                    >
                      {visibleSummaryReportingOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                ) : (
                  <div className={clsx("grid gap-4", activeTab === "summary-image" ? "md:grid-cols-[160px_minmax(0,1fr)_auto]" : "md:grid-cols-[160px_minmax(0,1fr)]")}>
                    <SelectField
                      id="dashboard-year"
                      label="Year"
                      value={selectedWeekYear}
                      inlineLabelOnMobile
                      disabled={isPageLoading}
                      onChange={(event) => {
                        const nextYear = event.target.value;
                        const nextWeek = [...weekOptions].reverse().find((option) => option.year === nextYear);
                        if (nextWeek) {
                          setRequestedWeekStart(nextWeek.value);
                        }
                      }}
                    >
                      {weekYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField
                      id="dashboard-reporting-week"
                      label="Reporting Week"
                      value={findSummaryReportingOption(weekOptions, requestedWeekStart)?.value ?? requestedWeekStart}
                      inlineLabelOnMobile
                      disabled={isPageLoading}
                      onChange={(event) => setRequestedWeekStart(event.target.value)}
                    >
                      {visibleWeekOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </SelectField>
                    {activeTab === "summary-image" ? (
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleExportSummaryImage}
                          disabled={isExportingImage || isPageLoading}
                          className="inline-flex min-h-12 items-center justify-center gap-3 rounded-[14px] border border-black bg-black px-6 py-3 font-[var(--font-heading)] text-[0.98rem] font-semibold uppercase tracking-[0.02em] text-white transition-colors hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <File className="h-5 w-5" strokeWidth={2.2} aria-hidden />
                          <span>{isExportingImage ? "Preparing..." : "Export PNG"}</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              }
            />
          ) : null}

          {activeTab === "trends" ? (
            <DashboardTopPanel
              title="Trends"
              icon={TrendingUp}
              description={
                <p>
                  {trendPeriodLabel} results from <span className="font-semibold" style={{ color: BRAND.colors.textMuted }}>{trendRangeLabel}</span>, compared with a {trendAverageLabel} to show underlying direction over time.
                </p>
              }
              statusText={isTrendsLoading ? "Updating..." : undefined}
              controls={
                <div className="min-w-0 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                  <DateField
                    id="trends-from-date"
                    label="From"
                    value={requestedTrendFromDate}
                    inlineLabelOnMobile
                    min={trendDateBoundsConfig.from}
                    max={requestedTrendToDate}
                    disabled={isTrendsLoading}
                    onChange={(event) => {
                      const nextFrom = event.target.value;
                      if (!nextFrom) {
                        return;
                      }
                      const boundedFrom = nextFrom < trendDateBoundsConfig.from ? trendDateBoundsConfig.from : nextFrom;
                      setRequestedTrendFromDate(boundedFrom);
                      if (boundedFrom > requestedTrendToDate) {
                        setRequestedTrendToDate(boundedFrom);
                      }
                    }}
                  />
                  <DateField
                    id="trends-to-date"
                    label="To"
                    value={requestedTrendToDate}
                    inlineLabelOnMobile
                    min={requestedTrendFromDate}
                    max={trendDateBoundsConfig.to}
                    disabled={isTrendsLoading}
                    onChange={(event) => {
                      const nextTo = event.target.value;
                      if (!nextTo) {
                        return;
                      }
                      const boundedTo = nextTo > trendDateBoundsConfig.to ? trendDateBoundsConfig.to : nextTo;
                      setRequestedTrendToDate(boundedTo);
                      if (boundedTo < requestedTrendFromDate) {
                        setRequestedTrendFromDate(boundedTo);
                      }
                    }}
                  />
                  <div className="min-w-0">
                    <label className="block font-[var(--font-heading)] text-[0.92rem] font-medium tracking-[-0.01em] text-black/80">View By</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {TREND_GRANULARITY_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setRequestedTrendGranularity(option.id)}
                          disabled={isTrendsLoading}
                          className={clsx(
                            "rounded-[8px] px-6 py-3 font-[var(--font-body)] text-[.9rem] transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                            requestedTrendGranularity === option.id ? "bg-black text-white" : "bg-black/6 text-black hover:bg-black/10"
                          )}
                          aria-pressed={requestedTrendGranularity === option.id}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              }
            />
          ) : null}

          {activeTab === "c3" ? (
            <DashboardTopPanel
              title="C3 Tracker"
              icon={ClipboardList}
              description={
                <p>City service requests logged vs resolved by category from
                <span className="mt-1 font-semibold" style={{ color: BRAND.colors.textMuted }}> {c3RangeLabel}.</span></p>
              }
              statusText={isC3Loading ? "Updating..." : undefined}
              controls={
                <div className="grid gap-4 md:grid-cols-2">
                  <DateField
                    id="c3-from-date"
                    label="From"
                    value={requestedC3FromDate}
                    inlineLabelOnMobile
                    min={c3DateBoundsConfig.from}
                    max={requestedC3ToDate}
                    disabled={isC3Loading}
                    onChange={(event) => {
                      const nextFrom = event.target.value;
                      if (!nextFrom) {
                        return;
                      }
                      const boundedFrom = nextFrom < c3DateBoundsConfig.from ? c3DateBoundsConfig.from : nextFrom;
                      setRequestedC3FromDate(boundedFrom);
                      if (boundedFrom > requestedC3ToDate) {
                        setRequestedC3ToDate(boundedFrom);
                      }
                    }}
                  />
                  <DateField
                    id="c3-to-date"
                    label="To"
                    value={requestedC3ToDate}
                    inlineLabelOnMobile
                    min={requestedC3FromDate}
                    max={c3DateBoundsConfig.to}
                    disabled={isC3Loading}
                    onChange={(event) => {
                      const nextTo = event.target.value;
                      if (!nextTo) {
                        return;
                      }
                      const boundedTo = nextTo > c3DateBoundsConfig.to ? c3DateBoundsConfig.to : nextTo;
                      setRequestedC3ToDate(boundedTo);
                      if (boundedTo < requestedC3FromDate) {
                        setRequestedC3FromDate(boundedTo);
                      }
                    }}
                  />
                </div>
              }
            />
          ) : null}
        </div>
      </section>

      <div className="dashboard-container py-1 pb-10 md:py-2 md:pb-14" style={{ backgroundColor: BRAND.colors.pageBackground }}>

        {activeTab === "main" ? (
        <div ref={mainPrintableRef} className="space-y-6">
          <section id="current-week" className="card-frame bg-transparent p-0">
          {currentWeek?.record_status === "NO_DATA_REPORTED" ? (
            <div className="border border-dashed border-black p-5 text-center font-semibold">{NO_DATA_LABEL}</div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <PillarSection
                  key={publicSafetyPillar.id}
                  title={publicSafetyPillar.title}
                  iconPath={publicSafetyPillar.iconPath}
                  iconScale={1.12}
                  theme={publicSafetyPillar.theme}
                  summary={publicSafetyPillar.summary}
                  metrics={publicSafetyPillar.metrics}
                />

                <PillarSection
                  key={cleaningPillar.id}
                  title={cleaningPillar.title}
                  iconPath={cleaningPillar.iconPath}
                  iconScale={1.1}
                  theme={cleaningPillar.theme}
                  summary={cleaningPillar.summary}
                  metrics={cleaningPillar.metrics}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <CurrentWeekBreakdownChart
                  title="Law Enforcement"
                  data={currentWeekLawEnforcementBreakdown}
                  color={BRAND.colors.lawEnforcement}
                  theme="law"
                  icon={Scale}
                  tooltipDescriptions={{
                    "Section 56 Notices": [SECTION_NOTICE_EXPLANATIONS.section56],
                    "Section 341 Notices": [SECTION_NOTICE_EXPLANATIONS.section341]
                  }}
                />

                <CurrentWeekBreakdownChart
                  title="General Incidents"
                  data={currentWeekGeneralIncidentsBreakdown}
                  color={BRAND.colors.generalIncidents}
                  theme="generalIncidents"
                  icon={Building2}
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
                  title="Control Room Engagement"
                  data={currentWeekControlRoomBreakdown}
                  color={BRAND.colors.neutralStrong}
                  theme="neutral"
                  icon={PhoneCall}
                />
                <CurrentWeekBreakdownChart
                  title="C3 Logged Requests"
                  data={currentWeekC3LoggedBreakdown}
                  color={BRAND.colors.neutralStrong}
                  theme="neutral"
                  icon={ClipboardList}
                />
              </div>
            </div>
          )}
          </section>

          <section
            id="incidents"
            className="card-frame rounded-[16px] border bg-white p-4 md:p-6"
            style={{ borderColor: BRAND.colors.borderSubtle, boxShadow: `0 2px 8px ${BRAND.colors.shadowSoft}` }}
          >
          <SectionHeading
            title="Criminal Incidents"
            description={<>Details of reported incidents for the current week: <strong>{selectedWeekRange}</strong></>}
            icon="incidents"
            iconBackground={BRAND.colors.textStrong}
            iconColor={BRAND.colors.white}
          />

          <div
            className="mb-5 rounded-[14px] border-2 p-5"
            style={{ borderColor: BRAND.colors.safety, backgroundColor: BRAND.colors.safetyBackground, boxShadow: `0 2px 8px ${BRAND.colors.overlaySubtleCool}` }}
          >
            <h4 className="dashboard-heading-4" style={{ ["--dashboard-heading-color" as string]: BRAND.colors.textStrong }}>Your Eyes, Our Impact: See it, Share it.</h4>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed" style={{ color: BRAND.colors.textBody }}>
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
            <div className="rounded-[12px] border p-3.5" style={{ borderColor: BRAND.colors.borderSubtle }}>
              <h4 className="dashboard-heading-4" style={{ ["--dashboard-heading-color" as string]: BRAND.colors.textStrong }}>Hotspot Intelligence <span className="font-normal">(Top {HOTSPOT_LIMIT})</span></h4>
              <ol className="mt-3 space-y-2">
                {pageData.current_week_tab.hotspots.length ? (
                  pageData.current_week_tab.hotspots.map((spot, index) => (
                    <li key={spot.street} className="flex items-center justify-between rounded-[10px] border bg-white px-3 py-2.5" style={{ borderColor: BRAND.colors.borderSubtle }}>
                      <span className="text-sm font-medium" style={{ color: BRAND.colors.textStrong }}>{index + 1}. {spot.street}</span>
                      <span className="inline-flex min-w-9 items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium" style={{ borderColor: BRAND.colors.safety, backgroundColor: BRAND.colors.safety, color: BRAND.colors.black }}>
                        {spot.incident_count}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="border border-dashed border-black p-3 text-sm">{NO_DATA_LABEL}</li>
                )}
              </ol>
            </div>

            <div className="rounded-[12px] border p-3.5" style={{ borderColor: BRAND.colors.borderSubtle }}>
              <h4 className="dashboard-heading-4" style={{ ["--dashboard-heading-color" as string]: BRAND.colors.textStrong }}>
                Incident Log <span className="font-normal">(Selected Week: {selectedWeekRange})</span>
              </h4>
              <div className="mt-3 grid gap-3">
                {currentIncidents.length ? (
                  currentIncidents.map((incident, index) => (
                    <article key={`${incident.week_start}-${index}`} className="rounded-[12px] border p-4" style={{ borderColor: BRAND.colors.borderSubtle, backgroundColor: BRAND.colors.surfaceRaised }}>
                      <div className="flex flex-wrap items-center gap-2 text-[0.9rem] font-semibold" style={{ color: BRAND.colors.textStrong }}>
                        <span>{incident.incident_date ?? "No date"}</span>
                        <span className="ml-4">{incident.place}</span>
                        <IncidentCategoryTag category={incident.category} />
                      </div>
                      <p className="mt-3 text-sm leading-[1.75]" style={{ color: BRAND.colors.textBody }}>{incident.summary}</p>
                    </article>
                  ))
                ) : (
                  <p className="border border-dashed border-black p-3 text-sm">{incidentLogEmptyLabel}</p>
                )}
              </div>
            </div>
          </div>
          </section>
        </div>
        ) : null}

        {activeTab === "summary" ? (
          <div ref={summaryPrintableRef}>
            <section id="summary-infographic">
              {currentWeek?.record_status === "NO_DATA_REPORTED" ? (
                <div className="border border-dashed border-black p-5 text-center font-semibold">{NO_DATA_LABEL}</div>
              ) : (
                <div className="summary-infographic-grid">
                  {SUMMARY_INFOGRAPHIC_ROWS.map((row, rowIndex) => (
                    <div key={`summary-row-${rowIndex}`} className="summary-infographic-grid__row">
                      {row.map((groupId) => {
                        const group = summaryGroupsById[groupId];
                        if (!group) {
                          return null;
                        }
                        const groupIndex = SUMMARY_INFOGRAPHIC_RENDER_ORDER.indexOf(groupId);
                        return <SummaryGroupCard key={groupId} group={group} groupIndex={groupIndex} />;
                      })}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}

        {activeTab === "summary-image" ? (
          <section className="summary-image-preview">
            <div className="summary-image-preview__viewport">
              <div ref={summaryImagePrintableRef}>
                <SummaryImageCanvas selectedWeekRange={summaryImageWeekRange} cards={summaryImageCards} />
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "trends" ? (
          <div ref={trendsPrintableRef}>
            <section id="trends" className="py-1">
            {trendSeries.length ? (
              <div className="grid gap-5 lg:grid-cols-2">
                <TrendLineCard
                  title="Public Safety Trend"
                  data={trendSeries}
                  granularity={trendGranularity}
                  dataKey="criminal_incidents"
                  averageKey="criminal_ma4"
                  stroke={BRAND.colors.safety}
                  dataName={`${trendPeriodLabel} criminal incidents`}
                  averageName={trendAverageLabel}
                />

                <TrendLineCard
                  title="Cleaning & Maintenance Trend"
                  data={trendSeries}
                  granularity={trendGranularity}
                  dataKey="cleaning_bags_collected"
                  averageKey="cleaning_ma4"
                  stroke={BRAND.colors.cleaning}
                  dataName={`${trendPeriodLabel} bags (total)`}
                  averageName={trendAverageLabel}
                />

                <TrendLineCard
                  title="Social Services Trend"
                  data={trendSeries}
                  granularity={trendGranularity}
                  dataKey="social_touch_points"
                  averageKey="social_touch_points_ma4"
                  stroke={BRAND.colors.social}
                  dataName={`${trendPeriodLabel} touch points`}
                  averageName={trendAverageLabel}
                />

                <TrendLineCard
                  title="Parks & Recreation Trend"
                  data={trendSeries}
                  granularity={trendGranularity}
                  dataKey="parks_total_bags"
                  averageKey="parks_total_bags_ma4"
                  stroke={BRAND.colors.parks}
                  dataName={`${trendPeriodLabel} bags (total)`}
                  averageName={trendAverageLabel}
                />

                <TrendLineCard
                  title="Law Enforcement Trend"
                  data={trendSeries}
                  granularity={trendGranularity}
                  dataKey="fines_total"
                  averageKey="fines_total_ma4"
                  stroke={BRAND.colors.lawEnforcement}
                  dataName={`${trendPeriodLabel} fines (total)`}
                  averageName={trendAverageLabel}
                />

                <TrendLineCard
                  title="General Incidents Trend"
                  data={trendSeries}
                  granularity={trendGranularity}
                  dataKey="general_incidents_total"
                  averageKey="general_incidents_ma4"
                  stroke={BRAND.colors.generalIncidents}
                  dataName={`${trendPeriodLabel} incidents`}
                  averageName={trendAverageLabel}
                />

                <TrendLineCard
                  title="Control Room Engagement Trend"
                  data={trendSeries}
                  granularity={trendGranularity}
                  dataKey="contacts_total"
                  averageKey="contacts_total_ma4"
                  stroke={BRAND.colors.black}
                  dataName={`${trendPeriodLabel} calls + Whatsapps`}
                  averageName={trendAverageLabel}
                />

                <TrendLineCard
                  title="CoCT C3 Logged Requests Trend"
                  data={trendSeries}
                  granularity={trendGranularity}
                  dataKey="c3_logged_total"
                  averageKey="c3_logged_total_ma4"
                  stroke={BRAND.colors.black}
                  dataName={`${trendPeriodLabel} logged requests`}
                  averageName={trendAverageLabel}
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-black p-5 text-center font-semibold">
                {NO_DATA_LABEL}
              </div>
            )}
            </section>
          </div>
        ) : null}

        {activeTab === "c3" ? (
          <div ref={c3PrintableRef}>
            <section id="c3" className="space-y-6 rounded-[24px] border-0 bg-transparent p-0 shadow-none">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <article className="rounded-[24px] border border-black/10 bg-white px-8 py-5" style={{ boxShadow: `0 2px 10px ${BRAND.colors.shadowMediumCool}` }}>
              <p className="text-[40px] leading-none font-black tracking-[-0.04em]" style={{ color: BRAND.colors.textStrong }}>{c3OverallTotals.logged.toLocaleString()}</p>
              <p className="mt-4 text-[17px] font-medium text-black/62">Total Logged</p>
            </article>
            <article className="rounded-[24px] border border-black/10 bg-white px-8 py-5" style={{ boxShadow: `0 2px 10px ${BRAND.colors.shadowMediumCool}` }}>
              <p className="text-[40px] leading-none font-black tracking-[-0.04em]" style={{ color: BRAND.colors.textStrong }}>{c3OverallTotals.resolved.toLocaleString()}</p>
              <p className="mt-4 text-[17px] font-medium text-black/62">Resolved</p>
            </article>
            <article className="rounded-[24px] border border-black/10 bg-white px-8 py-5" style={{ boxShadow: `0 2px 10px ${BRAND.colors.shadowMediumCool}` }}>
              <p className="text-[40px] leading-none font-black tracking-[-0.04em]" style={{ color: BRAND.colors.textStrong }}>{c3OverallTotals.backlog.toLocaleString()}</p>
              <p className="mt-4 text-[17px] font-medium text-black/62">Open Backlog</p>
            </article>
            <article className="rounded-[24px] border border-black/10 bg-white px-8 py-5" style={{ boxShadow: `0 2px 10px ${BRAND.colors.shadowMediumCool}` }}>
              <p className="text-[40px] leading-none font-black tracking-[-0.04em]" style={{ color: BRAND.colors.textStrong }}>
                {c3OverallResolutionRatio === null ? NO_DATA_LABEL : `${Math.round(c3OverallResolutionRatio * 100)}%`}
              </p>
              <p className="mt-4 text-[17px] font-medium text-black/62">Resolution Rate</p>
            </article>
          </div>

          <div className="rounded-[26px] border border-black/10 bg-white px-4 pt-8 md:px-8" style={{ boxShadow: `0 3px 12px ${BRAND.colors.shadowMediumCool}` }}>
            <h3 className="dashboard-heading-3" style={{ ["--dashboard-heading-color" as string]: BRAND.colors.textStrong }}>Logged vs Resolved by Category</h3>
            <p className="mt-2 text-[15px]" style={{ color: BRAND.colors.textMuted }}>Comparison of service requests logged and resolved across all categories</p>

            <div className="mt-8 min-h-0 min-w-0 h-[560px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={RESPONSIVE_CHART_INITIAL_DIMENSION}>
                <BarChart data={c3OverallBreakdown} margin={{ top: 34, right: 12, left: -25, bottom: 34 }} barGap={2} barCategoryGap="18%" barSize={36}>
                  <CartesianGrid strokeDasharray="4 4" stroke={BRAND.colors.gridSubtle} vertical={false} />
                  <XAxis
                    dataKey="department"
                    tick={{ fontSize: isMobileViewport ? 12 : 14, fill: BRAND.colors.textBody }}
                    interval={0}
                    angle={isMobileViewport ? -90 : -46}
                    textAnchor="end"
                    height={isMobileViewport ? 132 : 110}
                    axisLine={{ stroke: BRAND.colors.textMuted, strokeWidth: 1.5 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: isMobileViewport ? 11 : 14, fill: BRAND.colors.textBody }}
                    axisLine={{ stroke: BRAND.colors.textMuted, strokeWidth: 1.5 }}
                    tickLine={{ stroke: BRAND.colors.textMuted }}
                    domain={[0, "dataMax + 12"]}
                  />
                  <Tooltip
                    cursor={{ fill: BRAND.colors.overlaySubtleCool }}
                    content={(props) => (
                      <CategoricalTooltip
                        {...props}
                        labelKey="department"
                        seriesConfig={C3_TOOLTIP_SERIES_CONFIG}
                      />
                    )}
                  />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    iconType="square"
                    wrapperStyle={{ paddingTop: 22, fontSize: isMobileViewport ? "14px" : "18px" }}
                    formatter={legendLabelFormatter}
                  />
                  <Bar
                    dataKey="logged"
                    fill={BRAND.colors.neutralStrong}
                    radius={[5, 5, 0, 0]}
                    name="Logged"
                    activeBar={{ fill: BRAND.colors.neutralStrong, stroke: BRAND.colors.black, strokeWidth: 1 }}
                  >
                    <LabelList dataKey="logged" position="top" fill={BRAND.colors.textBody} fontSize={isMobileViewport ? 8 : 13} />
                  </Bar>
                  <Bar
                    dataKey="resolved"
                    fill={BRAND.colors.trendAverage}
                    radius={[5, 5, 0, 0]}
                    stroke={BRAND.colors.trendAverage}
                    strokeWidth={1}
                    name="Resolved"
                    activeBar={{ fill: BRAND.colors.trendAverage, stroke: BRAND.colors.black, strokeWidth: 1.2 }}
                  >
                    <LabelList dataKey="resolved" position="top" fill={BRAND.colors.textBody} fontSize={isMobileViewport ? 8 : 13} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.7fr_0.95fr] xl:items-stretch">
            <div className="min-w-0 h-full rounded-[26px] border border-black/10 bg-white px-8 py-7" style={{ boxShadow: `0 3px 12px ${BRAND.colors.shadowMediumCool}` }}>
              <h3 className="dashboard-heading-3" style={{ ["--dashboard-heading-color" as string]: BRAND.colors.textStrong }}>Open Backlog by Category</h3>
              <p className="mt-2 text-[15px]" style={{ color: BRAND.colors.textMuted }}>Number of unresolved requests per category</p>

              <div className="mt-8 min-h-0 min-w-0 h-[360px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={RESPONSIVE_CHART_INITIAL_DIMENSION}>
                  <BarChart data={c3OverallBreakdown} layout="vertical" margin={{ top: 8, right: 32, left: isMobileViewport ? -15 : 0, bottom: 18 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke={BRAND.colors.gridSubtle} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 14, fill: BRAND.colors.textBody }}
                      axisLine={{ stroke: BRAND.colors.textMuted, strokeWidth: 1.5 }}
                      tickLine={{ stroke: BRAND.colors.textMuted }}
                    />
                    <YAxis
                      type="category"
                      dataKey="department"
                      width={150}
                      tick={{ fontSize: 14, fill: BRAND.colors.textBody }}
                      axisLine={{ stroke: BRAND.colors.textMuted, strokeWidth: 1.5 }}
                      tickLine={{ stroke: BRAND.colors.textMuted }}
                      interval={0}
                    />
                    <Tooltip
                      cursor={{ fill: BRAND.colors.overlaySubtleCool }}
                      content={(props) => (
                        <CategoricalTooltip
                          {...props}
                          labelKey="department"
                          seriesConfig={C3_BACKLOG_TOOLTIP_SERIES_CONFIG}
                        />
                      )}
                    />
                    <Bar
                      dataKey="backlog"
                      fill={BRAND.colors.neutralStrong}
                      radius={[0, 10, 10, 0]}
                      name="Open backlog"
                      activeBar={{ fill: BRAND.colors.neutralStrong, stroke: BRAND.colors.black, strokeWidth: 1 }}
                    >
                      <LabelList dataKey="backlog" position="right" fill={BRAND.colors.textBody} fontSize={13} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="h-full rounded-[26px] border border-black/10 bg-white px-8 py-7" style={{ boxShadow: `0 3px 12px ${BRAND.colors.shadowMediumCool}` }}>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center" style={{ color: BRAND.colors.alertCritical }}>
                  <AlertCircle className="h-6 w-6" />
                </span>
                <h3 className="dashboard-heading-3" style={{ ["--dashboard-heading-color" as string]: BRAND.colors.textStrong }}>Pressure Points</h3>
              </div>
              <p className="mt-2 text-[15px]" style={{ color: BRAND.colors.textMuted }}>Categories requiring immediate attention</p>
              {c3BacklogTop3.length ? (
                <ol className="mt-5 space-y-4 text-[14px]">
                  {c3BacklogTop3.map((row) => (
                    <li
                      key={row.department}
                      className="rounded-r-[20px] border-l-[6px] px-5 py-4"
                      style={{ borderColor: BRAND.colors.neutralStrong, backgroundColor: BRAND.colors.neutralBackground }}
                    >
                      <p className="text-[16px] font-bold" style={{ color: BRAND.colors.textStrong }}>{row.department}</p>
                      <p className="mt-3 text-[14px]" style={{ color: BRAND.colors.textBody }}>
                        <span className="font-normal">Open backlog:</span>{" "}
                        <strong className="font-bold" style={{ color: BRAND.colors.neutralStrong }}>{row.backlog.toLocaleString()}</strong>
                      </p>
                      <p className="mt-1 text-[14px]" style={{ color: BRAND.colors.textBody }}>
                        <span className="font-normal">Resolution rate:</span>{" "}
                        <strong className="font-bold" style={{ color: BRAND.colors.textStrong }}>
                          {row.resolution_ratio === null ? NO_DATA_LABEL : `${Math.round(row.resolution_ratio * 100)}%`}
                        </strong>
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="mt-6 rounded-[20px] border border-dashed border-black/25 p-4 text-sm" style={{ backgroundColor: BRAND.colors.surfaceMutedWarm }}>
                  {NO_DATA_LABEL}
                </div>
              )}
            </div>
          </div>

          <div
            className="rounded-[26px] border-2 border-black/80 px-8 py-7"
            style={{ backgroundColor: BRAND.colors.neutralBackground, boxShadow: `0 2px 8px ${BRAND.colors.overlaySubtleCool}` }}
          >
            <div className="flex gap-5">
              <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center">
                <ClipboardList className="h-7 w-7 text-black/80" />
              </span>
              <div className="text-[14px] leading-relaxed" style={{ color: BRAND.colors.textBody }}>
                <p>
                  Need to check an existing City of Cape Town reference? You can use the{" "}
                  <a
                    href="https://eservices1.capetown.gov.za/coct/wapl/zsreq_app/index.html"
                    className="font-bold"
                    style={{ color: BRAND.colors.textStrong }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    CoCT service request portal
                  </a>{" "}
                  to look up a reference directly. The portal also allows new registrations, but please report new requests through us where possible so we can track and follow up.
                </p>
                <p className="mt-4">
                  Contact us on WhatsApp at{" "}
                  <a href="https://wa.me/27690078644" className="font-bold" style={{ color: BRAND.colors.textStrong }} target="_blank" rel="noreferrer">
                    089 007 6644
                  </a>{" "}
                  (message only) or call the LGCID 24-hour line on{" "}
                  <a href="tel:0873302177" className="font-bold" style={{ color: BRAND.colors.textStrong }}>
                    087 330 2177
                  </a>.
                </p>
              </div>
            </div>
          </div>
          </section>
          </div>
        ) : null}

      </div>

      <TermsDefinitionsDialog open={isTermsDialogOpen} onClose={() => setIsTermsDialogOpen(false)} />

      <footer className="bg-black text-white">
        <div className="dashboard-container grid items-start gap-8 py-10 md:grid-cols-12">
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
            <div className="mt-4 text-base leading-relaxed text-white/90">
              <a className="block" href="https://www.lowergardenscid.co.za/cid-control-room?hsLang=en" target="_blank" rel="noreferrer">
                CID Control Room
              </a>
              <a className="mt-[0.6rem] block" href="https://www.lowergardenscid.co.za/lgcid-connect?hsLang=en" target="_blank" rel="noreferrer">
                LGCID Connect
              </a>
              <a className="mt-[0.6rem] block" href="https://www.lowergardenscid.co.za/contact-us?hsLang=en" target="_blank" rel="noreferrer">
                Report an Incident
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/15">
          <div className="dashboard-container py-5 text-sm text-white/70">
            Copyright © 2025 - Lower Gardens City Improvement District.
          </div>
        </div>
      </footer>
    </main>
  );
}
