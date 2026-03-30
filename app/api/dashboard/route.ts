import { NextRequest, NextResponse } from "next/server";
import { getDashboardData } from "@/lib/dashboard-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart") ?? undefined;
    const windowWeeksParam = searchParams.get("windowWeeks");
    const windowWeeks = windowWeeksParam ? Number(windowWeeksParam) : undefined;
    const preview = searchParams.get("preview") ?? undefined;

    const payload = await getDashboardData({
      weekStart,
      windowWeeks: Number.isFinite(windowWeeks) ? windowWeeks : undefined,
      preview
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected dashboard failure";
    return NextResponse.json(
      {
        error: "DASHBOARD_API_ERROR",
        message
      },
      { status: 500 }
    );
  }
}
