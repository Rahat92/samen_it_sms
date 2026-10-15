import { HOUR, NOW, hm } from "@/lib/format";

export default function VolumeChart({ list, range }) {
  const n = range === 24 ? 24 : 6;
  const span = range * HOUR;
  const size = span / n;
  const start = NOW - span;
  const ok = Array(n).fill(0);
  const bad = Array(n).fill(0);

  list.forEach((r) => {
    const b = Math.min(n - 1, Math.floor((r.t - start) / size));
    if (b < 0) return;
    if (r.status === "Sent") ok[b]++;
    else bad[b]++;
  });

  const max = Math.max(4, Math.ceil(Math.max(...ok.map((v, i) => v + bad[i])) / 4) * 4);

  return (
    <>
      <div className="chart">
        <div className="yaxis">
          {[max, max * 0.75, max / 2, max / 4, 0].map((v) => <span key={v}>{v}</span>)}
        </div>
        <div className="plot">
          {ok.map((o, k) => {
            const a = start + k * size;
            const title = `${hm(a)} to ${hm(a + size)}: ${o} sent, ${bad[k]} failed or delayed`;
            return (
              <div className="col" key={k} title={title}>
                {bad[k] > 0 && (
                  <div className="seg-bad" style={{ height: `${(bad[k] / max) * 100}%`, borderRadius: "3px 3px 0 0" }} />
                )}
                {o > 0 && (
                  <div className="seg-ok" style={{ height: `${(o / max) * 100}%`, borderRadius: bad[k] ? 0 : "3px 3px 0 0" }} />
                )}
              </div>
            );
          })}
        </div>
        <div className="xaxis">
          {ok.map((_, k) => (
            <span key={k}>{n === 24 && k % 4 !== 0 ? "" : hm(start + k * size)}</span>
          ))}
        </div>
      </div>
      <div className="legend">
        <span><i style={{ background: "var(--bar-ok)" }} />Sent</span>
        <span><i style={{ background: "var(--bar-bad)" }} />Failed or delayed</span>
        <span>Times in Dhaka</span>
      </div>
    </>
  );
}
