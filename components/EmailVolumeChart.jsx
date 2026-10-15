import { Card, CardHeader } from "./Card";

const TICKS = [12, 9, 6, 3, 0];
const MAX = 12;

export default function EmailVolumeChart({ data }) {
  return (
    <Card className="pb-3.5">
      <CardHeader title="Email volume" subtitle="Sent versus failed or delayed" />

      <div className="mt-3 px-3.5">
        <div className="relative h-[134px] pl-6">
          {/* gridlines + y labels */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {TICKS.map((t) => (
              <div key={t} className="flex items-center">
                <span className="w-6 pr-2 text-right font-mono text-[8px] text-muted">
                  {t}
                </span>
                <span className="h-px flex-1 bg-line" />
              </div>
            ))}
          </div>

          {/* bars */}
          <div className="absolute inset-y-0 right-0 left-6 flex items-end gap-px">
            {data.map((d) => (
              <div
                key={d.label}
                className="group relative flex h-full flex-1 flex-col justify-end"
                title={`${d.label} — sent ${d.sent}, failed ${d.failed}`}
              >
                <div
                  className="bg-bad"
                  style={{ height: `${(d.failed / MAX) * 100}%` }}
                />
                <div
                  className="bg-ok"
                  style={{ height: `${(d.sent / MAX) * 100}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* x labels */}
        <div className="mt-2 flex gap-px pl-6">
          {data.map((d, i) => (
            <div key={d.label} className="flex-1 overflow-visible">
              {i % 4 === 0 && (
                <span className="font-mono text-[8px] whitespace-nowrap text-muted">
                  {d.label}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* legend */}
        <div className="mt-3 flex items-center gap-3 text-[9px] text-muted">
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-[1px] bg-ok" /> Sent
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-[1px] bg-bad" /> Failed or delayed
          </span>
          <span>Times in Dhaka</span>
        </div>
      </div>
    </Card>
  );
}
