import DashboardPage from "@/app/dashboard-page";

type PageProps = {
  searchParams: Promise<{
    tab?: string;
    weekStart?: string;
    windowWeeks?: string;
    preview?: string;
  }>;
};

export default function C3TrackerPage({ searchParams }: PageProps) {
  return <DashboardPage initialTab="c3" searchParams={searchParams} />;
}
