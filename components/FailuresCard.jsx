import { Card, CardHeader, CardLink } from "./Card";
import { AlertIcon, ClockIcon } from "./Icons";

const tone = {
  warn: {
    chip: "bg-amber-100 text-warn",
    bar: "bg-[#9a5b0b]",
    count: "text-warn",
  },
  bad: {
    chip: "bg-red-100 text-bad",
    bar: "bg-bad",
    count: "text-bad",
  },
};

export default function FailuresCard({ items }) {
  const max = Math.max(...items.map((i) => i.count));

  return (
    <Card className="pb-2">
      <CardHeader
        title="Failures"
        subtitle="Errors and troubleshooting"
        action={<CardLink>View all</CardLink>}
      />

      <ul className="mt-3 px-3.5">
        {items.map((item, idx) => {
          const t = tone[item.tone];
          const Icon = item.icon === "clock" ? ClockIcon : AlertIcon;
          return (
            <li
              key={item.name}
              className={`flex items-center gap-2.5 py-2 ${
                idx > 0 ? "border-t border-line" : ""
              }`}
            >
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-full ${t.chip}`}
              >
                <Icon className="size-3" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold leading-4">{item.name}</p>
                <div className="mt-1 h-[3px] w-full rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${t.bar}`}
                    style={{ width: `${(item.count / max) * 100}%` }}
                  />
                </div>
              </div>

              <span className={`w-5 text-right text-[10px] font-medium ${t.count}`}>
                {item.count}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
