import FailuresView from "@/components/views/FailuresView";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Failures" };

export default async function Page() {
  const user = await getCurrentUser();
  return <FailuresView currentUser = {user} />;
}
