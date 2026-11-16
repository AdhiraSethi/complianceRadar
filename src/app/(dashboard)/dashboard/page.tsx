import { ShieldAlert, CheckCircle2, Clock, CalendarDays } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Compliance Overview</h1>
          <p className="text-sm text-slate-500">Live feed of matched GST notifications and upcoming deadlines</p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Active Business</p>
              <p className="text-base font-semibold text-slate-900">Delhi Retailer (GST)</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Pending Tasks</p>
              <p className="text-base font-semibold text-slate-900">0</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2.5 text-amber-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Uncertain Matches</p>
              <p className="text-base font-semibold text-slate-900">0</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 p-2.5 text-purple-600">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Reminders Sent</p>
              <p className="text-base font-semibold text-slate-900">0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Sections placeholder */}
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <h3 className="text-base font-semibold text-slate-800">No active compliance tasks yet</h3>
        <p className="mt-1 text-sm text-slate-500">
          The automated crawler will populate this view when relevant GST notifications match your registered profile.
        </p>
      </div>
    </div>
  );
}
