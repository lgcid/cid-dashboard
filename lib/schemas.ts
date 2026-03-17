import { normalizeSheetDay } from "@/lib/date-utils";
import { z } from "zod";

const trimmedString = z.string().transform((value) => value.trim());
const nullableTrimmedString = z.string().transform((value) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
});
const nullableBooleanish = z.preprocess((value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (["true", "yes", "y", "1", "resolved"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "n", "0", "unresolved"].includes(normalized)) {
    return false;
  }

  return value;
}, z.boolean().nullable());

export const incidentSchema = z.object({
  week_start: z.preprocess((value) => {
    const normalized = normalizeSheetDay(value);
    if (normalized) {
      return normalized;
    }
    return String(value ?? "").trim();
  }, z.string()),
  incident_date: z.preprocess((value) => {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = normalizeSheetDay(value);
    if (normalized) {
      return normalized;
    }

    const str = String(value).trim();
    return str ? str : null;
  }, z.string().nullable()),
  place: z.string(),
  summary: z.string(),
  category: z.string()
});

export const incidentRowsSchema = z.array(incidentSchema);

export const c3RequestRowSchema = z.object({
  category: trimmedString,
  reference_number: nullableTrimmedString,
  date_logged: nullableTrimmedString,
  request_status: nullableTrimmedString,
  resolved: nullableBooleanish.optional().transform((value) => value ?? null),
  issue_description: trimmedString,
  service: trimmedString,
  address: trimmedString
});

export const c3RequestRowsSchema = z.array(c3RequestRowSchema);

export const publishedWeekRowSchema = z.object({
  week_start: z.preprocess((value) => {
    const normalized = normalizeSheetDay(value);
    if (normalized) {
      return normalized;
    }
    return String(value ?? "").trim();
  }, z.string())
});

export const publishedWeekRowsSchema = z.array(publishedWeekRowSchema);
