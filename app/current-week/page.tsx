import DashboardPage from "@/app/dashboard-page";

type PageProps = {
  searchParams: Promise<{
    tab?: string;
    weekStart?: string;
    preview?: string;
  }>;
};

export default function CurrentWeekPage({ searchParams }: PageProps) {
  return <DashboardPage initialTab="main" searchParams={searchParams} />;
}
