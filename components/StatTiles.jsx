import Link from "next/link";
import Icon from "./Icon";

export default function StatTiles({ t, stats  }) {
  console.log(  "StatTiles", { t, stats  });
  return (
    <div className="stats">
      <Link className="stat" href="/transactions">
        <span className="badge blue"><Icon name="tx" /></span>
        <small>Total Emails</small><b>{stats.total}</b>
      </Link>
      <Link className="stat" href="/transactions?status=Sent">
        <span className="badge green"><Icon name="check" /></span>
        <small>Successful</small><b>{stats.sent}</b>
      </Link>
      <Link className="stat" href="/failures">
        <span className="badge red"><Icon name="fail" /></span>
        <small>Failed / Delayed</small><b>{stats.softFail+stats.hardFail}</b>
      </Link>
      <div className="stat">
        <span className="badge amber"><Icon name="pct" /></span>
        <small>Success Rate</small><b>{stats.rate.toFixed(2)}%</b>
      </div>
    </div>
  );
}
