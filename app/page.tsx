import DashboardClient from "@/components/dashboard-client";
import { getDashboardData } from "@/lib/dashboard-service";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    export?: string;
    weekStart?: string;
    windowWeeks?: string;
    preview?: string;
  }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const weekStart = params?.weekStart;
  const windowWeeks = params?.windowWeeks ? Number(params.windowWeeks) : undefined;
  const preview = params?.preview;
  const enableImageExport = params?.export === "image";
  const initialData = await getDashboardData({
    weekStart,
    windowWeeks: Number.isFinite(windowWeeks) ? windowWeeks : undefined,
    preview
  });

  return <DashboardClient initialData={initialData} enableImageExport={enableImageExport} />;
}
