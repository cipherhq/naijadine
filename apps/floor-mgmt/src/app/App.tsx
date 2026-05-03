import { useEffect, useState } from 'react';
import { useSessionStore } from '@/features/auth/store';
import { useFloorPlanStore } from '@/features/floor-plan/store';
import { EditorView } from '@/features/floor-plan/editor/EditorView';
import { ServiceView } from '@/features/floor-plan/service/ServiceView';

function LoginForm() {
  const signIn = useSessionStore(s => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await signIn(email, password);
    if (result.error) setError(result.error);
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">DineRoot Floor</h1>
          <p className="text-sm text-gray-500">Sign in to manage your floor plan</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
          {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" required />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" required />
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-[#F04E37] py-2.5 text-sm font-semibold text-white">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function App() {
  const { user, restaurantId, role, loading: authLoading, init, signOut } = useSessionStore();
  const { loading: planLoading, loadPlan, plan } = useFloorPlanStore();
  const [mode, setMode] = useState<'editor' | 'service'>('service');

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    if (restaurantId) loadPlan(restaurantId);
  }, [restaurantId, loadPlan]);

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F04E37] border-t-transparent" />
    </div>;
  }

  if (!user) return <LoginForm />;

  if (planLoading) {
    return <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F04E37] border-t-transparent" />
    </div>;
  }

  const canEdit = role === 'owner' || role === 'manager';

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900">🍽 DineRoot Floor</h1>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 capitalize">{role}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          {canEdit && (
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button onClick={() => setMode('service')}
                className={`px-3 py-1.5 text-xs font-medium ${mode === 'service' ? 'bg-[#F04E37] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                🟢 Service
              </button>
              <button onClick={() => setMode('editor')}
                className={`px-3 py-1.5 text-xs font-medium ${mode === 'editor' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                ✏️ Editor
              </button>
            </div>
          )}

          <button onClick={signOut}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50">
            Sign Out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="p-4">
        {!plan ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg text-gray-400">No floor plan configured</p>
            <p className="mt-1 text-sm text-gray-300">Ask your manager to create a floor plan in Editor mode</p>
          </div>
        ) : mode === 'editor' && canEdit ? (
          <EditorView />
        ) : (
          <ServiceView />
        )}
      </main>
    </div>
  );
}
