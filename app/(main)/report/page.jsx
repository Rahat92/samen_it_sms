import ReportView from "@/components/views/ReportView";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Blocklist" };

export default async function Page() {
  const user = await getCurrentUser();
  return <ReportView currentUser={user} />;
}
