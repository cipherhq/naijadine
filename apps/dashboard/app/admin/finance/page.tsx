'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatNaira } from '@dineroot/shared';
import { useAdminGuard } from '@/hooks/useAdminGuard';

interface PaymentRow {
  id: string;
  amount: number;
  status: string;
  type: string;
  reference: string;
  restaurant_name: string;
  created_at: string;
}

interface PayoutRow {
  id: string;
  amount: number;
  status: string;
  reference: string;
  restaurant_name: string;
  bank_name: string;
  account_number: string;
  created_at: string;
}

export default function AdminFinancePage() {
  const { verified } = useAdminGuard();
  const [tab, setTab] = useState<'overview' | 'payments' | 'payouts' | 'refunds'>('overview');
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDeposits: 0,
    monthDeposits: 0,
    commission: 0,
    totalPayouts: 0,
    pendingPayouts: 0,
    refundTotal: 0,
  });

  useEffect(() => {
    if (!verified) return;
    async function fetchFinance() {
      const supabase = createClient();
      const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;

      // All payments
      const { data: paymentData } = await supabase
        .from('payments')
        .select('id, amount, status, type, reference, created_at, restaurants (name)')
        .order('created_at', { ascending: false })
        .limit(100);

      const mappedPayments: PaymentRow[] = (paymentData || []).map((p) => {
        const restRaw = p.restaurants as unknown;
        const rest = (Array.isArray(restRaw) ? restRaw[0] : restRaw) as { name: string } | null;
        return {
          id: p.id,
          amount: p.amount,
          status: p.status,
          type: p.type || 'deposit',
          reference: p.reference,
          restaurant_name: rest?.name || '—',
          created_at: p.created_at,
        };
      });
      setPayments(mappedPayments);

      const successful = mappedPayments.filter((p) => p.status === 'successful');
      const totalDeposits = successful.reduce((s, p) => s + p.amount, 0);
      const monthDeposits = successful
        .filter((p) => p.created_at >= monthStart)
        .reduce((s, p) => s + p.amount, 0);
      const refundTotal = mappedPayments
        .filter((p) => p.type === 'refund' && p.status === 'successful')
        .reduce((s, p) => s + p.amount, 0);

      // Payouts
      const { data: payoutData } = await supabase
        .from('payouts')
        .select('id, amount, status, reference, created_at, restaurants (name), bank_accounts (bank_name, account_number)')
        .order('created_at', { ascending: false })
        .limit(100);

      const mappedPayouts: PayoutRow[] = (payoutData || []).map((p) => {
        const restRaw = p.restaurants as unknown;
        const rest = (Array.isArray(restRaw) ? restRaw[0] : restRaw) as { name: string } | null;
        const bankRaw = p.bank_accounts as unknown;
        const bank = (Array.isArray(bankRaw) ? bankRaw[0] : bankRaw) as { bank_name: string; account_number: string } | null;
        return {
          id: p.id,
          amount: p.amount,
          status: p.status,
          reference: p.reference,
          restaurant_name: rest?.name || '—',
          bank_name: bank?.bank_name || '—',
          account_number: bank?.account_number || '',
          created_at: p.created_at,
        };
      });
      setPayouts(mappedPayouts);

      const completedPayouts = mappedPayouts
        .filter((p) => p.status === 'completed')
        .reduce((s, p) => s + p.amount, 0);
      const pendingPayouts = mappedPayouts
        .filter((p) => p.status === 'pending')
        .reduce((s, p) => s + p.amount, 0);

      setStats({
        totalDeposits,
        monthDeposits,
        commission: totalDeposits * 0.1,
        totalPayouts: completedPayouts,
        pendingPayouts,
        refundTotal,
      });

      setLoading(false);
    }

    fetchFinance();
  }, [verified]);

  if (!verified || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Finance</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <p className="text-xs font-medium text-gray-500">Total Deposits</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatNaira(stats.totalDeposits)}</p>
          <p className="text-xs text-gray-400">{formatNaira(stats.monthDeposits)} this month</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <p className="text-xs font-medium text-gray-500">Platform Commission</p>
          <p className="mt-1 text-2xl font-bold text-brand">{formatNaira(stats.commission)}</p>
          <p className="text-xs text-gray-400">10% of deposits</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <p className="text-xs font-medium text-gray-500">Total Payouts</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatNaira(stats.totalPayouts)}</p>
          <p className="text-xs text-gray-400">{formatNaira(stats.pendingPayouts)} pending</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <p className="text-xs font-medium text-gray-500">Total Refunds</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{formatNaira(stats.refundTotal)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit">
        {(['overview', 'payments', 'payouts', 'refunds'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'overview' && (
          <div className="rounded-xl border border-gray-100 bg-white p-6">
            <h2 className="font-semibold text-gray-900">Revenue Breakdown</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between border-b border-gray-50 pb-3">
                <span className="text-gray-600">Gross deposits</span>
                <span className="font-medium">{formatNaira(stats.totalDeposits)}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-3">
                <span className="text-gray-600">Commission (10%)</span>
                <span className="font-medium text-brand">{formatNaira(stats.commission)}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-3">
                <span className="text-gray-600">VAT on commission (7.5%)</span>
                <span className="font-medium">{formatNaira(stats.commission * 0.075)}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-3">
                <span className="text-gray-600">Refunds issued</span>
                <span className="font-medium text-red-600">-{formatNaira(stats.refundTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">Net platform revenue</span>
                <span className="font-bold text-brand">
                  {formatNaira(stats.commission - stats.commission * 0.075)}
                </span>
              </div>
            </div>
          </div>
        )}

        {tab === 'payments' && (
          <DataTable
            columns={['Restaurant', 'Amount', 'Type', 'Status', 'Reference', 'Date']}
            rows={payments.map((p) => [
              p.restaurant_name,
              formatNaira(p.amount),
              p.type,
              p.status,
              p.reference,
              new Date(p.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }),
            ])}
            empty="No payments recorded"
          />
        )}

        {tab === 'payouts' && (
          <DataTable
            columns={['Restaurant', 'Amount', 'Bank', 'Status', 'Reference', 'Date']}
            rows={payouts.map((p) => [
              p.restaurant_name,
              formatNaira(p.amount),
              `${p.bank_name} ${p.account_number}`,
              p.status,
              p.reference,
              new Date(p.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }),
            ])}
            empty="No payouts recorded"
          />
        )}

        {tab === 'refunds' && (
          <DataTable
            columns={['Restaurant', 'Amount', 'Status', 'Reference', 'Date']}
            rows={payments
              .filter((p) => p.type === 'refund')
              .map((p) => [
                p.restaurant_name,
                formatNaira(p.amount),
                p.status,
                p.reference,
                new Date(p.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }),
              ])}
            empty="No refunds issued"
          />
        )}
      </div>
    </div>
  );
}

function DataTable({ columns, rows, empty }: { columns: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
        <p className="text-sm text-gray-400">{empty}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-50 bg-gray-50/50">
            {columns.map((c) => (
              <th key={c} className="px-4 py-3 text-left font-medium text-gray-500">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50/50">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-gray-600">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
