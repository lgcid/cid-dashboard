import type { MatrixSectionKey, SectionData, SectionKey } from "@/types/dashboard";

export const PUBLIC_SAFETY_LABELS = {
  criminal_incidents: "Criminal Incidents",
  arrests_made: "Arrests Made",
  proactive_actions: "Stop and Search",
  public_space_interventions: "Public Space Interventions"
} as const;

export const LAW_ENFORCEMENT_LABELS = {
  section56_notices: "Section 56 Notices",
  section341_notices: "Section 341 Notices"
} as const;

export const CLEANING_LABELS = {
  cleaning_bags_collected: "Bags Filled and Collected",
  cleaning_servitudes_cleaned: "Servitudes Cleaned",
  cleaning_stormwater_drains_cleaned: "Stormwater Drains Cleaned",
  cleaning_stormwater_bags_filled: "Stormwater Bags Filled"
} as const;

export const CONTROL_ROOM_ENGAGEMENT_LABELS = {
  calls_received: "Calls Received",
  whatsapps_received: "WhatsApps Received"
} as const;

export const SOCIAL_SERVICES_LABELS = [
  "Incidents",
  "Client Follow Ups",
  "Individual Engagements",
  "Support Sessions",
  "ID Applications",
  "Successful ID Applications",
  "Referred Clients to Shelters",
  "Work Readiness Bags Collected"
] as const;

export const SOCIAL_TOUCH_POINT_EXCLUDED_LABELS = [
  "Work Readiness Bags Collected",
  "Successful ID Applications"
] as const;

export const PARKS_LABELS = {
  pruned_trees: "Trees Pruned"
} as const;

const REQUIRED_DERIVED_LABELS_BY_SECTION: Partial<Record<SectionKey, readonly string[]>> = {
  public_safety: Object.values(PUBLIC_SAFETY_LABELS),
  law_enforcement: Object.values(LAW_ENFORCEMENT_LABELS),
  cleaning: Object.values(CLEANING_LABELS),
  social_services: SOCIAL_SERVICES_LABELS,
  control_room_engagement: Object.values(CONTROL_ROOM_ENGAGEMENT_LABELS)
};

function quote(label: string): string {
  return `"${label}"`;
}

function labelsForSection(section: SectionData): Set<string> {
  return new Set(section.categories.map((row) => row.category));
}

function validateCanonicalParksLabels(section: SectionData): string[] {
  if (section.key !== "parks") {
    return [];
  }

  return section.categories
    .map((row) => row.category)
    .filter((label) => /\btrees?\b/i.test(label) && label !== PARKS_LABELS.pruned_trees)
    .map((label) => `rename ${quote(label)} to ${quote(PARKS_LABELS.pruned_trees)}`);
}

export function validateDerivedMetricSectionLabels(section: SectionData): void {
  const expectedLabels = REQUIRED_DERIVED_LABELS_BY_SECTION[section.key];
  const presentLabels = labelsForSection(section);
  const missingLabels = (expectedLabels ?? []).filter((label) => !presentLabels.has(label));
  const canonicalizationErrors = validateCanonicalParksLabels(section);

  if (!missingLabels.length && !canonicalizationErrors.length) {
    return;
  }

  const issues: string[] = [];
  if (missingLabels.length) {
    issues.push(`missing required labels: ${missingLabels.map(quote).join(", ")}`);
  }
  if (canonicalizationErrors.length) {
    issues.push(canonicalizationErrors.join(", "));
  }

  throw new Error(`Section "${section.key}" has invalid metric labels: ${issues.join("; ")}.`);
}

export function validateDerivedMetricSections(
  sections: Record<MatrixSectionKey, SectionData>
): void {
  for (const section of Object.values(sections)) {
    validateDerivedMetricSectionLabels(section);
  }
}
