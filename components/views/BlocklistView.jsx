"use client";

import { useRef, useState } from "react";
import Swal from "sweetalert2";
import BlockTable from "../BlockTable";
import { useDashboard } from "../DashboardProvider";
import { stamp } from "@/lib/format";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_TIMEOUT_MS = 10000;

const MESSAGES = {
  invalid: "Enter a full email address, like name@example.com.",
  duplicate: "That address is already on the blocklist.",
  network: "We couldn't reach the server. Check your connection and try again.",
  timeout: "The request timed out. Please try again.",
  server: "Something went wrong on our side. Please try again in a moment.",
  unauthorized: "Your session has expired. Please sign in again.",
  rateLimited: "Too many requests. Please wait a moment and try again.",
  generic: "We couldn't block that address. Please try again.",
};

// Pull a readable message out of an error response without ever throwing.
async function readErrorMessage(response) {
  try {
    const data = await response.json();
    if (typeof data?.error === "string" && data.error) return data.error;
    if (typeof data?.message === "string" && data.message) return data.message;
  } catch {
    // Body was empty or not JSON; fall through to status-based messages.
  }
  return null;
}

function messageForStatus(status) {
  if (status === 401 || status === 403) return MESSAGES.unauthorized;
  if (status === 409) return MESSAGES.duplicate;
  if (status === 429) return MESSAGES.rateLimited;
  if (status >= 500) return MESSAGES.server;
  return MESSAGES.generic;
}

export default function BlocklistView() {
  const { blocked, history, isBlocked, addBlock, toast } = useDashboard();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false); // guards against double submits before state updates

  async function submit(e) {
    e.preventDefault();
    if (inFlight.current) return;

    // 1. Validate locally before touching the network.
    const value = email.trim();
    if (!EMAIL.test(value)) return setError(MESSAGES.invalid);
    if (isBlocked(value)) return setError(MESSAGES.duplicate);

    inFlight.current = true;
    setSubmitting(true);
    setError("");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      // 2. Persist on the server first.
      const response = await fetch("/api/blocklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const serverMessage = await readErrorMessage(response);
        // Only trust server messages for client errors; hide internals on 5xx.
        const message =
          response.status < 500 && serverMessage
            ? serverMessage
            : messageForStatus(response.status);
        setError(message);
        toast("Couldn't block recipient");
        return;
      }

      // 3. Update the UI only after the server confirms.
      setEmail("");
      await Swal.fire({
        icon: "success",
        title: "Recipient blocked",
        text: `${value} has been added to the blocklist.`,
        confirmButtonText: "Done",
        timer: 3000,
        timerProgressBar: true,
      });
    } catch (err) {
      setError(err?.name === "AbortError" ? MESSAGES.timeout : MESSAGES.network);
      toast("Couldn't block recipient");
      // Report to your monitoring service here (Sentry, Datadog, etc.).
    } finally {
      clearTimeout(timer);
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className="card">
        <header>
          <div>
            <h2>Add a recipient</h2>
            <p className="hint">Mail to this address will not be sent</p>
          </div>
        </header>
        <div className="pad">
          <form className="formrow" onSubmit={submit} noValidate>
            <label htmlFor="blockEmail" className="sr-only">Email address</label>
            <input
              id="blockEmail"
              type="text"
              inputMode="email"
              placeholder="name@example.com"
              autoComplete="off"
              value={email}
              disabled={submitting}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "blockEmailError" : undefined}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
            />
            <button className="btn primary" type="submit" disabled={submitting}>
              {submitting ? "Blocking…" : "Block address"}
            </button>
          </form>
          <p id="blockEmailError" className="err" role="alert">{error}</p>
        </div>
      </section>

      <div className="grid-1">
        <section className="card">
          <header>
            <div>
              <h2>Blocked recipients</h2>
              <p className="hint">{blocked.length} in total</p>
            </div>
          </header>
          <BlockTable />
        </section>
        <section style = {{ display: 'none' }} className="card">
          <header>
            <div>
              <h2>Blocked history</h2>
              <p className="hint">Latest changes first</p>
            </div>
          </header>
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