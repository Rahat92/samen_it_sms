import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import StatCard from "@/components/StatCard";
import EmailVolumeChart from "@/components/EmailVolumeChart";
import FailuresCard from "@/components/FailuresCard";
import RecentTransactions from "@/components/RecentTransactions";
import BlockedRecipients from "@/components/BlockedRecipients";
import { CheckCircleIcon, AlertIcon, MailIcon, PercentIcon } from "@/components/Icons";
import { blocked, failures, stats, transactions, volume } from "@/lib/data";
export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      <Sidebar />

      <main className="min-h-screen pl-[168px]">
        <div className="mx-auto max-w-[1760px] px-5 py-6">
          <Header />

          {/* KPI row */}
          <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Emails" value={stats.total} icon={MailIcon} tone="brand" />
            <StatCard label="Successful" value={stats.successful} icon={CheckCircleIcon} tone="ok" />
            <StatCard label="Failed / Delayed" value={stats.failed} icon={AlertIcon} tone="bad" />
            <StatCard label="Success Rate" value={stats.successRate} icon={PercentIcon} tone="warn" />
          </div>

          {/* Two columns: left 58%, right 42% (stacked cards) */}
          <div className="mt-3.5 grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-[44px]">
              <EmailVolumeChart data={volume} />
              <RecentTransactions rows={transactions} />
            </div>
            <div className="flex flex-col gap-[14px]">
              <FailuresCard items={failures} />
              <BlockedRecipients rows={blocked} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
