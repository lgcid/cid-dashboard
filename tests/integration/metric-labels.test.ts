import { describe, expect, it } from "vitest";
import {
  PUBLIC_SAFETY_LABELS,
  validateDerivedMetricSectionLabels
} from "@/lib/metric-labels";
import type { MatrixSectionKey, SectionData } from "@/types/dashboard";

function buildSection(
  key: MatrixSectionKey,
  categories: string[]
): SectionData {
  return {
    key,
    heading: "Categories",
    categories: categories.map((category) => ({
      category,
      values: {
        "2026-03-02": 1
      }
    }))
  };
}

describe("metric label contract", () => {
  it("accepts the canonical public safety labels", () => {
    const section = buildSection("public_safety", Object.values(PUBLIC_SAFETY_LABELS));

    expect(() => validateDerivedMetricSectionLabels(section)).not.toThrow();
  });

  it("rejects legacy or missing public safety labels", () => {
    const section = buildSection("public_safety", [
      PUBLIC_SAFETY_LABELS.criminal_incidents,
      PUBLIC_SAFETY_LABELS.arrests_made,
      "Pro-active Actions",
      PUBLIC_SAFETY_LABELS.public_space_interventions
    ]);

    expect(() => validateDerivedMetricSectionLabels(section)).toThrow(
      'Section "public_safety" has invalid metric labels: missing required labels: "Stop and Search".'
    );
  });

  it("accepts social services rows when only the excluded labels are fixed", () => {
    const section = buildSection("social_services", [
      "Incidents",
      "Individual Engagements",
      "Some New Outreach Label",
      "Successful ID Applications",
      "Work Readiness Bags Collected"
    ]);

    expect(() => validateDerivedMetricSectionLabels(section)).not.toThrow();
  });

  it("rejects social services sheets that are missing an excluded label", () => {
    const section = buildSection("social_services", [
      "Incidents",
      "Individual Engagements",
      "Work Readiness Bags Collected"
    ]);

    expect(() => validateDerivedMetricSectionLabels(section)).toThrow(
      'Section "social_services" has invalid metric labels: missing required labels: "Successful ID Applications".'
    );
  });

  it("rejects non-canonical parks tree labels", () => {
    const section = buildSection("parks", ["Jutland Park Bags", "Pruned Trees"]);

    expect(() => validateDerivedMetricSectionLabels(section)).toThrow(
      'Section "parks" has invalid metric labels: rename "Pruned Trees" to "Trees Pruned".'
    );
  });
});
