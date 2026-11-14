"use client";

import { useRef, useState } from "react";
import "./email-chips.css";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (value) => EMAIL.test(value);

const SPLIT = /[\s,;]+/;

/**
 * Controlled multi-email input. Typed or pasted addresses turn into chips;
 * invalid ones are highlighted so they can be fixed or removed in one click.
 *
 * Props:
 *   chips / onChipsChange   confirmed addresses (string[])
 *   draft / onDraftChange   text currently being typed
 *   onSubmit                called on Ctrl/Cmd + Enter
 */
export default function EmailChipsInput({
  id,
  label = "Email addresses",
  chips,
  onChipsChange,
  draft,
  onDraftChange,
  max = 100,
  disabled = false,
  hasError = false,
  describedBy,
  placeholder = "name@example.com",
  onSubmit,
}) {
  const inputRef = useRef(null);
  const [notice, setNotice] = useState("");

  const invalidCount = chips.filter((c) => !isValidEmail(c)).length;
  const validCount = chips.length - invalidCount;

  // Turn raw text into chips: split, lowercase, drop repeats, respect the limit.
  function commit(text) {
    const tokens = text.split(SPLIT).map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (!tokens.length) return;

    const seen = new Set(chips);
    const next = [...chips];
    let duplicates = 0;
    let overLimit = 0;

    for (const token of tokens) {
      if (seen.has(token)) duplicates++;
      else if (next.length >= max) overLimit++;
      else {
        seen.add(token);
        next.push(token);
      }
    }

    onChipsChange(next);
    onDraftChange("");

    const parts = [];
    if (duplicates) parts.push(`${duplicates} duplicate${duplicates > 1 ? "s" : ""} ignored`);
    if (overLimit) parts.push(`limit of ${max} reached, ${overLimit} not added`);
    setNotice(parts.join(" · "));
  }

  function removeChip(email) {
    onChipsChange(chips.filter((c) => c !== email));
    setNotice("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    const hasText = draft.trim() !== "";

    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSubmit?.();
      return;
    }
    if ([",", ";", " "].includes(e.key)) {
      e.preventDefault(); // never type a separator; it either commits or is ignored
      if (hasText) commit(draft);
      return;
    }
    if (e.key === "Enter" && hasText) {
      e.preventDefault(); // Enter confirms the chip; on an empty field it submits the form
      commit(draft);
      return;
    }
    if (e.key === "Tab" && hasText) {
      commit(draft); // keep native tab behaviour
      return;
    }
    if (e.key === "Backspace" && !draft && chips.length) {
      onChipsChange(chips.slice(0, -1));
      setNotice("");
    }
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData("text");
    if (SPLIT.test(text.trim())) {
      e.preventDefault();
      commit(`${draft} ${text}`);
    }
  }

  return (
    <div className="echips">
      <div className="echips-head">
        <label htmlFor={id} className="echips-label">{label}</label>
        <span className="echips-meta">
          <span className="echips-count" aria-live="polite">
            {chips.length} / {max}
          </span>
          {chips.length > 0 && (
            <button
              type="button"
              className="echips-link"
              disabled={disabled}
              onClick={() => {
                onChipsChange([]);
                setNotice("");
                inputRef.current?.focus();
              }}
            >
              Clear all
            </button>
          )}
        </span>
      </div>

      <div
        className="echips-box"
        data-error={hasError || invalidCount > 0}
        data-disabled={disabled}
        onClick={(e) => {
          if (e.target === e.currentTarget) inputRef.current?.focus();
        }}
      >
        {chips.map((email) => {
          const valid = isValidEmail(email);
          return (
            <span key={email} className="echip" data-invalid={!valid} title={valid ? email : "Not a valid email address"}>
              <span className="echip-text">{email}</span>
              {!valid && <span className="sr-only"> (invalid)</span>}
              <button
                type="button"
                className="echip-x"
                disabled={disabled}
                aria-label={`Remove ${email}`}
                onClick={() => removeChip(email)}
              >
                <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                  <path d="M2.5 2.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
                </svg>
              </button>
            </span>
          );
        })}

        <input
          ref={inputRef}
          id={id}
          className="echips-input"
          type="text"
          inputMode="email"
          autoComplete="off"
          spellCheck={false}
          placeholder={chips.length ? "Add another…" : placeholder}
          value={draft}
          disabled={disabled}
          aria-invalid={hasError || invalidCount > 0}
          aria-describedby={describedBy}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => draft.trim() && commit(draft)}
        />
      </div>

      <div className="echips-foot">
        <span>
          {chips.length === 0
            ? "Type or paste addresses. Separate with comma, space or new line."
            : invalidCount > 0
              ? `${validCount} valid · ${invalidCount} invalid`
              : `${validCount} valid ${validCount === 1 ? "address" : "addresses"}`}
        </span>
        {invalidCount > 0 && (
          <button
            type="button"
            className="echips-link"
            disabled={disabled}
            onClick={() => onChipsChange(chips.filter(isValidEmail))}
          >
            Remove invalid
          </button>
        )}
      </div>

      {notice && <p className="echips-notice" role="status">{notice}</p>}
    </div>
  );
}