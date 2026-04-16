import { headers } from "next/headers";
import DashboardClient from "@/components/dashboard-client";
import { readVercelOidcTokenFromRequestHeaders } from "@/lib/google-sheets";
import { getDashboardPageData } from "@/lib/dashboard-service";

export const dynamic = "force-dynamic";

type DashboardTab = "main" | "summary" | "trends" | "c3" | "summary-image";

type DashboardPageProps = {
  initialTab?: DashboardTab;
  searchParams: Promise<{
    tab?: string;
    weekStart?: string;
    preview?: string;
  }>;
};

export default async function DashboardPage({
  initialTab = "summary",
  searchParams
}: DashboardPageProps) {
  const params = await searchParams;
  const weekStart = params?.weekStart;
  const preview = params?.preview;
  const resolvedInitialTab = params?.tab === "summary-image" ? "summary-image" : initialTab;
  const requestHeaders = await headers();
  const vercelOidcToken = readVercelOidcTokenFromRequestHeaders(requestHeaders) ?? undefined;
  const initialData = await getDashboardPageData({
    weekStart,
    preview,
    vercelOidcToken
  });

  return <DashboardClient initialData={initialData} initialTab={resolvedInitialTab} />;
}
