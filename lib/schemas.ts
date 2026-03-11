import { z } from "zod";

const trimmedString = z.string().transform((value) => value.trim());
const nullableTrimmedString = z.string().transform((value) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
});

export const incidentSchema = z.object({
  week_start: z.string(),
  incident_date: z.preprocess((value) => {
    if (value === null || value === undefined) {
      return null;
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
  issue_description: trimmedString,
  service: trimmedString,
  address: trimmedString
});

export const c3RequestRowsSchema = z.array(c3RequestRowSchema);
