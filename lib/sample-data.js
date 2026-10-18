// Sample data. The counts match the client's mock: 135 total, 57 sent, 78 failed or delayed.
// Replace `rows` with a fetch to the Laravel API when it exists; every component reads
// rows of the shape { id, t, tenant, to, subject, status, cat }.
import { HOUR, NOW } from "./format";

export const CATS = {
  quota: {
    name: "Mailbox Over Quota (Gmail)", status: "Delayed", count: 52,
    advice: "Temporary. The mail server retries on its own. If it still fails after a day, ask the client to free up space.",
    smtp: "452-4.2.2 The recipient's inbox is out of storage space. Please direct the recipient to https://support.google.com/mail/?p=OverQuotaTemp",
  },
  domain: {
    name: "Invalid Recipient Domain", status: "Failed", count: 12,
    advice: "Permanent. The domain does not exist, usually a typo in the address. Correct the address and send again.",
    smtp: "550 5.1.2 Host or domain name not found. Name service error for type=A: Host not found",
  },
  dns: {
    name: "DNS / NX Error", status: "Failed", count: 6,
    advice: "Permanent. The recipient domain has no mail records. Check the domain with the client.",
    smtp: "450 4.4.3 Domain lookup failed: NXDOMAIN, no MX or A record",
  },
  timeout: {
    name: "Timeout", status: "Delayed", count: 4,
    advice: "Temporary. The remote server did not answer in time. It will be retried.",
    smtp: "421 4.4.2 Connection timed out while waiting for remote server",
  },
  other: {
    name: "Other", status: "Failed", count: 4,
    advice: "Open the SMTP response to see what the receiving server said.",
    smtp: "554 5.7.1 Message rejected by recipient policy",
  },
};
export const CAT_ORDER = ["quota", "domain", "dns", "timeout", "other"];
export const EVENT = { Sent: "MessageSent", Delayed: "MessageDelayed", Failed: "MessageDeliveryFailed" };

export const TENANTS = {
  samenits: { name: "SAMEN Limited", domain: "samenits.com", from: "rupalibanksecurities@rbsl.com.bd" },
  midwaybd: { name: "Midway Securities Ltd.", domain: "midwaybd.com", from: "mail@tenant-b.example" },
  eblsecuritiesltd: { name: "EBL Securities PLC", domain: "eblsecuritiesltd.com", from: "test@samenits.com" },
  basl: { name: "Bank Asia Securities Ltd.", domain: "basl-bd.com", from: "test@samenits.com" },
  rbsl: { name: "Rupali Bank Securities Ltd.", domain: "rbsl.com.bd", from: "test@samenits.com" },
  stockandbondltd: { name: "Stock & Bond Ltd.", domain: "stockandbondltd.com", from: "test@samenits.com" },
};

let seed = 11;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const pick = (a) => a[Math.floor(rnd() * a.length)];

const NAMES = ["rahim", "karim", "nusrat", "tania", "sabbir", "farhana", "imran", "mehedi", "shirin", "arif", "jahid", "lamia", "tanvir", "maliha", "sohel", "rumana", "nayeem", "sadia"];
const OK_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "bracbank.example", "agrofarm.example", "citytrade.example"];
const BAD_DOMAINS = ["gmial.com", "yaho.co", "hotnail.com", "exmaple.com", "bd-invest.xyz", "outlok.com"];
const DNS_DOMAINS = ["mail-broker.example", "nx-sample.example", "oldfirm.example"];

function subject() {
  const r = rnd();
  if (r < 0.62) return "Trade confirmation of " + (3290 + Math.floor(rnd() * 52));
  if (r < 0.78) return "Portfolio Report";
  if (r < 0.92) return "Statement, September";
  return "Account notice";
}

function recipient(kind) {
  const n = pick(NAMES) + (rnd() < 0.5 ? "" : Math.floor(rnd() * 90 + 10));
  const d = kind === "quota" ? "gmail.com" : kind === "domain" ? pick(BAD_DOMAINS) : kind === "dns" ? pick(DNS_DOMAINS) : pick(OK_DOMAINS);
  return `${n}@${d}`;
}

function build() {
  const specs = [];
  for (let i = 0; i < 57; i++) specs.push({ status: "Sent", cat: null });
  CAT_ORDER.forEach((k) => {
    const c = CATS[k].count - (k === "quota" ? 1 : 0); // event 471 is the remaining quota row
    for (let i = 0; i < c; i++) specs.push({ status: CATS[k].status, cat: k });
  });

  const list = specs.map((s, idx) => ({
    t: Math.floor((NOW - 60e3 - rnd() * (24 * HOUR - 120e3)) / 1000) * 1000,
    tenant: idx % 5 === 0 ? "b" : "rbsl",
    to: recipient(s.cat || "ok"),
    subject: subject(),
    status: s.status,
    cat: s.cat,
  }));

  list.push({
    t: new Date("2026-10-07T14:50:03+06:00").getTime(),
    tenant: "rbsl", to: "mostafa77haque@gmail.com", subject: "Trade confirmation of 3333",
    status: "Delayed", cat: "quota", real: true,
  });

  list.sort((a, b) => a.t - b.t);
  const fixed = list.findIndex((r) => r.real);
  list.forEach((r, idx) => { r.id = 471 - fixed + idx; });
  return list.sort((a, b) => b.t - a.t);
}

export const rows = build();

export const INITIAL_BLOCKED = [
  { email: "tania.sample@gmial.com", reason: "Hard bounce, domain not found", at: NOW - 30 * HOUR },
  { email: "oldfirm.sample@oldfirm.example", reason: "Hard bounce, no mail records", at: NOW - 52 * HOUR },
];
export const INITIAL_HISTORY = [
  { text: "Added oldfirm.sample@oldfirm.example", at: NOW - 52 * HOUR },
  { text: "Added tania.sample@gmial.com", at: NOW - 30 * HOUR },
];
