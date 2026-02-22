import DashboardClient from "@/components/dashboard-client";
import { getDashboardData } from "@/lib/dashboard-service";

type PageProps = {
  searchParams?: {
    weekStart?: string;
    windowWeeks?: string;
  };
};

export default async function HomePage({ searchParams }: PageProps) {
  const weekStart = searchParams?.weekStart;
  const windowWeeks = searchParams?.windowWeeks ? Number(searchParams.windowWeeks) : undefined;
  const initialData = await getDashboardData({
    weekStart,
    windowWeeks: Number.isFinite(windowWeeks) ? windowWeeks : undefined
  });

  return <DashboardClient initialData={initialData} />;
}
