"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { rows, INITIAL_BLOCKED, INITIAL_HISTORY } from "@/lib/sample-data";
import { HOUR, NOW } from "@/lib/format";
import { addDays } from "./Daterangepicker";
const fmt = (d) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
const Ctx = createContext(null);
export function DashboardProvider({ children }) {
  const today = fmt(new Date());
  const [range, setRange] = useState(24);
  const [total, setTotal] = useState(null);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [graphRows, setGraphRows] = useState([]);
  const [tenant, setTenant] = useState("all");
  const [blocked, setBlocked] = useState(INITIAL_BLOCKED);
  const [history, setHistory] = useState(INITIAL_HISTORY);
  const [selectedId, setSelectedId] = useState(null);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(null);
  const [customRange, setCustomRange] = useState({ from: addDays(today, -7), to: today });

  const scoped = useMemo(() => {
    const from = NOW - range * HOUR;
    return rows.filter((r) => r.createdAt >= from && (tenant === "all" || r.tenant === tenant));
  }, [range, tenant]);
  console.log(rows)
  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2400);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const isBlocked = useCallback(
    (email) => blocked.some((b) => b.email.toLowerCase() === email.toLowerCase()),
    [blocked]
  );

  const addBlock = useCallback((email, reason) => {
    setBlocked((b) => [{ email, reason, at: NOW }, ...b]);
    setHistory((h) => [...h, { text: `Added ${email}`, at: NOW }]);
  }, []);

  const removeBlock = useCallback((email) => {
    setBlocked((b) => b.filter((x) => x.email !== email));
    setHistory((h) => [...h, { text: `Removed ${email}`, at: NOW }]);
  }, []);

  const copy = useCallback(
    (text) => {
      const fallback = () => toast("Select the text and copy it");
      try {
        navigator.clipboard.writeText(text).then(() => toast("Copied"), fallback);
      } catch {
        fallback();
      }
    },
    [toast]
  );

  const value = {
    rows, setRows, graphRows, setGraphRows, q, setQ, total, setTotal,customRange, setCustomRange,
    range, setRange, tenant, setTenant, scoped,
    blocked, history, isBlocked, addBlock, removeBlock,
    selectedId, openEvent: setSelectedId, closeEvent: () => setSelectedId(null),
    toastMsg, toast, copy,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboard() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDashboard must be used inside DashboardProvider");
  return v;
}
