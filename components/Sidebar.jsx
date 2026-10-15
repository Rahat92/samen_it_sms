import {
  AlertIcon,
  BanIcon,
  BarsIcon,
  GridIcon,
  MailIcon,
  SlidersIcon,
} from "./Icons";

const nav = [
  { label: "Dashboard", icon: GridIcon, active: true },
  { label: "Summary", icon: BarsIcon },
  { label: "Failures", icon: AlertIcon, badge: 78 },
  { label: "Transactions", icon: MailIcon },
  { label: "Blocklist", icon: BanIcon },
  { label: "Settings", icon: SlidersIcon },
];

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-[168px] flex-col bg-navy-900 text-slate-300">
      <div className="flex items-center gap-2 px-[18px] pt-[22px] pb-5">
        <span className="grid size-[22px] place-items-center rounded-md bg-brand text-white">
          <MailIcon className="size-3.5" />
        </span>
        <span className="text-[12px] font-bold tracking-tight text-white">
          Mail Dashboard
        </span>
      </div>

      <nav className="flex flex-col gap-0.5 px-3">
        {nav.map(({ label, icon: Icon, active, badge }) => (
          <a
            key={label}
            href="#"
            className={`flex h-[28px] items-center gap-2 rounded-md px-2 text-[11px] font-medium transition-colors ${
              active
                ? "bg-navy-700 text-white"
                : "text-slate-400 hover:bg-navy-800 hover:text-slate-200"
            }`}
          >
            <Icon className="size-[14px]" />
            <span className="flex-1">{label}</span>
            {badge != null && (
              <span className="rounded-full bg-red-600 px-1.5 py-px text-[8px] font-bold leading-3 text-white">
                {badge}
              </span>
            )}
          </a>
        ))}
      </nav>

      <div className="mt-auto px-[18px] pb-5">
        <p className="text-[8px] text-slate-400">Postal webhooks</p>
        <p className="mt-1 font-mono text-[9px] font-bold text-white">
          Asia/Dhaka · UTC+6
        </p>
      </div>
    </aside>
  );
}
