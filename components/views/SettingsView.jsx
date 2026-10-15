"use client";

import Pill from "../Pill";
import { useDashboard } from "../DashboardProvider";
import { TENANTS } from "@/lib/sample-data";

const ENDPOINT = "https://your-domain.example/api/webhooks/postal";

export default function SettingsView() {
  const { copy } = useDashboard();

  return (
    <>
      <section className="card">
        <header><div><h2>Tenants</h2><p className="hint">Each webhook is matched to a tenant by its sending domain</p></div></header>
        <div className="tablewrap">
          <table style={{ minWidth: 620 }}>
            <thead><tr><th>Name</th><th>Domain</th><th>Sender</th><th>Status</th></tr></thead>
            <tbody>
              {Object.entries(TENANTS).map(([k, t]) => (
                <tr key={k}>
                  <td>{t.name}</td>
                  <td className="mono dim">{t.domain}</td>
                  <td className="mono dim">{t.from}</td>
                  <td><Pill status="Sent">Active</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <header><div><h2>Webhook</h2><p className="hint">Point Postal at this address</p></div></header>
        <div className="pad">
          <dl className="facts">
            <dt>Endpoint</dt><dd className="mono">{ENDPOINT}</dd>
            <dt>Method</dt><dd>POST, JSON body</dd>
            <dt>Events</dt><dd className="mono">MessageSent, MessageDelayed, MessageDeliveryFailed, MessageHeld</dd>
            <dt>Display time zone</dt><dd>Asia/Dhaka (UTC+6)</dd>
          </dl>
          <div><button className="btn sm" onClick={() => copy(ENDPOINT)}>Copy endpoint</button></div>
        </div>
      </section>
    </>
  );
}
