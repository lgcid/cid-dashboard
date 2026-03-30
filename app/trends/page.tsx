import DashboardPage from "@/app/dashboard-page";

type PageProps = {
  searchParams: Promise<{
    tab?: string;
    weekStart?: string;
    windowWeeks?: string;
    preview?: string;
  }>;
};

export default function TrendsPage({ searchParams }: PageProps) {
  return <DashboardPage initialTab="trends" searchParams={searchParams} />;
}
