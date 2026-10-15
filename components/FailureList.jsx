import Link from "next/link";
import Icon from "./Icon";
import { CATS, CAT_ORDER } from "@/lib/sample-data";
import { byCat } from "@/lib/stats";

export default function FailureList({ stats, limit = 9 }) {
  // const m = byCat(list);
  console.log("FailureList", { stats, limit });
  // const keys = CAT_ORDER.filter((k) => m[k] > 0).sort((a, b) => m[b] - m[a]).slice(0, limit);
  // const max = Math.max(1, ...keys.map((k) => m[k]));

  // if (!keys.length) return <div className="empty">No failures in this period.</div>;

  return (
    <div className="flist">
      {[{
        name:'Hard Failures',
        key:'hardFail',
        icon:'fail',
        color:'bad'
      },{
        name:'Soft Failures',
        key:'softFail',
        icon:'clock',
        color:'warn'
      }].map((k) => {
        return (
          <Link key={k} className="frow" href={`/transactions?cat=${k.key}`}>
            <span className={`fico`}><Icon name={k.key === "Delayed" ? "clock" : "fail"} /></span>
            <span style={{ minWidth: 0 }}>
              <span className="fname">{k.name}</span>
              <span className="fbar"><i className={k.key} style={{ width: `${stats[k.key]/(stats.hardFail+stats.softFail) * 100}%` }} /></span>
            </span>
            <span className={`fcount ${k.key}`}>{stats[k.key]}</span>
          </Link>
        );
      })}
    </div>
  );
}
