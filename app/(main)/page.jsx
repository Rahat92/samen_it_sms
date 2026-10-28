export const dynamic = "force-dynamic";
import { useDashboard } from "@/components/DashboardProvider";
import DashboardView from "@/components/views/DashboardView";
import { getCurrentUser } from "@/lib/auth";
import {
  getStats,
  getDaily,
  getFilterOptions,
  getEvents,
} from "@/lib/queries";
export const metadata = { title: { absolute: "Dashboard · Mail Dashboard" } };

export default async function Page() {
  const {set} = useDashboard()
  const currentUser = await getCurrentUser()
  console.log(currentUser);
  const [stats, daily, filters, result ] = await Promise.all([
    getStats(''),
    getDaily(),
    getFilterOptions(),
    getEvents({
      q: "",
      status: "",
      event: "",
      page: 1,
      pageSize: 10,
    }),
  ]);
  // console.log("DashboardPage", { stats, daily, filters, result });
  return <DashboardView daily={daily} currentUser = {currentUser} filters={filters} result={result} />;
}
