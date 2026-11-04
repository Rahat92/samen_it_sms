export const NAV = [
  { href: "/", label: "Dashboard", icon: "dash", sub: "Delivery health across your tenants" },
  // { href: "/summary", label: "Summary", icon: "summary", sub: "Totals, volume over time and tenant breakdown" },
  // { href: "/failures", label: "Failures", icon: "fail", sub: "Errors grouped by cause, with what to do next" },
  { href: "/transactions", label: "Transactions", icon: "tx", sub: "Every message event with its status", only: ["ADMIN", "USER"] },
  { href: "/blocklist", label: "Blocklist", icon: "block", sub: "Recipients that mail will not be sent to", only: ["ADMIN", "USER"] },
  { href: "/unblock-requests", label: "Unblock Requests", icon: "block", sub: "Recipients that mail will not be sent to", only: ["ADMIN"] },
  { href: "/tenants", label: "Tenants", icon: "tenants", sub: "Manage your tenants and their settings", only: ["ADMIN"] },
  // { href: "/settings", label: "Settings", icon: "set", sub: "Tenants and webhook details" },
];
