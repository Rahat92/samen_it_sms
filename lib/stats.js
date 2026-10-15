import { CAT_ORDER } from "./sample-data";

export function totals(list) {
  const t = { total: list.length, sent: 0, bad: 0, delayed: 0, failed: 0, rate: 0 };
  list.forEach((r) => {
    if (r.status === "Sent") t.sent++;
    else {
      t.bad++;
      if (r.status === "Delayed") t.delayed++;
      else t.failed++;
    }
  });
  t.rate = t.total ? (t.sent / t.total) * 100 : 0;
  return t;
}

export function byCat(list) {
  const m = {};
  CAT_ORDER.forEach((k) => { m[k] = 0; });
  list.forEach((r) => { if (r.cat) m[r.cat]++; });
  return m;
}
