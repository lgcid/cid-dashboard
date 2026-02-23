import { HOTSPOT_LIMIT } from "@/lib/config";
import type { HotspotRow, IncidentRow } from "@/types/dashboard";

export function rankHotspots(incidents: IncidentRow[], limit = HOTSPOT_LIMIT): HotspotRow[] {
  const counts = new Map<string, number>();

  for (const incident of incidents) {
    const place = incident.place;
    if (!place || !place.trim()) {
      continue;
    }
    counts.set(place, (counts.get(place) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([street, incident_count]) => ({ street, incident_count }))
    .sort((a, b) => {
      if (b.incident_count !== a.incident_count) {
        return b.incident_count - a.incident_count;
      }
      return a.street.localeCompare(b.street);
    })
    .slice(0, limit);
}
