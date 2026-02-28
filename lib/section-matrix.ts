import type { SectionData, SectionKey } from "@/types/dashboard";

const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_WEEK_START = "2025-08-01";

function isIsoDay(value: string): boolean {
  return ISO_DAY_PATTERN.test(value);
}

function parseNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const str = String(value).trim();
  if (!str || str.toLowerCase() === "null") {
    return null;
  }
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

export function parseSectionMatrix(rows: string[][], key: SectionKey): SectionData {
  const header = rows[0] ?? [];
  const heading = String(header[0] ?? "").trim() || "Categories";

  const weekColumns: Array<{ columnIndex: number; weekStart: string }> = [];
  for (let columnIndex = 1; columnIndex < header.length; columnIndex += 1) {
    const weekStart = String(header[columnIndex] ?? "").trim();
    if (!isIsoDay(weekStart)) {
      continue;
    }
    if (weekStart < MIN_WEEK_START) {
      continue;
    }
    weekColumns.push({ columnIndex, weekStart });
  }

  const categories = rows
    .slice(1)
    .map((row) => {
      const category = String(row[0] ?? "").trim();
      if (!category) {
        return null;
      }

      const values: Record<string, number | null> = {};
      for (const { columnIndex, weekStart } of weekColumns) {
        values[weekStart] = parseNullableNumber(row[columnIndex]);
      }

      return {
        category,
        values
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return {
    key,
    heading,
    categories
  };
}

export const WEEK_START_BASELINE = MIN_WEEK_START;
