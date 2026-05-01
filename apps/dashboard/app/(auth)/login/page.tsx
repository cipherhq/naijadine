'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function DashboardLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        const msg = signInError.message?.toLowerCase() || '';
        if (msg.includes('invalid login credentials')) {
          setError('Invalid email or password. Please check and try again.');
        } else if (msg.includes('email not confirmed')) {
          setError('Your email is not confirmed. Please check your inbox for a verification link.');
        } else if (msg.includes('too many requests') || msg.includes('rate limit') || msg.includes('after')) {
          setError('Too many login attempts. Please wait a moment and try again.');
        } else if (msg.includes('user not found')) {
          setError('No account found with this email. Please sign up first.');
        } else if (msg.includes('disabled') || msg.includes('banned')) {
          setError('This account has been disabled. Please contact support.');
        } else {
          setError(signInError.message || 'Login failed. Please try again.');
        }
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Connection failed. Please check your internet and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <h2 className="text-xl font-semibold text-gray-900">Dashboard Login</h2>
      <p className="mt-1 text-sm text-gray-500">
        Sign in to manage your restaurant
      </p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@restaurant.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            required
            autoComplete="current-password"
          />
        </div>
        <button
          type="submit"
          disabled={!email || !password || loading}
          className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-500">
        <p>Don&apos;t have an account?</p>
        <div className="mt-2 flex flex-col gap-2">
          <a href="/claim" className="font-medium text-brand hover:underline">
            Claim your existing restaurant &rarr;
          </a>
          <a href="/onboarding" className="font-medium text-gray-600 hover:underline">
            Register a new restaurant
          </a>
        </div>
      </div>
    </div>
  );
}
