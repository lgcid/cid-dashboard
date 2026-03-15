import { normalizeSheetDay } from "@/lib/date-utils";
import type { SectionData, SectionKey } from "@/types/dashboard";

const MIN_WEEK_START = "2025-08-01";

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

  const dateColumns: Array<{ columnIndex: number; weekStart: string }> = [];
  for (let columnIndex = 1; columnIndex < header.length; columnIndex += 1) {
    const weekStart = normalizeSheetDay(header[columnIndex]);
    if (!weekStart) {
      continue;
    }
    if (weekStart < MIN_WEEK_START) {
      continue;
    }
    dateColumns.push({ columnIndex, weekStart });
  }

  if (dateColumns.length === 0) {
    throw new Error(
      `Section "${key}" must use week headers in row 1 (B1 onward) and category labels in column A (A2 downward).`
    );
  }

  const categories = rows.slice(1).flatMap((row) => {
    const category = String(row[0] ?? "").trim();
    if (!category) {
      return [];
    }

    const values: Record<string, number | null> = {};
    for (const { columnIndex, weekStart } of dateColumns) {
      values[weekStart] = parseNullableNumber(row[columnIndex]);
    }

    return {
      category,
      values
    };
  });

  return {
    key,
    heading,
    categories
  };
}

export const WEEK_START_BASELINE = MIN_WEEK_START;
