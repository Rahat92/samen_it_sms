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
  const currentUser = await getCurrentUser()
  return <DashboardView currentUser = {currentUser} />;
}
