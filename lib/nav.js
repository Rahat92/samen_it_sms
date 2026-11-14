// A nav item is either a link ({ href, label, icon, sub, only? })
// or a group ({ label, icon, children: [links...] }) that expands in the sidebar.
// `only` limits an item to those roles. `attention: true` on a child makes its count
// show on the group header while the group is collapsed.
export const NAV = [
  { href: "/", label: "Dashboard", icon: "dash", sub: "Delivery health across your tenants" },
  // { href: "/summary", label: "Summary", icon: "summary", sub: "Totals, volume over time and tenant breakdown" },
  { href: "/failures", label: "Failures", icon: "fail", sub: "Errors grouped by cause, with what to do next" },
  { href: "/transactions", label: "Transactions", icon: "tx", sub: "Every message event with its status", only: ["ADMIN", "USER"] },
  {
    label: "Blocklist",
    icon: "block",
    children: [
      { href: "/blocklist", label: "Blocked recipients", icon: "block", sub: "Recipients that mail will not be sent to", only: ["ADMIN", "USER"] },
      { href: "/unblock-requests", label: "Unblock Requests", icon: "block", sub: "Review requests to unblock recipients", only: ["ADMIN"], attention: true },
    ],
  },
  { href: "/tenants", label: "Tenants", icon: "tenants", sub: "Manage your tenants and their settings", only: ["ADMIN"] },
  { href: "/report", label: "Report", icon: "report", sub: "Download delivery reports as PDF or CSV", only: ["ADMIN", "USER"] },  // { href: "/settings", label: "Settings", icon: "set", sub: "Tenants and webhook details" },
];