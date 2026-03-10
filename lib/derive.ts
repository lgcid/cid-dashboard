import { format } from "date-fns";
import { WEEK_START_BASELINE } from "@/lib/section-matrix";
import { safeDate, weekEndFromStart } from "@/lib/date-utils";
import { rankHotspots } from "@/lib/hotspots";
import type {
  C3BreakdownRow,
  C3Totals,
  DashboardQuery,
  DerivedTrendPoint,
  HotspotRow,
  IncidentRow,
  NullableNumber,
  SectionData,
  SectionMap,
  WeekRecord,
  WeeklyMetricRow
} from "@/types/dashboard";

const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const PUBLIC_SAFETY_LABELS = {
  criminal_incidents: ["Criminal Incidents"],
  arrests_made: ["Arrests Made"],
  proactive_actions: ["Stop and Search", "Stop & Search", "Pro-active Actions", "Proactive Actions"],
  public_space_interventions: ["Public Space Interventions"]
} as const;

const LAW_ENFORCEMENT_LABELS = {
  section56_notices: ["Section 56 Notices"],
  section341_notices: ["Section 341 Notices"]
} as const;

const CLEANING_LABELS = {
  cleaning_bags_collected: ["Bags Filled and Collected"],
  cleaning_servitudes_cleaned: ["Servitudes Cleaned"],
  cleaning_stormwater_drains_cleaned: ["Stormwater Drains Cleaned"],
  cleaning_stormwater_bags_filled: ["Stormwater Bags Filled"]
} as const;

const CONTROL_ROOM_ENGAGEMENT_LABELS = {
  calls_received: ["Calls Received", "Calls"],
  whatsapps_received: ["WhatsApps Received", "WhatsApp Received", "WhatsApp Messages Received", "WhatsApps"]
} as const;

const PARKS_LABELS = {
  pruned_trees: ["Pruned Trees", "Pruned trees"]
} as const;

const SOCIAL_TOUCH_POINT_EXCLUDED_LABELS = [
  "Work Readiness Bags Collected",
  "Work Readiness Bag Collected",
  "Successful ID Applications",
  "Successful ID Application"
] as const;

function isIsoDay(value: string): boolean {
  return ISO_DAY_PATTERN.test(value);
}

function normalizeLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function toNumber(value: NullableNumber): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sumNullable(values: Array<NullableNumber | undefined>): number | null {
  const numeric = values
    .map((value) => toNumber(value ?? null))
    .filter((value): value is number => value !== null);
  if (!numeric.length) {
    return null;
  }
  return numeric.reduce((sum, value) => sum + value, 0);
}

function findCategoryValue(section: SectionData, weekStart: string, candidates: readonly string[]): number | null {
  const normalizedCandidates = new Set(candidates.map(normalizeLabel));
  for (const row of section.categories) {
    if (!normalizedCandidates.has(normalizeLabel(row.category))) {
      continue;
    }
    return toNumber(row.values[weekStart] ?? null);
  }
  return null;
}

function sumSectionForWeek(section: SectionData, weekStart: string): number | null {
  return sumNullable(section.categories.map((row) => row.values[weekStart] ?? null));
}

function sumSectionForWeekExcluding(section: SectionData, weekStart: string, excludedCategories: readonly string[]): number | null {
  const excluded = new Set(excludedCategories.map(normalizeLabel));
  return sumNullable(
    section.categories
      .filter((row) => !excluded.has(normalizeLabel(row.category)))
      .map((row) => row.values[weekStart] ?? null)
  );
}

function c3Categories(sections: SectionMap): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const row of sections.c3_logged.categories) {
    if (!seen.has(row.category)) {
      seen.add(row.category);
      ordered.push(row.category);
    }
  }

  for (const row of sections.c3_resolved.categories) {
    if (!seen.has(row.category)) {
      seen.add(row.category);
      ordered.push(row.category);
    }
  }

  return ordered;
}

function sectionCategoryValue(section: SectionData, category: string, weekStart: string): number | null {
  const normalizedTarget = normalizeLabel(category);
  const matched = section.categories.find((row) => normalizeLabel(row.category) === normalizedTarget);
  if (!matched) {
    return null;
  }
  return toNumber(matched.values[weekStart] ?? null);
}

export function deriveWeeks(sections: SectionMap): WeekRecord[] {
  const weekStarts = new Set<string>([WEEK_START_BASELINE]);

  for (const section of Object.values(sections)) {
    for (const row of section.categories) {
      for (const weekStart of Object.keys(row.values)) {
        if (!isIsoDay(weekStart)) {
          continue;
        }
        if (weekStart < WEEK_START_BASELINE) {
          continue;
        }
        weekStarts.add(weekStart);
      }
    }
  }

  const sortedWeekStarts = [...weekStarts].sort((a, b) => a.localeCompare(b));

  return sortedWeekStarts.map((weekStart) => {
    let hasAnyNumber = false;
    for (const section of Object.values(sections)) {
      for (const row of section.categories) {
        if (toNumber(row.values[weekStart] ?? null) !== null) {
          hasAnyNumber = true;
          break;
        }
      }
      if (hasAnyNumber) {
        break;
      }
    }

    const weekEnd = weekEndFromStart(weekStart);
    return {
      week_start: weekStart,
      week_end: weekEnd,
      week_label: `${weekStart} to ${weekEnd}`,
      record_status: hasAnyNumber ? "REPORTED" : "NO_DATA_REPORTED"
    };
  });
}

export function buildWeeklyRows(weeks: WeekRecord[], sections: SectionMap): WeeklyMetricRow[] {
  return weeks.map((week) => {
    const weekStart = week.week_start;

    const publicSafety = sections.public_safety;
    const lawEnforcement = sections.law_enforcement;
    const cleaning = sections.cleaning;
    const controlRoomEngagement = sections.control_room_engagement;

    const criminalIncidents = findCategoryValue(publicSafety, weekStart, PUBLIC_SAFETY_LABELS.criminal_incidents);
    const arrestsMade = findCategoryValue(publicSafety, weekStart, PUBLIC_SAFETY_LABELS.arrests_made);
    const section56Notices = findCategoryValue(lawEnforcement, weekStart, LAW_ENFORCEMENT_LABELS.section56_notices);
    const section341Notices = findCategoryValue(lawEnforcement, weekStart, LAW_ENFORCEMENT_LABELS.section341_notices);
    const proactiveActions = findCategoryValue(publicSafety, weekStart, PUBLIC_SAFETY_LABELS.proactive_actions);
    const publicSpaceInterventions = findCategoryValue(publicSafety, weekStart, PUBLIC_SAFETY_LABELS.public_space_interventions);

    const cleaningBagsCollected = findCategoryValue(cleaning, weekStart, CLEANING_LABELS.cleaning_bags_collected);
    const cleaningServitudesCleaned = findCategoryValue(cleaning, weekStart, CLEANING_LABELS.cleaning_servitudes_cleaned);
    const cleaningStormwaterDrains = findCategoryValue(cleaning, weekStart, CLEANING_LABELS.cleaning_stormwater_drains_cleaned);
    const cleaningStormwaterBags = findCategoryValue(cleaning, weekStart, CLEANING_LABELS.cleaning_stormwater_bags_filled);

    const callsReceived = findCategoryValue(controlRoomEngagement, weekStart, CONTROL_ROOM_ENGAGEMENT_LABELS.calls_received);
    const whatsappsReceived = findCategoryValue(controlRoomEngagement, weekStart, CONTROL_ROOM_ENGAGEMENT_LABELS.whatsapps_received);
    const parksPrunedTrees = findCategoryValue(sections.parks, weekStart, PARKS_LABELS.pruned_trees);

    return {
      ...week,
      metrics: {
        urban_total: sumSectionForWeek(sections.urban_management, weekStart),
        criminal_incidents: criminalIncidents,
        arrests_made: arrestsMade,
        section56_notices: section56Notices,
        section341_notices: section341Notices,
        proactive_actions: proactiveActions,
        public_space_interventions: publicSpaceInterventions,
        cleaning_bags_collected: cleaningBagsCollected,
        cleaning_servitudes_cleaned: cleaningServitudesCleaned,
        cleaning_stormwater_drains_cleaned: cleaningStormwaterDrains,
        cleaning_stormwater_bags_filled: cleaningStormwaterBags,
        social_touch_points: sumSectionForWeekExcluding(sections.social_services, weekStart, SOCIAL_TOUCH_POINT_EXCLUDED_LABELS),
        parks_total_bags: sumSectionForWeekExcluding(sections.parks, weekStart, PARKS_LABELS.pruned_trees),
        parks_pruned_trees: parksPrunedTrees,
        c3_logged_total: sumSectionForWeek(sections.c3_logged, weekStart),
        c3_resolved_total: sumSectionForWeek(sections.c3_resolved, weekStart),
        calls_received: callsReceived,
        whatsapps_received: whatsappsReceived
      }
    };
  });
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
  const urban = sorted.map((row) => (row.record_status === "REPORTED" ? toNumber(row.metrics.urban_total) : null));
  const crimes = sorted.map((row) => (row.record_status === "REPORTED" ? toNumber(row.metrics.criminal_incidents) : null));
  const cleaning = sorted.map((row) => {
    if (row.record_status !== "REPORTED") {
      return null;
    }
    const collected = toNumber(row.metrics.cleaning_bags_collected);
    const stormwater = toNumber(row.metrics.cleaning_stormwater_bags_filled);
    if (collected === null && stormwater === null) {
      return null;
    }
    return (collected ?? 0) + (stormwater ?? 0);
  });
  const contacts = sorted.map((row) => {
    if (row.record_status !== "REPORTED") {
      return null;
    }
    const calls = toNumber(row.metrics.calls_received);
    const whatsapps = toNumber(row.metrics.whatsapps_received);
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
  const logged = currentWeek?.metrics.c3_logged_total ?? null;
  const resolved = currentWeek?.metrics.c3_resolved_total ?? null;
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

export function deriveC3Breakdown(currentWeek: WeeklyMetricRow | null, sections: SectionMap): C3BreakdownRow[] {
  const weekStart = currentWeek?.week_start ?? null;
  const categories = c3Categories(sections);

  return categories.map((category) => ({
    department: category,
    logged: weekStart ? sectionCategoryValue(sections.c3_logged, category, weekStart) : null,
    resolved: weekStart ? sectionCategoryValue(sections.c3_resolved, category, weekStart) : null
  }));
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
