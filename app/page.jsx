export const dynamic = "force-dynamic";
import DashboardView from "@/components/views/DashboardView";
import {
  getStats,
  getDaily,
  getFilterOptions,
  getEvents,
} from "@/lib/queries";
export const metadata = { title: { absolute: "Dashboard · Mail Dashboard" } };

export default async function Page() {
  const [stats, daily, filters, result ] = await Promise.all([
    getStats(),
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
  return <DashboardView stats={stats}  daily={daily} filters={filters} result={result} />;
}
