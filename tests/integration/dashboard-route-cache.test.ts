import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getDashboardPageData = vi.fn();

vi.mock("@/lib/dashboard-service", () => ({
  getDashboardPageData,
  getDashboardTrendsData: vi.fn(),
  getDashboardC3Data: vi.fn()
}));

vi.mock("@/lib/google-sheets", () => ({
  readVercelOidcTokenFromRequestHeaders: vi.fn(() => "oidc-token")
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
  week_context: {
    current_week: null,
    previous_week: null
  },
  current_week_tab: {
    general_incidents_breakdown: [],
    control_room_breakdown: [],
    c3_logged_breakdown: [],
    public_safety_metrics: [],
    cleaning_metrics: [],
    social_services_metrics: [],
    parks_metrics: [],
    incidents: [],
    hotspots: []
  },
  trends: {
    available_from: "2026-02-02",
    available_to: "2026-03-02",
    from: "2026-02-02",
    to: "2026-03-02",
    granularity: "week",
    series: []
  },
  c3: {
    available_from: "2026-02-02",
    available_to: "2026-03-08",
    from: "2026-02-02",
    to: "2026-03-08",
    totals: {
      logged: 0,
      resolved: 0,
      backlog: 0,
      resolution_ratio: null
    },
    breakdown: [],
    pressure_points: []
  }
};

describe("dashboard route cache headers", () => {
  beforeEach(() => {
    vi.resetModules();
    getDashboardPageData.mockReset();
    getDashboardPageData.mockResolvedValue(dashboardPayload);
  });

  it("keeps CDN caching for standard requests", async () => {
    const { GET } = await import("@/app/api/dashboard/route");
    const request = new NextRequest("https://example.com/api/dashboard");

    const response = await GET(request);

    expect(getDashboardPageData).toHaveBeenCalledWith({
      preview: undefined,
      weekStart: undefined,
      vercelOidcToken: "oidc-token"
    });
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=60, s-maxage=60, stale-while-revalidate=120"
    );
  });

  it("disables CDN caching for preview requests", async () => {
    const { GET } = await import("@/app/api/dashboard/route");
    const request = new NextRequest("https://example.com/api/dashboard?preview=2026-03-10");

    const response = await GET(request);

    expect(getDashboardPageData).toHaveBeenCalledWith({
      preview: "2026-03-10",
      weekStart: undefined,
      vercelOidcToken: "oidc-token"
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
  });
});
