import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadData } from "@/lib/data-source";
import { getDashboardData } from "@/lib/dashboard-service";

const ENV_KEYS = [
  "DATA_SOURCE",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SHEET_ID",
  "GOOGLE_WORKLOAD_IDENTITY_AUDIENCE",
  "GOOGLE_WORKLOAD_IDENTITY_PROVIDER",
  "VERCEL_OIDC_TOKEN"
] as const;

const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]])) as Record<(typeof ENV_KEYS)[number], string | undefined>;

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV[key];
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
}

describe("dashboard data pipeline", () => {
  beforeEach(() => {
    restoreEnv();
    process.env.DATA_SOURCE = "local_csv";
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SHEET_ID;
    delete process.env.GOOGLE_WORKLOAD_IDENTITY_AUDIENCE;
    delete process.env.GOOGLE_WORKLOAD_IDENTITY_PROVIDER;
    delete process.env.VERCEL_OIDC_TOKEN;
  });

  afterEach(() => {
    restoreEnv();
  });

  it("loads the checked-in local CSV data", async () => {
    const data = await loadData();

    expect(data.source).toBe("local_csv");
    expect(Object.keys(data.sections)).toEqual(
      expect.arrayContaining([
        "urban_management",
        "public_safety",
        "law_enforcement",
        "cleaning",
        "social_services",
        "parks",
        "control_room_engagement",
        "c3_requests"
      ])
    );
    expect(data.sections.public_safety.categories.length).toBeGreaterThan(0);
    expect(data.incidents.length).toBeGreaterThan(0);
    expect(data.c3Requests.length).toBeGreaterThan(0);
  });

  it("returns fixed historical metrics for the 2026-02-23 reporting week", async () => {
    const data = await getDashboardData({ weekStart: "2026-02-23" });
    const incidents = data.incidents.filter((incident) => incident.week_start === "2026-02-23");

    expect(data.meta.data_source).toBe("local_csv");
    expect(data.meta.selected_week_start).toBe("2026-02-23");
    expect(data.current_week?.week_start).toBe("2026-02-23");
    expect(data.current_week?.metrics.criminal_incidents).toBe(5);
    expect(data.current_week?.metrics.arrests_made).toBe(3);
    expect(data.current_week?.metrics.section56_notices).toBe(5);
    expect(data.current_week?.metrics.section341_notices).toBe(47);
    expect(data.current_week?.metrics.c3_logged_total).toBe(18);
    expect(incidents).toHaveLength(5);
    expect(incidents.map((incident) => incident.place)).toEqual(
      expect.arrayContaining(["Roeland Street", "Buitenkant Street", "Scott Street"])
    );
  });

  it("falls back to the default selected week when the requested week is not available", async () => {
    const defaultData = await getDashboardData();
    const invalidWeekData = await getDashboardData({ weekStart: "1900-01-01" });

    expect(invalidWeekData.meta.selected_week_start).toBe(defaultData.meta.selected_week_start);
    expect(invalidWeekData.current_week?.week_start).toBe(defaultData.current_week?.week_start);
  });
});
