import { addDays, format, isValid, parseISO } from "date-fns";

const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MONTH_YEAR_PATTERN = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/;
const NUMERIC_PATTERN = /^-?\d+(?:\.\d+)?$/;
const GOOGLE_SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 24 * 60 * 60 * 1000;

export function isIsoDay(value: string): boolean {
  return ISO_DAY_PATTERN.test(value);
}

export function isValidDateParts(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseGoogleSheetsSerialDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) {
    return null;
  }

  const wholeDays = Math.floor(serial);
  if (wholeDays < 1) {
    return null;
  }

  return new Date(GOOGLE_SHEETS_EPOCH_MS + wholeDays * DAY_MS);
}

export function parseSheetDay(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return parseGoogleSheetsSerialDate(value);
  }

  const cleaned = String(value).trim().replace(/['"]/g, "");
  if (!cleaned) {
    return null;
  }

  if (isIsoDay(cleaned)) {
    const [year, month, day] = cleaned.split("-").map((part) => Number.parseInt(part, 10));
    if (!isValidDateParts(year, month, day)) {
      return null;
    }
    return new Date(Date.UTC(year, month - 1, day));
  }

  const dayMonthYearMatch = cleaned.match(DAY_MONTH_YEAR_PATTERN);
  if (dayMonthYearMatch) {
    const [, dayRaw, monthRaw, yearRaw] = dayMonthYearMatch;
    const day = Number.parseInt(dayRaw, 10);
    const month = Number.parseInt(monthRaw, 10);
    const year = Number.parseInt(yearRaw, 10);
    if (!isValidDateParts(year, month, day)) {
      return null;
    }
    return new Date(Date.UTC(year, month - 1, day));
  }

  if (NUMERIC_PATTERN.test(cleaned)) {
    return parseGoogleSheetsSerialDate(Number(cleaned));
  }

  return null;
}

export function normalizeSheetDay(value: unknown): string | null {
  const parsed = parseSheetDay(value);
  return parsed ? toIsoDay(parsed) : null;
}

export function safeDate(input: string): Date | null {
  const parsed = parseISO(input);
  return isValid(parsed) ? parsed : null;
}

export function formatWeekLabel(startIso: string, endIso: string): string {
  const start = safeDate(startIso);
  const end = safeDate(endIso);
  if (!start || !end) {
    return `${startIso} to ${endIso}`;
  }
  return `${format(start, "dd MMM yyyy")} to ${format(end, "dd MMM yyyy")}`;
}

export function weekEndFromStart(startIso: string): string {
  const start = safeDate(startIso);
  if (!start) {
    return startIso;
  }
  return format(addDays(start, 6), "yyyy-MM-dd");
}
