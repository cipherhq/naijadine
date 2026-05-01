'use client';

import { useEffect, useState } from 'react';
import { useRestaurant } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_verified: boolean;
  paystack_recipient_code: string | null;
}

export default function PaymentsPage() {
  const restaurant = useRestaurant();
  const supabase = createClient();

  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form
  const [gateway, setGateway] = useState(restaurant.payment_gateway || 'paystack');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    async function load() {
      // Fetch banks
      const res = await fetch('/api/payments/banks');
      if (res.ok) {
        const data = await res.json();
        setBanks(data);
      }

      // Fetch existing bank accounts
      const { data: accounts } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('restaurant_id', restaurant.id);

      setBankAccounts(accounts || []);
      setLoading(false);
    }
    load();
  }, [restaurant.id]);

  // Resolve account name from bank
  async function resolveAccount() {
    if (!bankCode || accountNumber.length !== 10) return;
    setResolving(true);
    setAccountName('');

    try {
      const res = await fetch('/api/payments/resolve-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank_code: bankCode, account_number: accountNumber }),
      });
      const data = await res.json();
      if (data.account_name) {
        setAccountName(data.account_name);
      } else {
        setError('Could not resolve account. Check the details and try again.');
      }
    } catch {
      setError('Failed to verify account');
    }
    setResolving(false);
  }

  // Auto-resolve when bank + account number entered
  useEffect(() => {
    if (bankCode && accountNumber.length === 10) {
      resolveAccount();
    }
  }, [bankCode, accountNumber]);

  async function connectPayment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const bankName = banks.find((b) => b.code === bankCode)?.name || '';

      // Save bank account
      const { data: bankAccount, error: insertErr } = await supabase
        .from('bank_accounts')
        .upsert({
          restaurant_id: restaurant.id,
          bank_code: bankCode,
          bank_name: bankName,
          account_number: accountNumber,
          account_name: accountName,
          is_verified: false,
        }, { onConflict: 'restaurant_id,account_number' })
        .select()
        .single();

      if (insertErr) {
        setError(insertErr.message);
        setSaving(false);
        return;
      }

      // Create Paystack subaccount
      const subRes = await fetch('/api/payments/create-subaccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_account_id: bankAccount.id,
          business_name: restaurant.name,
          settlement_bank: bankCode,
          account_number: accountNumber,
          percentage_charge: 10, // DineRoot takes 10%
        }),
      });

      const subData = await subRes.json();

      if (subData.recipient_code || subData.subaccount_code) {
        // Update restaurant with gateway info
        await supabase
          .from('restaurants')
          .update({
            payment_gateway: gateway,
            gateway_subaccount_code: subData.subaccount_code || subData.recipient_code,
          })
          .eq('id', restaurant.id);

        setSuccess('Payment account connected! You will now receive deposits directly.');
        setBankAccounts((prev) => [...prev.filter((a) => a.id !== bankAccount.id), { ...bankAccount, is_verified: true }]);
      } else {
        setError('Failed to create payment subaccount. Please try again.');
      }
    } catch (err) {
      setError('Connection failed. Please check your details.');
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>;
  }

  const isConnected = !!restaurant.gateway_subaccount_code;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Payment Settings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Connect your bank account to receive deposit payments directly. DineRoot takes a 10% commission.
      </p>

      {/* Connection status */}
      <div className={`mt-6 rounded-xl border p-5 ${isConnected ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-green-900">Payment Connected</p>
                <p className="text-sm text-green-700">Deposits are split automatically — you get 90%, DineRoot gets 10%</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-amber-900">Payment Not Connected</p>
                <p className="text-sm text-amber-700">Connect your bank account to start receiving deposit payments</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="font-semibold text-gray-900">How Split Payments Work</h3>
        <div className="mt-3 grid grid-cols-3 gap-4 text-center text-sm">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-2xl font-bold text-gray-900">💳</p>
            <p className="mt-1 font-medium">Diner Pays Deposit</p>
            <p className="text-xs text-gray-500">Via Paystack checkout</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-2xl font-bold text-gray-900">⚡</p>
            <p className="mt-1 font-medium">Auto-Split</p>
            <p className="text-xs text-gray-500">90% to you, 10% to DineRoot</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-2xl font-bold text-gray-900">🏦</p>
            <p className="mt-1 font-medium">Instant Settlement</p>
            <p className="text-xs text-gray-500">Next business day to your bank</p>
          </div>
        </div>
      </div>

      {/* Connect form */}
      <form onSubmit={connectPayment} className="mt-6 rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">{isConnected ? 'Update' : 'Connect'} Bank Account</h3>

        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Payment Gateway</label>
          <div className="flex gap-3">
            {['paystack', 'flutterwave'].map((gw) => (
              <button key={gw} type="button" onClick={() => setGateway(gw)}
                className={`flex-1 rounded-xl border p-3 text-sm font-medium capitalize transition ${gateway === gw ? 'border-brand bg-brand-50 text-brand' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {gw === 'paystack' ? '💚 Paystack' : '🟠 Flutterwave'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Bank</label>
          <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} required
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand">
            <option value="">Select your bank...</option>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>{b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Account Number</label>
          <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="0123456789" maxLength={10} required
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand" />
        </div>

        {resolving && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            Verifying account...
          </div>
        )}

        {accountName && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3">
            <p className="text-sm font-medium text-green-900">Account Name: {accountName}</p>
            <p className="text-xs text-green-700">Please confirm this is your business account</p>
          </div>
        )}

        <button type="submit" disabled={saving || !bankCode || !accountNumber || !accountName}
          className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
          {saving ? 'Connecting...' : isConnected ? 'Update Payment Account' : 'Connect Payment Account'}
        </button>
      </form>

      {/* Existing accounts */}
      {bankAccounts.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-500">Connected Accounts</h3>
          <div className="mt-3 space-y-2">
            {bankAccounts.map((acc) => (
              <div key={acc.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg">🏦</div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{acc.account_name}</p>
                  <p className="text-xs text-gray-500">{acc.bank_name} · ****{acc.account_number.slice(-4)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${acc.is_verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {acc.is_verified ? 'Verified' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
