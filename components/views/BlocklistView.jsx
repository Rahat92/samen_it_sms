"use client";

import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import BlockTable from "../BlockTable";
import EmailChipsInput, { isValidEmail } from "./EmailChipsInput";
import { useDashboard } from "../DashboardProvider";
import { stamp } from "@/lib/format";

const REQUEST_TIMEOUT_MS = 10000;
const MAX_EMAILS = 100; // per submit; keep in sync with the API route
const SEARCH_DEBOUNCE_MS = 300;
const MAX_SEARCH_LENGTH = 100; // keep in sync with the API route

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

// Split text on commas, semicolons, spaces and new lines.
// Lowercases and removes repeats so "A@x.com, a@x.com" counts once.
function parseEmails(raw) {
  const all = [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  return {
    all,
    valid: all.filter(isValidEmail),
    invalid: all.filter((e) => !isValidEmail(e)),
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

// Search box with a clear button. Escape clears it.
function SearchBox({ value, onChange, busy }) {
  return (
    <div role="search" className="relative w-full sm:w-72">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-[var(--muted)]"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <label htmlFor="blockSearch" className="sr-only">Search blocked recipients</label>
      <input
        id="blockSearch"
        type="search"
        inputMode="search"
        autoComplete="off"
        placeholder="Search email, reason or domain"
        maxLength={MAX_SEARCH_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onChange("")}
        className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)] [&::-webkit-search-cancel-button]:hidden"
      />
      {busy ? (
        <span
          aria-hidden="true"
          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]"
        />
      ) : value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)]"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

export default function BlocklistView({ currentUser }) {
  const { history, isBlocked, toast, setBlocked } = useDashboard();
  const [emails, setEmails] = useState([]); // confirmed chips
  const [draft, setDraft] = useState(""); // text still being typed
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [domain, setDomain] = useState("");
  const [domains, setDomains] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false); // guards against double submits before state updates

  // Search: `query` is what's in the box, `debouncedQuery` is what the table actually searches for
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [tableState, setTableState] = useState({ total: null, loading: true }); // reported by BlockTable

  const isAdmin = ["ADMIN", "SUPERADMIN"].includes(currentUser?.role); // super admins manage the blocklist too
  const errorId = error ? "blockEmailError" : undefined;
  const parsed = parseEmails([...emails, draft].join(" "));
  const clearError = () => error && setError("");

  const pendingSearch = query.trim() !== debouncedQuery; // typed but not applied yet
  const resetSearch = () => {
    setQuery("");
    setDebouncedQuery("");
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { total, loading: tableLoading } = tableState;
  const hint =
    debouncedQuery && (tableLoading || total === null)
      ? "Searching…"
      : total === null
        ? "Loading…"
        : debouncedQuery
          ? `${total} ${total === 1 ? "match" : "matches"} for “${debouncedQuery}”`
          : `${total} in total`;

  async function submit(e) {
    e?.preventDefault();
    if (inFlight.current) return;

    // 1. Validate locally before touching the network.
    const { all, valid, invalid } = parseEmails([...emails, draft].join(" "));
    if (!all.length) return setError(MESSAGES.invalid);
    if (invalid.length) {
      // Turn any half-typed text into chips so the bad ones are highlighted.
      setEmails(all);
      setDraft("");
      return setError(
        `${invalid.length} address${invalid.length > 1 ? "es are" : " is"} not valid (highlighted in red). Fix or remove ${invalid.length > 1 ? "them" : "it"} and try again.`
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

      // 3. Keep the shared state (used by isBlocked) up to date, then reset the form.
      if (Array.isArray(result?.data) && result.data.length) {
        const newIds = new Set(result.data.map((row) => row.id));
        setBlocked((prev) => ({
          ...prev,
          data: [...result.data, ...(prev?.data ?? []).filter((row) => !newIds.has(row.id))],
        }));
      }
      setEmails([]);
      setDraft("");
      setReason("");
      setCustomReason("");
      setDomain("");

      // New rows may not match the current search, so go back to the full list.
      // BlockTable and the sidebar counts both listen for this event and reload.
      resetSearch();
      window.dispatchEvent(new Event("blocklist:changed"));

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

  return (
    <>
      <section className="card">
        {isAdmin && (
          <header>
            <div>
              <h2>Add recipients</h2>
              <p className="hint">Mail to these addresses will not be sent</p>
            </div>
          </header>
        )}
        {isAdmin && (
          <div className="pad">
            <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <EmailChipsInput
                id="blockEmail"
                chips={emails}
                onChipsChange={(next) => {
                  setEmails(next);
                  clearError();
                }}
                draft={draft}
                onDraftChange={(v) => {
                  setDraft(v);
                  clearError();
                }}
                max={MAX_EMAILS}
                disabled={submitting}
                hasError={Boolean(error)}
                describedBy={errorId}
                placeholder="name@example.com, other@example.com"
                onSubmit={() => submit()}
              />

              <div className="formrow">
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
              </div>
            </form>

            <p id="blockEmailError" className="err" role="alert">{error}</p>
          </div>
        )}
      </section>

      <div className="grid-1">
        <section className="card">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2>Blocked recipients</h2>
              <p className="hint" aria-live="polite">{hint}</p>
            </div>
            <SearchBox value={query} onChange={setQuery} busy={pendingSearch} />
          </header>
          <BlockTable currentUser={currentUser} search={debouncedQuery} onResult={setTableState} />
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