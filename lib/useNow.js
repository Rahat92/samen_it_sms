"use client";
import { useEffect, useState } from "react";

// Returns null on the server and first client render (avoids hydration mismatch),
// then the current time, refreshed every `intervalMs`.
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}