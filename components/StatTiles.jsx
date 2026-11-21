import Link from "next/link";
import Icon from "./Icon";

/* .stat */
const stat =
  "grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-1 " +
  "rounded-xl border border-[var(--line)] bg-[var(--surface)] " +
  "px-[18px] py-4 text-left shadow-[var(--shadow)]";

/* a.stat:hover */
const statLink = stat + " hover:border-[var(--accent)]";

/* .badge + color variants */
const badge =
  "row-span-2 grid h-10 w-10 place-items-center rounded-[10px]";
const tone = {
  blue: "bg-[var(--accent-soft)] text-[var(--accent)]",
  green: "bg-[var(--good-soft)] text-[var(--good)]",
  red: "bg-[var(--bad-soft)] text-[var(--bad)]",
  amber: "bg-[var(--warn-soft)] text-[var(--warn)]",
};

/* .stat small / .stat b */
const label = "truncate text-[12.5px] font-medium text-[var(--muted)]";
const value =
  "text-[26px] font-bold leading-[1.1] tracking-[-0.02em] tabular-nums";

export default function StatTiles({ t, stats }) {
  return (
    /* 4 cols → 2 cols at ≤900px → 1 col at ≤480px */
    <div className="grid grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[480px]:grid-cols-1">
      <Link className={statLink} href="/transactions">
        <span className={`${badge} ${tone.blue}`}><Icon name="tx" /></span>
        <small className={label}>Total Emails</small>
        <b className={value}>{stats.total}</b>
      </Link>

      <Link className={statLink} href="/transactions?status=Sent">
        <span className={`${badge} ${tone.green}`}><Icon name="check" /></span>
        <small className={label}>Delivered</small>
        <b className={value}>{stats.sent}</b>
      </Link>

      <Link className={statLink} href="/failures">
        <span className={`${badge} ${tone.red}`}><Icon name="fail" /></span>
        <small className={label}>Failed</small>
        <b className={value}>
          {(stats.softFail + stats.hardFail + stats.other) || 0}
        </b>
      </Link>

      {/* <Link className={statLink} href="/transactions?status=Held">
        <span className={`${badge} ${tone.red}`}><Icon name="clock" /></span>
        <small className={label}>Pending</small>
        <b className={value}>{stats.held || 0}</b>
      </Link> */}

      <div className={stat}>
        <span className={`${badge} ${tone.amber}`}><Icon name="pct" /></span>
        <small className={label}>Success Rate</small>
        <b className={value}>{stats?.rate?.toFixed(2)}%</b>
      </div>
    </div>
  );
}