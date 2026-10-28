"use client";

import { useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // UI only: lets people check what they typed. Does not change what is submitted.
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });

    setLoading(false);

    if (res.ok) {
      window.location.href = "/";
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Login failed");
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-50 text-slate-900 lg:grid-cols-2 dark:bg-slate-950 dark:text-slate-100">
      {/* Left: brand panel, desktop only */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[radial-gradient(120%_80%_at_0%_0%,#1e3a8a_0%,transparent_55%),radial-gradient(90%_70%_at_100%_100%,#0f766e_0%,transparent_50%)] bg-slate-900 p-12 text-slate-200 lg:flex">
        <div className="flex items-center gap-3 text-lg font-semibold tracking-tight text-white">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600">
            <svg width="20" height="20" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </span>
          Mail Dashboard
        </div>

        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">
            See every email that left your servers, and why some did not arrive.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Delivery status, failure causes and blocked recipients for each of your tenants, in one place.
          </p>

          {/* Decorative preview */}
          <div className="mt-9 space-y-4 rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur" aria-hidden="true">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" />Sent</div>
                <div className="h-1.5 w-4/5 rounded-full bg-emerald-400/75" />
              </div>
              <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rotate-45 rounded-[2px] bg-amber-400" />Delayed</div>
                <div className="h-1.5 w-[45%] rounded-full bg-amber-400/75" />
              </div>
              <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-400" />Failed</div>
                <div className="h-1.5 w-1/4 rounded-full bg-rose-400/75" />
              </div>
            </div>
            <div className="flex h-[74px] items-end gap-1.5">
              <div className="flex h-full min-w-0 flex-1 flex-col justify-end"><div className="rounded-t-[3px] bg-rose-400/80" style={{ height: "9%" }} /><div className="bg-emerald-400/80" style={{ height: "30%" }} /></div>
              <div className="flex h-full min-w-0 flex-1 flex-col justify-end"><div className="rounded-t-[3px] bg-rose-400/80" style={{ height: "6%" }} /><div className="bg-emerald-400/80" style={{ height: "40%" }} /></div>
              <div className="flex h-full min-w-0 flex-1 flex-col justify-end"><div className="rounded-t-[3px] bg-rose-400/80" style={{ height: "12%" }} /><div className="bg-emerald-400/80" style={{ height: "35%" }} /></div>
              <div className="flex h-full min-w-0 flex-1 flex-col justify-end"><div className="rounded-t-[3px] bg-rose-400/80" style={{ height: "6%" }} /><div className="bg-emerald-400/80" style={{ height: "50%" }} /></div>
              <div className="flex h-full min-w-0 flex-1 flex-col justify-end"><div className="rounded-t-[3px] bg-rose-400/80" style={{ height: "3%" }} /><div className="bg-emerald-400/80" style={{ height: "45%" }} /></div>
              <div className="flex h-full min-w-0 flex-1 flex-col justify-end"><div className="rounded-t-[3px] bg-rose-400/80" style={{ height: "9%" }} /><div className="bg-emerald-400/80" style={{ height: "55%" }} /></div>
              <div className="flex h-full min-w-0 flex-1 flex-col justify-end"><div className="rounded-t-[3px] bg-rose-400/80" style={{ height: "15%" }} /><div className="bg-emerald-400/80" style={{ height: "40%" }} /></div>
              <div className="flex h-full min-w-0 flex-1 flex-col justify-end"><div className="rounded-t-[3px] bg-rose-400/80" style={{ height: "6%" }} /><div className="bg-emerald-400/80" style={{ height: "60%" }} /></div>
              <div className="flex h-full min-w-0 flex-1 flex-col justify-end"><div className="rounded-t-[3px] bg-rose-400/80" style={{ height: "3%" }} /><div className="bg-emerald-400/80" style={{ height: "50%" }} /></div>
              <div className="flex h-full min-w-0 flex-1 flex-col justify-end"><div className="rounded-t-[3px] bg-rose-400/80" style={{ height: "9%" }} /><div className="bg-emerald-400/80" style={{ height: "45%" }} /></div>
              <div className="flex h-full min-w-0 flex-1 flex-col justify-end"><div className="rounded-t-[3px] bg-rose-400/80" style={{ height: "6%" }} /><div className="bg-emerald-400/80" style={{ height: "65%" }} /></div>
              <div className="flex h-full min-w-0 flex-1 flex-col justify-end"><div className="rounded-t-[3px] bg-rose-400/80" style={{ height: "3%" }} /><div className="bg-emerald-400/80" style={{ height: "55%" }} /></div>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500">Powered by Postal webhooks</p>
      </aside>

      {/* Right: form */}
      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 text-lg font-semibold tracking-tight lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            </span>
            Mail Dashboard
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use your work email to open the dashboard.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                aria-invalid={error ? "true" : undefined}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/15 aria-[invalid=true]:border-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">Password</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  aria-invalid={error ? "true" : undefined}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/15 aria-[invalid=true]:border-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/20 pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 rounded-r-lg px-3.5 text-xs font-medium text-slate-500 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 dark:text-slate-400 dark:hover:text-white"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div aria-live="polite">
              {error && (
                <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
                  <svg width="16" height="16" viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v4M12 16v.5" />
                  </svg>
                  <span>{error}</span>
                </p>
              )}
            </div>

            <button
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && (
                <svg width="16" height="16" viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}