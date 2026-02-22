import { addDays, format, isValid, parseISO } from "date-fns";

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
