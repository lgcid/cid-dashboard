import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getDashboardData = vi.fn();

vi.mock("@/lib/dashboard-service", () => ({
  getDashboardData
}));

const dashboardPayload = {
  meta: {
    generated_at: "2026-03-30T00:00:00.000Z",
    reporting_window_start: "2026-02-02",
    reporting_window_end: "2026-03-08",
    data_updated_at: "2026-03-08",
    selected_week_start: "2026-03-02",
    available_weeks: ["2026-03-02"],
    data_source: "local_csv"
  },
  weeks: [],
  sections: {},
  weekly: [],
  current_week: null,
  trends: [],
  c3_tracker_totals: {
    logged: 0,
    resolved: 0,
    backlog: 0,
    resolution_ratio: null
  },
  c3_tracker_breakdown: [],
  c3_request_rows: [],
  hotspots: [],
  incidents: []
};

describe("dashboard route cache headers", () => {
  beforeEach(() => {
    vi.resetModules();
    getDashboardData.mockReset();
    getDashboardData.mockResolvedValue(dashboardPayload);
  });

  it("keeps CDN caching for standard requests", async () => {
    const { GET } = await import("@/app/api/dashboard/route");
    const request = new NextRequest("https://example.com/api/dashboard");

    const response = await GET(request);

    expect(getDashboardData).toHaveBeenCalledWith({
      preview: undefined,
      weekStart: undefined,
      windowWeeks: undefined
    });
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=60, s-maxage=60, stale-while-revalidate=120"
    );
  });

  it("disables CDN caching for preview requests", async () => {
    const { GET } = await import("@/app/api/dashboard/route");
    const request = new NextRequest("https://example.com/api/dashboard?preview=2026-03-10");

    const response = await GET(request);

    expect(getDashboardData).toHaveBeenCalledWith({
      preview: "2026-03-10",
      weekStart: undefined,
      windowWeeks: undefined
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
  });
});
