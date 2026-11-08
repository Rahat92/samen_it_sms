"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { rows, INITIAL_BLOCKED, INITIAL_HISTORY } from "@/lib/sample-data";
import { HOUR, NOW } from "@/lib/format";
import { addDays } from "./Daterangepicker";
const fmt = (d) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
const Ctx = createContext(null);
export function DashboardProvider({ children }) {
  const [blocked, setBlocked] = useState([]);
  const [stats, setStats] = useState([])
  useEffect(() => {
    const fetchBlocked = async () => {
      try {
        const res = await fetch("/api/blocklist");
        if (!res.ok) throw new Error("Failed to fetch blocklist");
        const data = await res.json();
        setBlocked(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchBlocked();
  }, [])

  
  const today = fmt(new Date());
  const [range, setRange] = useState('');
  const [total, setTotal] = useState(null);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [graphRows, setGraphRows] = useState([]);
  const [tenant, setTenant] = useState("all");
  const [history, setHistory] = useState(INITIAL_HISTORY);
  const [selectedId, setSelectedId] = useState(null);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(null);
  const [user, setUser] = useState(null)
  const [customRange, setCustomRange] = useState({ from: addDays(today, -0), to: today });

  const scoped = useMemo(() => {
    const from = NOW - range * HOUR;
    return rows.filter((r) => r.createdAt >= from && (tenant === "all" || r.tenant === tenant));
  }, [range, tenant]);

  useEffect(() => {
    const fetchStats = async () => {
      if (user && user.role == 'USER') {
        const { data } = await axios.get(`/api/stats?tenant=${user.email.split('@')[1]}&timeFrom=${range}&from=${customRange.from}&to=${customRange.to}`)
        setStats(await data)
      } else if (user.role == 'ADMIN') {
        const { data } = await axios.get(`/api/stats?tenant=${tenant === 'all' ? '' : tenant}&timeFrom=${range}&from=${customRange.from}&to=${customRange.to}`)
        setStats(await data)
      }
    }
    fetchStats()
  }, [tenant, range, user, customRange])
  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2400);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const isBlocked = useCallback(
    (email) => blocked?.data?.some((b) => b.email.toLowerCase() === email.toLowerCase()),
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
    rows, setRows, graphRows, setGraphRows, q, setQ, total, setTotal, customRange, setCustomRange, user, setUser, stats, setStats,
    range, setRange, tenant, setTenant, scoped,
    blocked, setBlocked, history, setHistory, isBlocked, addBlock, removeBlock,
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
