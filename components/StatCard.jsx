import { Card } from "./Card";

const tones = {
  brand: "bg-indigo-100 text-brand",
  ok: "bg-emerald-100 text-ok",
  bad: "bg-red-100 text-bad",
  warn: "bg-amber-100 text-warn",
};

export default function StatCard({ label, value, icon: Icon, tone = "brand" }) {
  return (
    <Card className="flex items-center gap-3 px-3.5 py-3.5">
      <span
        className={`grid size-[30px] shrink-0 place-items-center rounded-lg ${tones[tone]}`}
      >
        <Icon className="size-[14px]" />
      </span>
      <div>
        <p className="text-[9px] leading-3 text-muted">{label}</p>
        <p className="mt-0.5 text-[20px] font-bold leading-6 tracking-tight">
          {value}
        </p>
      </div>
    </Card>
  );
}
