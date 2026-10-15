import "@fontsource-variable/figtree";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import { DashboardProvider } from "@/components/DashboardProvider";
import Shell from "@/components/Shell";
import "./globals.css";

export const metadata = {
  title: { default: "Mail Dashboard", template: "%s · Mail Dashboard" },
  description: "Monitor email delivery from Postal webhooks: summary, failures, transactions and blocked recipients.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <DashboardProvider>
          <Shell>{children}</Shell>
        </DashboardProvider>
      </body>
    </html>
  );
}
