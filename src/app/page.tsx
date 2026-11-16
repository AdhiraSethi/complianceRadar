import Link from 'next/link';
import { ShieldCheck, BellRing, CalendarDays, FileSearch } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-emerald-600" />
            <span className="text-xl font-bold tracking-tight text-slate-900">ComplianceRadar</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 mb-6">
            v1: GST Notifications for Indian Small Businesses
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Never miss a regulatory deadline because of legal fine print.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            ComplianceRadar monitors official portals daily, parses complex notifications into verified plain-English facts, matches them specifically against your business profile, and delivers actionable Telegram alerts.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/login"
              className="rounded-lg bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-emerald-500"
            >
              Get Started
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50"
            >
              Dashboard
            </Link>
          </div>
        </section>

        {/* 4 Pillars */}
        <section className="border-t border-slate-200 bg-white py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 p-6 bg-slate-50/50">
                <FileSearch className="h-8 w-8 text-emerald-600 mb-4" />
                <h3 className="font-semibold text-slate-900">1. Watch</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Automated daily crawls of official GST gazettes & notifications with cryptographic change detection.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-6 bg-slate-50/50">
                <ShieldCheck className="h-8 w-8 text-emerald-600 mb-4" />
                <h3 className="font-semibold text-slate-900">2. Understand</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Strict schema extraction: turnover thresholds, states, tax types, deadlines, and verified source clause citations.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-6 bg-slate-50/50">
                <BellRing className="h-8 w-8 text-emerald-600 mb-4" />
                <h3 className="font-semibold text-slate-900">3. Match</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Deterministic hard rules + pgvector semantic search. The LLM never decides applicability on its own.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-6 bg-slate-50/50">
                <CalendarDays className="h-8 w-8 text-emerald-600 mb-4" />
                <h3 className="font-semibold text-slate-900">4. Act & Follow Up</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Direct Telegram notifications with inline action buttons, compliance calendar tasks, and escalating reminders.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-100 py-6 text-center text-xs text-slate-500">
        ComplianceRadar — Built for Indian Small Traders and Businesses. Informational alerts only; not legal advice.
      </footer>
    </div>
  );
}
