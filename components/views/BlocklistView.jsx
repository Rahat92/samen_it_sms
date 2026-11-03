"use client";

import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import BlockTable from "../BlockTable";
import { useDashboard } from "../DashboardProvider";
import { stamp } from "@/lib/format";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_TIMEOUT_MS = 10000;

// Add new reasons here; the select and validation both read from this list.
const REASONS = [
  { value: "spam", label: "Spam" },
  { value: "abuse", label: "Abuse" },
  { value: "other", label: "Other" },
];

const MAX_CUSTOM_REASON = 100;

// TODO: replace these placeholders with your real domains.
const DOMAINS = [
  { value: "mail.example.com", label: "mail.example.com" },
  { value: "news.example.com", label: "news.example.com" },
  { value: "support.example.com", label: "support.example.com" },
];

const MESSAGES = {
  invalid: "Enter a full email address, like name@example.com.",
  reasonRequired: "Select a reason for blocking this address.",
  customReasonTooLong: `Keep the reason under ${MAX_CUSTOM_REASON} characters.`,
  domainRequired: "Select a domain for this block.",
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

// Reusable styled select so reason and domain stay identical.
function SelectField({ id, label, placeholder, value, options, disabled, describedBy, onChange }) {

  return (
    <>
      <label htmlFor={id} className="sr-only">{label}</label>
      <div className="select-wrap">
        <select
          id={id}
          className="select-modern"
          value={value}
          disabled={disabled}
          data-empty={value === ""}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <svg className="select-chevron" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </>
  );
}

export default function BlocklistView({ currentUser }) {
  const { blocked, history, isBlocked, toast } = useDashboard();
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false); // guards against double submits before state updates

  const errorId = error ? "blockEmailError" : undefined;

  async function submit(e) {
    e.preventDefault();
    if (inFlight.current) return;

    // 1. Validate locally before touching the network.
    const value = email.trim();
    if (!EMAIL.test(value)) return setError(MESSAGES.invalid);
    if (!REASONS.some((r) => r.value === reason)) return setError(MESSAGES.reasonRequired);

    const detail = customReason.trim();
    if (reason === "other" && detail.length > MAX_CUSTOM_REASON) {
      return setError(MESSAGES.customReasonTooLong);
    }

    // "Other" sends the typed text, or the literal "Other" when the field is empty.
    const reasonToSend = reason === "other" ? detail || "Other" : reason;

    if (!DOMAINS.some((d) => d.value === domain)) return setError(MESSAGES.domainRequired);
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
        body: JSON.stringify({
          email: value,
          reason: reasonToSend,
          domain,
        }),
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

      // 3. Reset the form only after the server confirms.
      setEmail("");
      setReason("");
      setCustomReason("");
      setDomain("");
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

  const clearError = () => error && setError("");

  return (
    <>
      <section className="card">
        {currentUser?.role === "ADMIN" && (
          <header>
            <div>
              <h2>Add a recipient</h2>
              <p className="hint">Mail to this address will not be sent</p>
            </div>
          </header>
        )}
        {currentUser?.role === "ADMIN" && (
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
                aria-describedby={errorId}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError();
                }}
              />

              <SelectField
                id="blockReason"
                label="Reason"
                placeholder="Select reason"
                value={reason}
                options={REASONS}
                disabled={submitting}
                describedBy={errorId}
                onChange={(v) => {
                  setReason(v);
                  if (v !== "other") setCustomReason("");
                  clearError();
                }}
              />

              {reason === "other" && (
                <div className="reason-other">
                  <label htmlFor="blockReasonOther" className="sr-only">Describe the reason</label>
                  <input
                    id="blockReasonOther"
                    type="text"
                    placeholder="Describe the reason (optional)"
                    autoComplete="off"
                    autoFocus
                    maxLength={MAX_CUSTOM_REASON}
                    value={customReason}
                    disabled={submitting}
                    aria-describedby={errorId}
                    onChange={(e) => {
                      setCustomReason(e.target.value);
                      clearError();
                    }}
                  />
                  {/* <span className="reason-count" aria-hidden="true">
                  {customReason.length}/{MAX_CUSTOM_REASON}
                </span> */}
                </div>
              )}

              <SelectField
                id="blockDomain"
                label="Domain"
                placeholder="Select domain"
                value={domain}
                options={DOMAINS}
                disabled={submitting}
                describedBy={errorId}
                onChange={(v) => {
                  setDomain(v);
                  clearError();
                }}
              />

              <button className="btn primary" type="submit" disabled={submitting}>
                {submitting ? "Blocking…" : "Block address"}
              </button>
            </form>
            <p id="blockEmailError" className="err" role="alert">{error}</p>
          </div>
        )}
      </section>

      <div className="grid-1">
        <section className="card">
          <header>
            <div>
              <h2>Blocked recipients</h2>
              <p className="hint">{blocked?.data?.length ?? 0} in total</p>
            </div>
          </header>
          <BlockTable />
        </section>
        <section style={{ display: "none" }} className="card">
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