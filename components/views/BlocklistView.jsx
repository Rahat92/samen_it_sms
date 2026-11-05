"use client";

import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import BlockTable from "../BlockTable";
import { useDashboard } from "../DashboardProvider";
import { stamp } from "@/lib/format";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_TIMEOUT_MS = 10000;
const MAX_EMAILS = 100; // per submit; keep in sync with the API route

// Add new reasons here; the select and validation both read from this list.
const REASONS = [
  { value: "Mailbox Full", label: "Mailbox Full" },
  { value: "Recipient Rejected", label: "Recipient Rejected" },
  { value: "Invalid Mailbox", label: "Invalid Mailbox" },
  { value: "Inactive Mailbox", label: "Inactive Mailbox" },
  { value: "Admin Blocked", label: "Admin Blocked" },
  { value: "other", label: "Other" },
];

const MAX_CUSTOM_REASON = 100;

const MESSAGES = {
  invalid: "Enter at least one email address, like name@example.com.",
  tooMany: `You can block up to ${MAX_EMAILS} addresses at a time.`,
  reasonRequired: "Select a reason for blocking these addresses.",
  customReasonTooLong: `Keep the reason under ${MAX_CUSTOM_REASON} characters.`,
  domainRequired: "Select a domain for this block.",
  duplicate: "That address is already on the blocklist.",
  allDuplicates: "All of these addresses are already on the blocklist.",
  network: "We couldn't reach the server. Check your connection and try again.",
  timeout: "The request timed out. Please try again.",
  server: "Something went wrong on our side. Please try again in a moment.",
  unauthorized: "Your session has expired. Please sign in again.",
  rateLimited: "Too many requests. Please wait a moment and try again.",
  generic: "We couldn't block those addresses. Please try again.",
};

// Split pasted text on commas, semicolons, spaces and new lines.
// Lowercases and removes repeats so "A@x.com, a@x.com" counts once.
function parseEmails(raw) {
  const unique = [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  return {
    valid: unique.filter((e) => EMAIL.test(e)),
    invalid: unique.filter((e) => !EMAIL.test(e)),
  };
}

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
  if (status === 409) return MESSAGES.allDuplicates;
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
  const { blocked, history, isBlocked, toast, setBlocked } = useDashboard();
  const [emailsText, setEmailsText] = useState("");
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [domain, setDomain] = useState("");
  const [domains, setDomains] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false); // guards against double submits before state updates

  const errorId = error ? "blockEmailError" : undefined;
  const parsed = parseEmails(emailsText);
  const clearError = () => error && setError("");

  async function submit(e) {
    e?.preventDefault();
    if (inFlight.current) return;

    // 1. Validate locally before touching the network.
    const { valid, invalid } = parseEmails(emailsText);
    if (!valid.length && !invalid.length) return setError(MESSAGES.invalid);
    if (invalid.length) {
      const shown = invalid.slice(0, 3).join(", ");
      const more = invalid.length > 3 ? ` and ${invalid.length - 3} more` : "";
      return setError(
        `${invalid.length} invalid address${invalid.length > 1 ? "es" : ""}: ${shown}${more}. Fix or remove ${invalid.length > 1 ? "them" : "it"} and try again.`
      );
    }
    if (valid.length > MAX_EMAILS) return setError(MESSAGES.tooMany);

    if (!REASONS.some((r) => r.value === reason)) return setError(MESSAGES.reasonRequired);

    const detail = customReason.trim();
    if (reason === "other" && detail.length > MAX_CUSTOM_REASON) {
      return setError(MESSAGES.customReasonTooLong);
    }

    // "Other" sends the typed text, or the literal "Other" when the field is empty.
    const reasonToSend = reason === "other" ? detail || "Other" : reason;

    if (!domains.some((d) => d.value === domain)) return setError(MESSAGES.domainRequired);

    // Skip addresses that are already blocked; the server also double-checks.
    const fresh = valid.filter((addr) => !isBlocked(addr));
    const alreadyBlocked = valid.length - fresh.length;
    if (!fresh.length) {
      return setError(valid.length > 1 ? MESSAGES.allDuplicates : MESSAGES.duplicate);
    }

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
          emails: fresh,
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
        toast("Couldn't block recipients");
        return;
      }

      let result = null;
      try {
        result = await response.json();
      } catch {
        // Fall back to the counts we sent.
      }
      const created = result?.created ?? fresh.length;
      const skipped = alreadyBlocked + (result?.skipped?.length ?? 0);

      // 3. Show the new rows in the table right away, then reset the form.
      if (Array.isArray(result?.data) && result.data.length) {
        const newIds = new Set(result.data.map((row) => row.id));
        setBlocked((prev) => ({
          ...prev,
          data: [...result.data, ...(prev?.data ?? []).filter((row) => !newIds.has(row.id))],
        }));
      }
      setEmailsText("");
      setReason("");
      setCustomReason("");
      setDomain("");

      const summary =
        created === 1 && fresh.length === 1
          ? `${fresh[0]} has been added to the blocklist.`
          : `${created} addresses have been added to the blocklist.`;
      await Swal.fire({
        icon: "success",
        title: created === 1 ? "Recipient blocked" : "Recipients blocked",
        text: skipped
          ? `${summary} ${skipped} ${skipped === 1 ? "was" : "were"} already blocked and skipped.`
          : summary,
        confirmButtonText: "Done",
        timer: 3500,
        timerProgressBar: true,
      });
    } catch (err) {
      setError(err?.name === "AbortError" ? MESSAGES.timeout : MESSAGES.network);
      toast("Couldn't block recipients");
      // Report to your monitoring service here (Sentry, Datadog, etc.).
    } finally {
      clearTimeout(timer);
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  useEffect(() => {
    const fetchDomains = async () => {
      try {
        const response = await fetch("/api/users");
        if (!response.ok) throw new Error("Failed to fetch domains");
        const data = await response.json();
        const modifiedDomains = data.map((user) => ({
          value: user.domain,
          label: user.domain,
        }));
        setDomains(
          modifiedDomains.filter(
            (d) => d.value !== null && d.value !== "" && d.value !== undefined
          )
        );
      } catch (err) {
        console.error("Error fetching domains:", err);
      }
    };

    fetchDomains();
  }, []);

  const count = parsed.valid.length + parsed.invalid.length;

  return (
    <>
      <section className="card">
        {currentUser?.role === "ADMIN" && (
          <header>
            <div>
              <h2>Add recipients</h2>
              <p className="hint">Mail to these addresses will not be sent</p>
            </div>
          </header>
        )}
        {currentUser?.role === "ADMIN" && (
          <div className="pad">
            <form className="formrow" onSubmit={submit} noValidate>
              <label htmlFor="blockEmail" className="sr-only">Email addresses</label>
              <textarea
                id="blockEmail"
                className="emails-field"
                rows={2}
                placeholder="name@example.com, other@example.com"
                autoComplete="off"
                spellCheck={false}
                value={emailsText}
                disabled={submitting}
                aria-invalid={Boolean(error)}
                aria-describedby={errorId}
                onChange={(e) => {
                  setEmailsText(e.target.value);
                  clearError();
                }}
                onKeyDown={(e) => {
                  // Enter adds a new line; Ctrl/Cmd + Enter submits.
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(e);
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
                </div>
              )}

              <SelectField
                id="blockDomain"
                label="Domain"
                placeholder="Select domain"
                value={domain}
                options={domains}
                disabled={submitting}
                describedBy={errorId}
                onChange={(v) => {
                  setDomain(v);
                  clearError();
                }}
              />

              <button className="btn primary" type="submit" disabled={submitting}>
                {submitting
                  ? "Blocking…"
                  : parsed.valid.length > 1
                    ? `Block ${parsed.valid.length} addresses`
                    : "Block address"}
              </button>
            </form>

            <p className="hint" style={{ marginTop: 8 }}>
              Separate multiple addresses with commas, spaces or new lines.
              {count > 0 && (
                <>
                  {" "}
                  {parsed.valid.length} valid
                  {parsed.invalid.length > 0 && `, ${parsed.invalid.length} invalid`}.
                </>
              )}
            </p>
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
          <BlockTable currentUser={currentUser} />
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