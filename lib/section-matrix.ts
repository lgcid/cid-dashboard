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
  const heading = String(header[0] ?? "").trim() || "week_start";
  const firstDataCell = String(rows[1]?.[0] ?? "").trim();

  const dateColumns: Array<{ columnIndex: number; weekStart: string }> = [];
  for (let columnIndex = 1; columnIndex < header.length; columnIndex += 1) {
    const weekStart = String(header[columnIndex] ?? "").trim();
    if (!isIsoDay(weekStart)) {
      continue;
    }
    if (weekStart < MIN_WEEK_START) {
      continue;
    }
    dateColumns.push({ columnIndex, weekStart });
  }

  const isTransposedMatrix = dateColumns.length > 0 && !isIsoDay(firstDataCell);
  if (isTransposedMatrix) {
    const categories = rows.slice(1).flatMap((row) => {
      const category = String(row[0] ?? "").trim();
      if (!category) {
        return [];
      }

      const values: Record<string, number | null> = {};
      for (const { columnIndex, weekStart } of dateColumns) {
        values[weekStart] = parseNullableNumber(row[columnIndex]);
      }

      return [
        {
          category,
          values
        }
      ];
    });

    return {
      key,
      heading,
      categories
    };
  }

  const categoryColumns: Array<{ columnIndex: number; category: string }> = [];
  for (let columnIndex = 1; columnIndex < header.length; columnIndex += 1) {
    const category = String(header[columnIndex] ?? "").trim();
    if (!category) {
      continue;
    }
    categoryColumns.push({ columnIndex, category });
  }

  const weekRows: Array<{ row: string[]; weekStart: string }> = [];
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const weekStart = String(row[0] ?? "").trim();
    if (!isIsoDay(weekStart)) {
      continue;
    }
    if (weekStart < MIN_WEEK_START) {
      continue;
    }
    weekRows.push({ row, weekStart });
  }

  const categories = categoryColumns.map(({ columnIndex, category }) => {
    const values: Record<string, number | null> = {};
    for (const { row, weekStart } of weekRows) {
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
