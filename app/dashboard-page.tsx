import DashboardClient from "@/components/dashboard-client";
import { getDashboardData } from "@/lib/dashboard-service";

export const dynamic = "force-dynamic";

type DashboardTab = "main" | "summary" | "trends" | "c3" | "summary-image";

type DashboardPageProps = {
  initialTab?: DashboardTab;
  searchParams: Promise<{
    tab?: string;
    weekStart?: string;
    windowWeeks?: string;
    preview?: string;
  }>;
};

export default async function DashboardPage({
  initialTab = "summary",
  searchParams
}: DashboardPageProps) {
  const params = await searchParams;
  const weekStart = params?.weekStart;
  const windowWeeks = params?.windowWeeks ? Number(params.windowWeeks) : undefined;
  const preview = params?.preview;
  const resolvedInitialTab = params?.tab === "summary-image" ? "summary-image" : initialTab;
  const initialData = await getDashboardData({
    weekStart,
    windowWeeks: Number.isFinite(windowWeeks) ? windowWeeks : undefined,
    preview
  });

  return <DashboardClient initialData={initialData} initialTab={resolvedInitialTab} />;
}
