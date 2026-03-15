import { isIsoDay, isValidDateParts, parseSheetDay, toIsoDay } from "@/lib/date-utils";
import { WEEK_START_BASELINE } from "@/lib/section-matrix";
import type {
  C3RequestRow,
  C3TrackerBreakdownRow,
  C3TrackerTotals,
  SectionData
} from "@/types/dashboard";

const DAY_MS = 24 * 60 * 60 * 1000;

const FINAL_STATUSES = new Set(["closed", "completed", "service request completed"]);

const CATEGORY_ORDER = [
  "Roads & Infrastructure",
  "Water & Sanitation",
  "Electricity",
  "Parks & Recreation",
  "Waste Management",
  "Environmental Health",
  "Law Enforcement",
  "Traffic"
] as const;

const CATEGORY_ALIASES: Record<string, string> = {
  "roads and infrastructure": "Roads & Infrastructure",
  "roads infrastructure": "Roads & Infrastructure",
  "water and sanitation": "Water & Sanitation",
  "water sanitation": "Water & Sanitation",
  "water and sanitasion": "Water & Sanitation",
  "parks and recreation": "Parks & Recreation",
  "parks recreation": "Parks & Recreation",
  "city parks and recreation": "Parks & Recreation",
  "city parks recreation": "Parks & Recreation",
  "waste management": "Waste Management",
  "waste removal": "Waste Management",
  "environmental health": "Environmental Health",
  "law enforcement": "Law Enforcement",
  "safety and security": "Law Enforcement",
  "safety security": "Law Enforcement",
  traffic: "Traffic",
  electricity: "Electricity"
};

type WeeklyCategoryCounts = Record<string, Record<string, number>>;

export interface C3RequestInsights {
  loggedSection: SectionData;
  trackerTotals: C3TrackerTotals;
  trackerBreakdown: C3TrackerBreakdownRow[];
}

function normalizeWhitespace(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeLookup(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeC3RequestCategory(value: string): string {
  const normalized = normalizeLookup(value);
  return CATEGORY_ALIASES[normalized] ?? normalizeWhitespace(value);
}

function parseLoggedDate(value: string | null): Date | null {
  return parseSheetDay(normalizeWhitespace(value));
}

export function normalizeC3RequestDate(value: string | null): string | null {
  const parsed = parseLoggedDate(value);
  return parsed ? toIsoDay(parsed) : null;
}

function parseIsoDay(value: string): Date | null {
  if (!isIsoDay(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  if (!isValidDateParts(year, month, day)) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function diffUtcDays(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / DAY_MS);
}

export function isFinalC3Status(status: string | null): boolean {
  return FINAL_STATUSES.has(normalizeLookup(status ?? ""));
}

export function isResolvedC3Request(row: Pick<C3RequestRow, "request_status" | "resolved">): boolean {
  return row.resolved === true;
}

function incrementWeekCategoryCount(
  store: WeeklyCategoryCounts,
  weekStart: string,
  category: string
): void {
  store[weekStart] ??= {};
  store[weekStart][category] = (store[weekStart][category] ?? 0) + 1;
}

export function compareC3Categories(a: string, b: string): number {
  const orderA = CATEGORY_ORDER.indexOf(a as (typeof CATEGORY_ORDER)[number]);
  const orderB = CATEGORY_ORDER.indexOf(b as (typeof CATEGORY_ORDER)[number]);

  if (orderA !== -1 || orderB !== -1) {
    if (orderA === -1) {
      return 1;
    }
    if (orderB === -1) {
      return -1;
    }
    return orderA - orderB;
  }

  return a.localeCompare(b);
}

function collectKnownWeekStarts(sections: SectionData[]): string[] {
  const weekStarts = new Set<string>([WEEK_START_BASELINE]);

  for (const section of sections) {
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

  return [...weekStarts].sort((a, b) => a.localeCompare(b));
}

function resolveWeekStart(date: Date, knownWeekStarts: string[]): string | null {
  const isoDay = toIsoDay(date);
  if (isoDay < WEEK_START_BASELINE) {
    return null;
  }

  let bucketStart = WEEK_START_BASELINE;
  for (const weekStart of knownWeekStarts) {
    if (weekStart > isoDay) {
      break;
    }
      bucketStart = weekStart;
  }

  const bucketDate = parseIsoDay(bucketStart);
  if (!bucketDate) {
    return bucketStart;
  }

  const gapDays = diffUtcDays(date, bucketDate);
  if (gapDays <= 6) {
    return bucketStart;
  }

  return toIsoDay(addUtcDays(bucketDate, Math.floor(gapDays / 7) * 7));
}

export function normalizeC3RequestRows(rows: C3RequestRow[]): C3RequestRow[] {
  return rows.map((row) => {
    const referenceNumber = normalizeWhitespace(row.reference_number);
    const requestStatus = normalizeWhitespace(row.request_status);

    return {
      category: normalizeC3RequestCategory(row.category),
      reference_number: referenceNumber || null,
      date_logged: normalizeC3RequestDate(row.date_logged),
      request_status: requestStatus || null,
      resolved: row.resolved ?? null,
      issue_description: normalizeWhitespace(row.issue_description),
      service: normalizeWhitespace(row.service),
      address: normalizeWhitespace(row.address)
    };
  });
}

function buildLoggedSection(loggedByWeekCategory: WeeklyCategoryCounts): SectionData {
  const categories = new Set<string>();

  for (const countsByCategory of Object.values(loggedByWeekCategory)) {
    for (const category of Object.keys(countsByCategory)) {
      categories.add(category);
    }
  }

  const orderedCategories = [...categories].sort(compareC3Categories);
  return {
    key: "c3_requests",
    heading: "Categories",
    categories: orderedCategories.map((category) => {
      const values: Record<string, number | null> = {};
      for (const [weekStart, countsByCategory] of Object.entries(loggedByWeekCategory)) {
        if (countsByCategory[category] === undefined) {
          continue;
        }
        values[weekStart] = countsByCategory[category];
      }

      return {
        category,
        values
      };
    })
  };
}

function buildTrackerBreakdown(
  loggedTotalsByCategory: Record<string, number>,
  resolvedTotalsByCategory: Record<string, number>
): C3TrackerBreakdownRow[] {
  return Object.keys(loggedTotalsByCategory)
    .sort(compareC3Categories)
    .map((category) => {
      const logged = loggedTotalsByCategory[category] ?? 0;
      const resolved = resolvedTotalsByCategory[category] ?? 0;
      const backlog = Math.max(logged - resolved, 0);

      return {
        department: category,
        logged,
        resolved,
        backlog,
        resolution_ratio: logged === 0 ? null : Number((resolved / logged).toFixed(2))
      };
    });
}

function buildTrackerTotals(breakdown: C3TrackerBreakdownRow[]): C3TrackerTotals {
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

export function buildC3RequestInsights(
  rows: C3RequestRow[],
  referenceSections: SectionData[]
): C3RequestInsights {
  const knownWeekStarts = collectKnownWeekStarts(referenceSections);
  const loggedByWeekCategory: WeeklyCategoryCounts = {};
  const resolvedByWeekCategory: WeeklyCategoryCounts = {};
  const loggedTotalsByCategory: Record<string, number> = {};
  const resolvedTotalsByCategory: Record<string, number> = {};

  for (const row of rows) {
    const category = normalizeC3RequestCategory(row.category);
    const loggedDate = parseLoggedDate(row.date_logged);
    if (!category || !loggedDate) {
      continue;
    }

    const weekStart = resolveWeekStart(loggedDate, knownWeekStarts);
    if (!weekStart) {
      continue;
    }

    incrementWeekCategoryCount(loggedByWeekCategory, weekStart, category);
    loggedTotalsByCategory[category] = (loggedTotalsByCategory[category] ?? 0) + 1;

    if (!isResolvedC3Request(row)) {
      continue;
    }

    incrementWeekCategoryCount(resolvedByWeekCategory, weekStart, category);
    resolvedTotalsByCategory[category] = (resolvedTotalsByCategory[category] ?? 0) + 1;
  }

  const trackerBreakdown = buildTrackerBreakdown(loggedTotalsByCategory, resolvedTotalsByCategory);

  return {
    loggedSection: buildLoggedSection(loggedByWeekCategory),
    trackerTotals: buildTrackerTotals(trackerBreakdown),
    trackerBreakdown
  };
}
