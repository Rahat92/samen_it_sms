import BlockRequestView from "@/components/views/BlockRequestView";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Blocklist" };

export default async function Page() {
  const user = await getCurrentUser();
  return <BlockRequestView currentUser={user} />;
}
