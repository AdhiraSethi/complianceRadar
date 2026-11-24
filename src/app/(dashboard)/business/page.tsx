'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Building2, Save, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import type { TurnoverBand } from '@/lib/business/types';
import type { GstStatus } from '@/lib/types/database.types';

export default function BusinessProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [name, setName] = useState('Delhi General Traders');
  const [state, setState] = useState('DL');
  const [gstStatus, setGstStatus] = useState<GstStatus>('registered_regular');
  const [turnoverBand, setTurnoverBand] = useState<TurnoverBand>('40l_to_1.5cr');
  const [employeeCount, setEmployeeCount] = useState(5);
  const [industry, setIndustry] = useState('Retail & Wholesale - FMCG');
  const [description, setDescription] = useState('Distributor of packaged consumer goods and food products in Delhi NCR.');
  const [telegramChatId, setTelegramChatId] = useState('');

  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('businesses')
            .select()
            .eq('owner_id', user.id)
            .maybeSingle();

          const b = data as Database['public']['Tables']['businesses']['Row'] | null;

          if (b) {
            setBusinessId(b.id);
            setName(b.name);
            setState(b.state);
            setGstStatus(b.gst_status);
            setTurnoverBand(b.turnover_band as TurnoverBand);
            setEmployeeCount(b.employee_count);
            setIndustry(b.industry);
            setDescription(b.description || '');
            setTelegramChatId(b.telegram_chat_id || '');
          }
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Please sign in to update your business profile');
      }

      const payload = {
        id: businessId || undefined,
        owner_id: user.id,
        name,
        state,
        gst_status: gstStatus,
        turnover_band: turnoverBand,
        employee_count: Number(employeeCount),
        industry,
        description,
        telegram_chat_id: telegramChatId.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('businesses')
        .upsert(payload)
        .select('id')
        .single();

      if (error) throw error;
      if (data?.id) setBusinessId(data.id);

      setStatusMessage({
        type: 'success',
        text: 'Business profile and regulatory matching criteria successfully saved.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save profile';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-slate-500">Loading business profile...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Business Profile & Rules Setup</h1>
        <p className="text-sm text-slate-500">
          ComplianceRadar uses these structured criteria to deterministically filter which GST circulars apply to you.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`flex items-center gap-3 rounded-xl p-4 text-sm ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <Building2 className="h-6 w-6 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">Entity Details</h2>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Business Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700">Business / Firm Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* State */}
          <div>
            <label className="block text-sm font-medium text-slate-700">State / Union Territory</label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="DL">Delhi (DL)</option>
              <option value="MH">Maharashtra (MH)</option>
              <option value="UP">Uttar Pradesh (UP)</option>
              <option value="HR">Haryana (HR)</option>
              <option value="KA">Karnataka (KA)</option>
              <option value="TN">Tamil Nadu (TN)</option>
              <option value="GJ">Gujarat (GJ)</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">v1 targets state-level small traders in Delhi and NCR.</p>
          </div>

          {/* GST Status */}
          <div>
            <label className="block text-sm font-medium text-slate-700">GST Registration Status</label>
            <select
              value={gstStatus}
              onChange={(e) => setGstStatus(e.target.value as GstStatus)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="registered_regular">Registered - Regular Scheme (GSTR-1, GSTR-3B)</option>
              <option value="registered_composition">Registered - Composition Scheme (CMP-08)</option>
              <option value="unregistered">Unregistered / Below Threshold</option>
            </select>
          </div>

          {/* Turnover Band */}
          <div>
            <label className="block text-sm font-medium text-slate-700">Annual Aggregate Turnover</label>
            <select
              value={turnoverBand}
              onChange={(e) => setTurnoverBand(e.target.value as TurnoverBand)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="lt_20l">Below ₹20 Lakhs</option>
              <option value="20l_to_40l">₹20 Lakhs to ₹40 Lakhs</option>
              <option value="40l_to_1.5cr">₹40 Lakhs to ₹1.5 Crore</option>
              <option value="1.5cr_to_5cr">₹1.5 Crore to ₹5 Crore</option>
              <option value="gt_5cr">Above ₹5 Crore (E-Invoicing applicable)</option>
            </select>
          </div>

          {/* Employee Count */}
          <div>
            <label className="block text-sm font-medium text-slate-700">Employee Count</label>
            <input
              type="number"
              min={0}
              value={employeeCount}
              onChange={(e) => setEmployeeCount(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Industry */}
          <div>
            <label className="block text-sm font-medium text-slate-700">Primary Industry / Trade</label>
            <input
              type="text"
              required
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. Retail - Apparel, Electricals, Restaurants"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Business Activity Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your goods, supplies, or services (used by semantic relevance matcher)"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Telegram Chat ID */}
        <div className="border-t border-slate-100 pt-6">
          <div className="flex items-center gap-2 mb-2">
            <Send className="h-4 w-4 text-sky-500" />
            <label className="block text-sm font-semibold text-slate-900">Telegram Alert Integration</label>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Enter your Telegram Chat ID to receive instant proactive alerts when notifications match your business.
          </p>
          <div className="max-w-md">
            <input
              type="text"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="e.g. 123456789"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60 transition-colors"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Business Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
