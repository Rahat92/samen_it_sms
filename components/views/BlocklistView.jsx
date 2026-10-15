"use client";

import { useState } from "react";
import BlockTable from "../BlockTable";
import { useDashboard } from "../DashboardProvider";
import { stamp } from "@/lib/format";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function BlocklistView() {
  const { blocked, history, isBlocked, addBlock, toast } = useDashboard();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    const v = email.trim();
    if (!EMAIL.test(v)) return setError("Enter a full email address, like name@example.com.");
    if (isBlocked(v)) return setError("That address is already on the blocklist.");
    addBlock(v, "Added manually");
    setEmail("");
    setError("");
    toast("Recipient blocked");
  }

  return (
    <>
      <section className="card">
        <header><div><h2>Add a recipient</h2><p className="hint">Mail to this address will not be sent</p></div></header>
        <div className="pad">
          <form className="formrow" onSubmit={submit} noValidate>
            <label htmlFor="blockEmail" className="sr-only">Email address</label>
            <input id="blockEmail" type="text" placeholder="name@example.com" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn primary" type="submit">Block address</button>
          </form>
          <p className="err" role="alert">{error}</p>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <header><div><h2>Blocked recipients</h2><p className="hint">{blocked.length} in total</p></div></header>
          <BlockTable />
        </section>
        <section className="card">
          <header><div><h2>Blocked history</h2><p className="hint">Latest changes first</p></div></header>
          <div className="pad">
            <ul className="hist">
              {history.slice().reverse().map((h, i) => (
                <li key={i}><time>{stamp(h.at)}</time><span>{h.text}</span></li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}
