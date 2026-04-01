'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PhoneInput } from '@/components/auth/PhoneInput';
import { OtpInput } from '@/components/auth/OtpInput';
import { createClient } from '@/lib/supabase/client';
import { CITIES } from '@naijadine/shared';

type Step = 'phone' | 'otp' | 'profile';
type AuthMode = 'phone' | 'email';

const cityOptions = Object.entries(CITIES).map(([key, city]) => ({
  value: key,
  label: city.name,
}));

const dietaryOptions = [
  'No restrictions',
  'Vegetarian',
  'Vegan',
  'Halal',
  'Gluten-free',
  'Dairy-free',
  'Nut allergy',
];

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStep = searchParams.get('step') === 'profile' ? 'profile' : 'phone';

  const [step, setStep] = useState<Step>(initialStep as Step);
  const [authMode, setAuthMode] = useState<AuthMode>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [pinId, setPinId] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [dietary, setDietary] = useState<string[]>([]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Failed to send OTP');
        return;
      }

      setPinId(data.pin_id);
      setStep('otp');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, pin_id: pinId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Invalid OTP');
        return;
      }

      setStep('profile');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!signupEmail || !signupPassword) return;

    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (signUpData.user) {
        // Pre-fill email in the profile step
        setEmail(signupEmail);
        setStep('profile');
      } else {
        setError('Check your email to confirm your account, then come back.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName || !lastName) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: email || undefined,
          city: city || undefined,
          dietary_preferences: dietary,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || 'Failed to update profile');
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function toggleDietary(option: string) {
    setDietary((prev) =>
      prev.includes(option)
        ? prev.filter((d) => d !== option)
        : [...prev, option],
    );
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      {step === 'phone' && (
        <>
          <h2 className="text-xl font-semibold text-gray-900">Create account</h2>

          {/* Auth mode toggle */}
          <div className="mt-4 flex rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => { setAuthMode('phone'); setError(''); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                authMode === 'phone' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Phone
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('email'); setError(''); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                authMode === 'email' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Email
            </button>
          </div>

          <p className="mt-3 text-sm text-gray-500">
            {authMode === 'email'
              ? 'Sign up with your email and password'
              : 'Enter your phone number to get started'}
          </p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {authMode === 'email' ? (
            <form onSubmit={handleEmailSignup} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <button
                type="submit"
                disabled={!signupEmail || !signupPassword || loading}
                className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
              >
                {loading ? 'Creating account...' : 'Sign Up'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <PhoneInput value={phone} onChange={setPhone} disabled={loading} />
              </div>
              <button
                type="submit"
                disabled={!phone || loading}
                className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-brand hover:underline">
              Sign in
            </Link>
          </p>
        </>
      )}

      {step === 'otp' && (
        <>
          <h2 className="text-xl font-semibold text-gray-900">
            Enter verification code
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            We sent a 6-digit code to {phone}
          </p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
            <OtpInput value={otp} onChange={setOtp} disabled={loading} />
            <button
              type="submit"
              disabled={otp.length !== 6 || loading}
              className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setOtp('');
                setError('');
              }}
              className="w-full text-center text-sm text-gray-500 hover:text-brand"
            >
              Change phone number
            </button>
          </form>
        </>
      )}

      {step === 'profile' && (
        <>
          <h2 className="text-xl font-semibold text-gray-900">
            Complete your profile
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Tell us a bit about yourself
          </p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleCompleteProfile} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  First Name *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Email (optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                City
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              >
                <option value="">Select your city</option>
                {cityOptions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Dietary Preferences
              </label>
              <div className="mt-1 flex flex-wrap gap-2">
                {dietaryOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleDietary(option)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      dietary.includes(option)
                        ? 'bg-brand text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!firstName || !lastName || loading}
              className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Complete Setup'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100 animate-pulse">
          <div className="h-6 w-40 bg-gray-200 rounded" />
          <div className="mt-6 h-12 bg-gray-200 rounded" />
          <div className="mt-4 h-12 bg-gray-200 rounded" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
