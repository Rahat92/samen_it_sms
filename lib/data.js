// Sample data matching the dashboard design.

const sent = [3, 0, 1, 2, 0, 6, 1, 2, 2, 2, 3, 3, 3, 3, 3, 2, 3, 2, 2, 3, 3, 2, 3, 3];
const failed = [2, 2, 3, 4, 3, 5, 2, 2, 2, 3, 4, 4, 5, 3, 2, 5, 3, 4, 4, 3, 3, 3, 3, 4];

// Hourly buckets starting 21:21 (Asia/Dhaka)
export const volume = sent.map((s, i) => {
  const h = (21 + i) % 24;
  return {
    label: `${String(h).padStart(2, "0")}:21`,
    sent: s,
    failed: failed[i],
  };
});

export const stats = {
  total: 135,
  successful: 57,
  failed: 78,
  successRate: "42.22%",
};

export const failures = [
  { name: "Mailbox Over Quota (Gmail)", count: 52, tone: "warn", icon: "clock" },
  { name: "Invalid Recipient Domain", count: 12, tone: "bad", icon: "alert" },
  { name: "DNS / NX Error", count: 6, tone: "bad", icon: "alert" },
  { name: "Timeout", count: 4, tone: "warn", icon: "clock" },
  { name: "Other", count: 4, tone: "bad", icon: "alert" },
];

export const transactions = [
  { id: 507, time: "Today 21:19", to: "tania@gmail.com", subject: "Trade confirmation of 3327", status: "Delayed" },
  { id: 506, time: "Today 21:19", to: "karim@bracbank.example", subject: "Statement, September", status: "Sent" },
  { id: 505, time: "Today 21:05", to: "imran@gmail.com", subject: "Statement, September", status: "Delayed" },
  { id: 504, time: "Today 20:52", to: "arif99@gmail.com", subject: "Portfolio Report", status: "Delayed" },
  { id: 503, time: "Today 20:37", to: "jahid31@agrofarm.example", subject: "Trade confirmation of 3339", status: "Sent" },
  { id: 502, time: "Today 20:31", to: "lamia@yahoo.com", subject: "Trade confirmation of 3336", status: "Sent" },
];

export const blocked = [
  { email: "tania.sample@gmial.com", reason: "Hard bounce, domain not found", added: "Yesterday 15:21" },
  { email: "oldfirm.sample@oldfirm.example", reason: "Hard bounce, no mail records", added: "Yesterday 17:21" },
];
