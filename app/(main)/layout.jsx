import "@fontsource-variable/figtree";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import { DashboardProvider } from "@/components/DashboardProvider";
import Shell from "@/components/Shell";
import "../globals.css";
import { getCurrentUser } from "@/lib/auth";

export const metadata = {
  title: { default: "Mail Dashboard", template: "%s · Mail Dashboard" },
  description: "Monitor email delivery from Postal webhooks: summary, failures, transactions and blocked recipients.",
};

export default async function RootLayout({ children }) {
  const currentUser = await getCurrentUser()

  return (
    <html lang="en">
      <body>
        <DashboardProvider>
          <Shell currentUser={currentUser}>{children}</Shell>
        </DashboardProvider>
      </body>
    </html>
  );
}
