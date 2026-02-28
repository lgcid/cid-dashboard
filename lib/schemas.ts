import { z } from "zod";

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
