'use client';

import { useEffect, useState } from 'react';
import { useRestaurant, useDashboard } from '@/components/DashboardProvider';
import { createClient } from '@/lib/supabase/client';

interface StaffMember {
  id: string;
  user_id: string;
  role: string;
  profiles: { first_name: string; last_name: string; email: string; phone: string } | null;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

export default function TeamPage() {
  const restaurant = useRestaurant();
  const { userId } = useDashboard();
  const supabase = createClient();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('host');
  const [sending, setSending] = useState(false);

  async function fetch() {
    const [{ data: s }, { data: i }] = await Promise.all([
      supabase
        .from('restaurant_staff')
        .select('id, user_id, role, profiles:user_id(first_name, last_name, email, phone)')
        .eq('restaurant_id', restaurant.id),
      supabase
        .from('staff_invites')
        .select('id, email, role, status, created_at')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false }),
    ]);
    setStaff((s || []) as unknown as StaffMember[]);
    setInvites(i || []);
    setLoading(false);
  }

  useEffect(() => { fetch(); }, [restaurant.id]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    await supabase.from('staff_invites').insert({
      restaurant_id: restaurant.id,
      email: inviteEmail,
      role: inviteRole,
      invited_by: userId,
    });
    setInviteEmail('');
    setShowInvite(false);
    setSending(false);
    fetch();
  }

  async function removeStaff(id: string) {
    await supabase.from('restaurant_staff').delete().eq('id', id);
    fetch();
  }

  async function cancelInvite(id: string) {
    await supabase.from('staff_invites').delete().eq('id', id);
    fetch();
  }

  const roleColors: Record<string, string> = {
    owner: 'bg-brand-50 text-brand',
    manager: 'bg-blue-50 text-blue-700',
    host: 'bg-green-50 text-green-700',
    server: 'bg-purple-50 text-purple-700',
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="mt-1 text-sm text-gray-500">{staff.length} member{staff.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowInvite(!showInvite)} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          + Invite Staff
        </button>
      </div>

      {showInvite && (
        <form onSubmit={sendInvite} className="mt-4 flex gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required
            placeholder="staff@email.com" className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand" />
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="host">Host</option>
            <option value="server">Server</option>
            <option value="manager">Manager</option>
          </select>
          <button type="submit" disabled={sending || !inviteEmail} className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            {sending ? 'Sending...' : 'Send Invite'}
          </button>
        </form>
      )}

      {/* Current staff */}
      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold text-gray-500">Active Members</h3>
        {staff.map((s) => (
          <div key={s.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
              {s.profiles?.first_name?.charAt(0) || '?'}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">{s.profiles?.first_name} {s.profiles?.last_name}</p>
              <p className="text-xs text-gray-500">{s.profiles?.email}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${roleColors[s.role] || 'bg-gray-100 text-gray-600'}`}>
              {s.role}
            </span>
            {s.role !== 'owner' && (
              <button onClick={() => removeStaff(s.id)} className="text-xs text-red-500 hover:underline">Remove</button>
            )}
          </div>
        ))}
      </div>

      {/* Pending invites */}
      {invites.filter(i => i.status === 'pending').length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-500">Pending Invites</h3>
          {invites.filter(i => i.status === 'pending').map((inv) => (
            <div key={inv.id} className="flex items-center gap-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm text-gray-500">✉</div>
              <div className="flex-1">
                <p className="font-medium text-gray-700">{inv.email}</p>
                <p className="text-xs text-gray-400">Invited {new Date(inv.created_at).toLocaleDateString()}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${roleColors[inv.role] || 'bg-gray-100'}`}>{inv.role}</span>
              <button onClick={() => cancelInvite(inv.id)} className="text-xs text-gray-400 hover:text-red-500">Cancel</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
