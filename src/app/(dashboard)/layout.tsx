import Link from 'next/link';
import { ShieldCheck, Calendar, FileText, Building2, Bell, LogOut } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center gap-2 px-2 py-4">
            <ShieldCheck className="h-7 w-7 text-emerald-600" />
            <span className="text-xl font-bold tracking-tight text-slate-900">ComplianceRadar</span>
          </div>

          <nav className="mt-6 space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 bg-slate-100 hover:bg-slate-200"
            >
              <FileText className="h-4 w-4 text-emerald-600" />
              Notifications
            </Link>
            <Link
              href="/calendar"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <Calendar className="h-4 w-4 text-slate-500" />
              Compliance Calendar
            </Link>
            <Link
              href="/business"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <Building2 className="h-4 w-4 text-slate-500" />
              Business Profile
            </Link>
            <Link
              href="/alerts"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <Bell className="h-4 w-4 text-slate-500" />
              Telegram Alerts
            </Link>
          </nav>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
