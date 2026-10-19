import Link from "next/link";
import Icon from "./Icon";
import { CATS, CAT_ORDER } from "@/lib/sample-data";
import { byCat } from "@/lib/stats";

export default function FailureList({ stats, limit = 9 }) {
  // const m = byCat(list);
  // const keys = CAT_ORDER.filter((k) => m[k] > 0).sort((a, b) => m[b] - m[a]).slice(0, limit);
  // const max = Math.max(1, ...keys.map((k) => m[k]));

  const CATEGORIES = [
    { name: 'Hard Failures', key: 'hardFail', icon: 'fail', color: 'bad' },
    { name: 'Soft Failures', key: 'softFail', icon: 'clock', color: 'warn' },
    { name: 'Other', key: 'other', icon: 'clock', color: 'warn' },
  ];

  const maxCount = Math.max(...CATEGORIES.map((k) => stats[k.key] ?? 0), 1);
  return (
    <div className="flist">
    {CATEGORIES.map((k) => {
      const count = stats[k.key] ?? 0;
      const pct = (count / maxCount) * 100;

      return (
        <Link key={k.key} className="frow" href={`/transactions?cat=${k.key}`}>
          <span className={`fico ${k.color}`}>
            <Icon name={k.icon} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span className="fname">{k.name}</span>
            <span className="fbar">
              <i className={k.key} style={{ width: `${pct}%` }} />
            </span>
          </span>
          <span className={`fcount ${k.key}`}>{count}</span>
        </Link>
      );
    })}
  </div>
  );
}
