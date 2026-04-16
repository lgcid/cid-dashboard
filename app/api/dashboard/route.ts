import { NextRequest, NextResponse } from "next/server";
import { readVercelOidcTokenFromRequestHeaders } from "@/lib/google-sheets";
import { getDashboardC3Data, getDashboardPageData, getDashboardTrendsData } from "@/lib/dashboard-service";
import type { TrendGranularity } from "@/types/dashboard";

const DEFAULT_CACHE_CONTROL = "public, max-age=60, s-maxage=60, stale-while-revalidate=120";
const PREVIEW_CACHE_CONTROL = "no-store, max-age=0";

function parseGranularity(value: string | null): TrendGranularity | undefined {
  if (value === "week" || value === "month" || value === "year") {
    return value;
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") ?? "page";
    const weekStart = searchParams.get("weekStart") ?? undefined;
    const preview = searchParams.get("preview") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    const granularity = parseGranularity(searchParams.get("granularity"));
    const vercelOidcToken = readVercelOidcTokenFromRequestHeaders(request.headers) ?? undefined;

    const payload = view === "trends"
      ? await getDashboardTrendsData({
        preview,
        weekStart,
        from,
        to,
        granularity,
        vercelOidcToken
      })
      : view === "c3"
        ? await getDashboardC3Data({
          preview,
          weekStart,
          from,
          to,
          vercelOidcToken
        })
        : await getDashboardPageData({
          weekStart,
          preview,
          vercelOidcToken
        });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": preview ? PREVIEW_CACHE_CONTROL : DEFAULT_CACHE_CONTROL
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
