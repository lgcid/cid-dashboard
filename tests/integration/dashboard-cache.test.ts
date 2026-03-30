import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadData = vi.fn();

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
    loadData.mockReset();
    loadData.mockResolvedValue(loadedDashboardData);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reuses cached source data for repeated non-preview requests", async () => {
    const { getDashboardData } = await import("@/lib/dashboard-service");

    await getDashboardData();
    await getDashboardData();

    expect(loadData).toHaveBeenCalledTimes(1);
    expect(loadData).toHaveBeenCalledWith({ preview: undefined });
  });

  it("forces a refresh when preview is present", async () => {
    const { getDashboardData } = await import("@/lib/dashboard-service");

    await getDashboardData();
    await getDashboardData({ preview: "2026-03-10" });
    await getDashboardData();

    expect(loadData).toHaveBeenNthCalledWith(1, { preview: undefined });
    expect(loadData).toHaveBeenNthCalledWith(2, { preview: "2026-03-10" });
    expect(loadData).toHaveBeenNthCalledWith(3, { preview: undefined });
  });

  it("deduplicates concurrent loads for the same cache key", async () => {
    const { getDashboardData } = await import("@/lib/dashboard-service");
    let resolveLoad: (value: typeof loadedDashboardData) => void = () => {
      throw new Error("Pending load resolver was not initialized.");
    };
    const pendingLoad = new Promise<typeof loadedDashboardData>((resolve) => {
      resolveLoad = resolve;
    });

    loadData.mockReset();
    loadData.mockReturnValue(pendingLoad);

    const first = getDashboardData();
    const second = getDashboardData();

    expect(loadData).toHaveBeenCalledTimes(1);

    resolveLoad(loadedDashboardData);
    await Promise.all([first, second]);
  });
});
