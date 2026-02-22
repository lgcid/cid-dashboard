import { HOTSPOT_LIMIT } from "@/lib/config";
import type { HotspotRow, IncidentRow } from "@/types/dashboard";

const STREET_ALIASES: Array<[RegExp, string]> = [
  [/\bbarnett\b/gi, "barnet"],
  [/\bwembley\s+rd\b/gi, "wembley road"],
  [/\bglyn\b/gi, "glynn"],
  [/\bglynville\s+terrace\b/gi, "glynville"],
  [/\bst\.?\s+johns\b/gi, "st johns"],
  [/\broeland\b/gi, "roeland"],
  [/\btuin\s+plein\b/gi, "tuin plein"]
];

const SPLIT_PATTERNS = /(\bnearest corner\b|\bcorner\b|\bbetween\b|\band\b|\/|,|\(|\)|;)/i;

const TOKEN_ALIASES: Record<string, string> = {
  buitenkant: "buitenkant street",
  hope: "hope street",
  wandel: "wandel street",
  wesley: "wesley street",
  maynard: "maynard street",
  mckenzie: "mckenzie street",
  roeland: "roeland street"
};

export function normalizePlace(raw: string): string {
  let value = raw.toLowerCase().trim();
  value = value.replace(/\s+/g, " ");
  for (const [pattern, replacement] of STREET_ALIASES) {
    value = value.replace(pattern, replacement);
  }
  return value;
}

export function extractStreetTokens(place: string): string[] {
  const normalized = normalizePlace(place);
  const tokens = normalized
    .split(SPLIT_PATTERNS)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^(nearest corner|corner|between|and|\/|,|\(|\)|;)$/.test(part));

  return tokens
    .map((token) => token.replace(/\s+/g, " ").trim())
    .filter((token) => /(street|road|lane|terrace|park|bridge|verge|plein|courville|wandel|buitenkant|hope|maynard|wesley|mill|mckenzie)/.test(token))
    .filter((token) => token.length > 1)
    .map((token) =>
      token
        .replace(/\bnearest\b|\bopposite\b|\bthe\b|\bat\b|\bon\b|\boff\b/g, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((token) => token.length > 3)
    .map((token) => TOKEN_ALIASES[token] ?? token)
    .filter(Boolean);
}

export function rankHotspots(incidents: IncidentRow[], limit = HOTSPOT_LIMIT): HotspotRow[] {
  const counts = new Map<string, number>();

  for (const incident of incidents) {
    const tokens = extractStreetTokens(incident.place_raw);
    const deduped = new Set(tokens);
    for (const token of deduped) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
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
