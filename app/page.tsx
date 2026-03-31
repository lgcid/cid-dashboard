import DashboardPage from "@/app/dashboard-page";

type PageProps = {
  searchParams: Promise<{
    tab?: string;
    weekStart?: string;
    preview?: string;
  }>;
};

export default function HomePage({ searchParams }: PageProps) {
  return <DashboardPage searchParams={searchParams} />;
}
