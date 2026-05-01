'use client';

import { useEffect, useState } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';
import { formatNaira } from '@dineroot/shared';

interface Payment {
  id: string;
  amount: number;
  status: string;
  type: string;
  reference: string;
  created_at: string;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  reference: string;
  created_at: string;
}

interface BankAccount {
  id: string;
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
}

export default function FinancePage() {
  const restaurant = useRestaurant();
  const [tab, setTab] = useState<'overview' | 'payments' | 'payouts' | 'bank'>('overview');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [bank, setBank] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    thisMonth: 0,
    totalPayouts: 0,
    pendingPayout: 0,
  });
  const [commissionPct, setCommissionPct] = useState(10);

  useEffect(() => {
    async function fetchFinance() {
      const supabase = createClient();
      const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;

      // Payments
      const { data: paymentData } = await supabase
        .from('payments')
        .select('id, amount, status, type, reference, created_at')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setPayments(paymentData || []);

      const successful = (paymentData || []).filter((p) => p.status === 'successful');
      const totalRevenue = successful.reduce((sum, p) => sum + p.amount, 0);
      const thisMonth = successful
        .filter((p) => p.created_at >= monthStart)
        .reduce((sum, p) => sum + p.amount, 0);

      // Payouts
      const { data: payoutData } = await supabase
        .from('payouts')
        .select('id, amount, status, reference, created_at')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setPayouts(payoutData || []);

      const completedPayouts = (payoutData || [])
        .filter((p) => p.status === 'completed')
        .reduce((sum, p) => sum + p.amount, 0);
      const pendingPayout = totalRevenue - completedPayouts;

      setStats({
        totalRevenue,
        thisMonth,
        totalPayouts: completedPayouts,
        pendingPayout: Math.max(0, pendingPayout),
      });

      // Bank account
      const { data: bankData } = await supabase
        .from('bank_accounts')
        .select('id, bank_name, bank_code, account_number, account_name')
        .eq('restaurant_id', restaurant.id)
        .single();

      setBank(bankData);

      // Read commission from platform config
      const { data: configRow } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'platform_commission_pct')
        .maybeSingle();
      if (configRow?.value) {
        setCommissionPct(parseFloat(configRow.value));
      }

      setLoading(false);
    }

    fetchFinance();
  }, [restaurant.id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Finance</h1>

      {/* Summary cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Total Revenue</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatNaira(stats.totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">This Month</p>
          <p className="mt-1 text-2xl font-bold text-brand">{formatNaira(stats.thisMonth)}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Total Payouts</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatNaira(stats.totalPayouts)}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Pending Payout</p>
          <p className="mt-1 text-2xl font-bold text-gold">{formatNaira(stats.pendingPayout)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit">
        {(['overview', 'payments', 'payouts', 'bank'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t === 'bank' ? 'Bank Account' : t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-6">
        {tab === 'overview' && (
          <div className="rounded-xl border border-gray-100 bg-white p-6">
            <h2 className="font-semibold text-gray-900">Revenue Summary</h2>
            <p className="mt-2 text-sm text-gray-500">
              Your deposits are automatically tracked. Payouts are processed weekly
              to your registered bank account.
            </p>
            <div className="mt-4 space-y-3">
              <div className="flex justify-between border-b border-gray-50 pb-3">
                <span className="text-sm text-gray-600">Gross deposits collected</span>
                <span className="font-medium text-gray-900">{formatNaira(stats.totalRevenue)}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-3">
                <span className="text-sm text-gray-600">Platform commission ({commissionPct}%)</span>
                <span className="font-medium text-red-600">-{formatNaira(stats.totalRevenue * (commissionPct / 100))}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 pb-3">
                <span className="text-sm text-gray-600">VAT (7.5%)</span>
                <span className="font-medium text-red-600">-{formatNaira(stats.totalRevenue * 0.075)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-gray-900">Net earnings</span>
                <span className="font-bold text-brand">{formatNaira(stats.totalRevenue * (1 - commissionPct / 100 - 0.075))}</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'payments' && (
          <TransactionTable
            items={payments.map((p) => ({
              id: p.id,
              amount: p.amount,
              status: p.status,
              label: p.type || 'deposit',
              reference: p.reference,
              date: p.created_at,
            }))}
            emptyText="No payments recorded yet"
          />
        )}

        {tab === 'payouts' && (
          <TransactionTable
            items={payouts.map((p) => ({
              id: p.id,
              amount: p.amount,
              status: p.status,
              label: 'payout',
              reference: p.reference,
              date: p.created_at,
            }))}
            emptyText="No payouts yet"
          />
        )}

        {tab === 'bank' && (
          <div className="max-w-md rounded-xl border border-gray-100 bg-white p-6">
            <h2 className="font-semibold text-gray-900">Bank Account</h2>
            {bank ? (
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Bank</span>
                  <span className="font-medium text-gray-900">{bank.bank_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Account Number</span>
                  <span className="font-mono font-medium text-gray-900">{bank.account_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Account Name</span>
                  <span className="font-medium text-gray-900">{bank.account_name}</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg bg-yellow-50 p-4">
                <p className="text-sm text-yellow-700">
                  No bank account configured. Please add your bank details in Settings to receive payouts.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionTable({
  items,
  emptyText,
}: {
  items: { id: string; amount: number; status: string; label: string; reference: string; date: string }[];
  emptyText: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
        <p className="text-sm text-gray-400">{emptyText}</p>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    successful: 'text-green-600',
    completed: 'text-green-600',
    pending: 'text-yellow-600',
    failed: 'text-red-600',
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-50 bg-gray-50/50">
            <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Amount</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Reference</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50/50">
              <td className="px-4 py-3 capitalize text-gray-700">{item.label}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{formatNaira(item.amount)}</td>
              <td className={`px-4 py-3 capitalize font-medium ${statusColor[item.status] || 'text-gray-600'}`}>
                {item.status}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-400">{item.reference}</td>
              <td className="px-4 py-3 text-gray-500">
                {new Date(item.date).toLocaleDateString('en-NG', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
