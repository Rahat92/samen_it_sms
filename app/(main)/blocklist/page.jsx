import BlocklistView from "@/components/views/BlocklistView";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Blocklist" };

export default async function Page() {
  const user = await getCurrentUser();
  return <BlocklistView currentUser={user} />;
}
