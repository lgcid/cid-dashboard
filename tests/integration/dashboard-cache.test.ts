import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const unstableCache = vi.fn(<T extends (...args: unknown[]) => unknown>(callback: T) => callback);
const loadData = vi.fn();
const originalNodeEnv = process.env.NODE_ENV;

vi.mock("next/cache", () => ({
  unstable_cache: unstableCache
}));

vi.mock("@/lib/data-source", () => ({
  loadData
}));

const baseSections = {
  general_incidents: { key: "general_incidents", heading: "General incidents", categories: [] },
  public_safety: { key: "public_safety", heading: "Public safety", categories: [] },
  law_enforcement: { key: "law_enforcement", heading: "Law enforcement", categories: [] },
  cleaning: { key: "cleaning", heading: "Cleaning", categories: [] },
  social_services: { key: "social_services", heading: "Social services", categories: [] },
  parks: { key: "parks", heading: "Parks", categories: [] },
  control_room_engagement: { key: "control_room_engagement", heading: "Control room", categories: [] },
  c3_requests: { key: "c3_requests", heading: "C3", categories: [] }
} as const;

const loadedDashboardData = {
  sections: baseSections,
  incidents: [],
  c3Insights: {
    trackerTotals: {
      logged: 0,
      resolved: 0,
      backlog: 0,
      resolution_ratio: null
    },
    trackerBreakdown: [],
    loggedSection: baseSections.c3_requests
  },
  c3Requests: [],
  publishedWeeks: ["2025-08-01"],
  source: "local_csv" as const
};

describe("dashboard data cache", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = "production";
    unstableCache.mockClear();
    loadData.mockReset();
    loadData.mockResolvedValue(loadedDashboardData);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.clearAllMocks();
  });

  it("wraps source loading in the shared dashboard cache", async () => {
    await import("@/lib/dashboard-service");

    expect(unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ["dashboard-source-data"],
      expect.objectContaining({
        revalidate: 300,
        tags: ["dashboard-data"]
      })
    );
  });

  it("does not force a refresh when preview is absent", async () => {
    const { getDashboardData } = await import("@/lib/dashboard-service");

    await getDashboardData();

    expect(loadData).toHaveBeenCalledWith({ preview: undefined });
  });

  it("bypasses the shared cache when preview data is requested", async () => {
    const { getDashboardData } = await import("@/lib/dashboard-service");

    await getDashboardData({ preview: "2026-03-10" });

    expect(loadData).toHaveBeenCalledWith({ preview: "2026-03-10" });
  });
});
