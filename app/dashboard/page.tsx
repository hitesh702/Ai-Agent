import { Dashboard } from "@/component/dashboard/Dashboard";
import { getDashboardMockData } from "@/component/dashboard/mock-data";

export default function DashboardPage() {
  const data = getDashboardMockData();
  return <Dashboard data={data} />;
}
