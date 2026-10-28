import { Suspense } from "react";
import TransactionsView from "@/components/views/TransactionsView";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Transactions" };

export default async function Page() {
  const currentUser = await getCurrentUser()
  return (
    <Suspense fallback={null}>
      <TransactionsView currentUser={currentUser} />
    </Suspense>
  );
}
