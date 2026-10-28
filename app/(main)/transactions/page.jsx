import { Suspense } from "react";
import TransactionsView from "@/components/views/TransactionsView";

export const metadata = { title: "Transactions" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TransactionsView />
    </Suspense>
  );
}
