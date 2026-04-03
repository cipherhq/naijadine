'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAdminGuard } from '@/hooks/useAdminGuard';

interface TeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  created_at: string;
}

export default function AdminTeamPage() {
  const { verified, role: myRole } = useAdminGuard();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<TeamMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'super_admin'>('admin');
  const [saving, setSaving] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const isSuperAdmin = myRole === 'super_admin';

  const fetchTeam = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setMyUserId(user.id);

    const { data } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, phone, role, created_at')
      .in('role', ['admin', 'super_admin'])
      .order('created_at', { ascending: true });

    setMembers((data || []) as TeamMember[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (verified) fetchTeam();
  }, [fetchTeam, verified]);

  async function handleSearch() {
    if (!searchEmail.trim()) return;
    setSearching(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, phone, role, created_at')
      .ilike('email', `%${searchEmail.trim()}%`)
      .limit(10);

    setSearchResults((data || []) as TeamMember[]);
    setSearching(false);
  }

  async function addTeamMember(userId: string) {
    const target = searchResults.find((u) => u.id === userId);
    if (!target) return;

    if (selectedRole === 'super_admin') {
      if (!confirm('Are you sure you want to grant super_admin privileges? This gives full platform access.')) {
        return;
      }
    } else {
      if (!confirm(`Promote ${target.email} to ${selectedRole.replace('_', ' ')}?`)) {
        return;
      }
    }

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    await supabase.from('profiles').update({ role: selectedRole }).eq('id', userId);

    await supabase.from('audit_logs').insert({
      action: 'team_member_added',
      entity_type: 'profile',
      entity_id: userId,
      user_id: user.id,
      details: { old_role: target.role, new_role: selectedRole },
    });

    setSaving(false);
    setShowAdd(false);
    setSearchEmail('');
    setSearchResults([]);
    fetchTeam();
  }

  async function removeMember(userId: string) {
    if (userId === myUserId) {
      alert('You cannot remove yourself from the team.');
      return;
    }

    const target = members.find((m) => m.id === userId);
    if (!target) return;

    if (!confirm(`Remove ${target.email} from the admin team? They will be set back to "diner" role.`)) {
      return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('profiles').update({ role: 'diner' }).eq('id', userId);

    await supabase.from('audit_logs').insert({
      action: 'team_member_removed',
      entity_type: 'profile',
      entity_id: userId,
      user_id: user.id,
      details: { old_role: target.role, new_role: 'diner' },
    });

    fetchTeam();
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    super_admin: 'bg-red-200 text-red-800',
  };

  if (!verified) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Team</h1>
          <p className="mt-1 text-sm text-gray-500">{members.length} team members</p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
          >
            {showAdd ? 'Cancel' : '+ Add Team Member'}
          </button>
        )}
      </div>

      {/* Add Team Member Form */}
      {showAdd && isSuperAdmin && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-700">Add Team Member</h3>
          <p className="mt-1 text-xs text-gray-400">Search by email to find an existing user</p>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="Search by email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as 'admin' | 'super_admin')}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none"
            >
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
            <button
              onClick={handleSearch}
              disabled={searching}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-3 divide-y divide-gray-50 rounded-lg border border-gray-100">
              {searchResults.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {u.first_name || ''} {u.last_name || ''}
                    </span>
                    <span className="ml-2 text-xs text-gray-400">{u.email}</span>
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${roleColors[u.role] || 'bg-gray-100 text-gray-600'}`}>
                      {u.role?.replace('_', ' ')}
                    </span>
                  </div>
                  {['admin', 'super_admin'].includes(u.role) ? (
                    <span className="text-xs text-gray-400">Already on team</span>
                  ) : (
                    <button
                      onClick={() => addTeamMember(u.id)}
                      disabled={saving}
                      className="rounded-lg bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-50"
                    >
                      {saving ? 'Adding...' : 'Add'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Team Member List */}
      {loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Added</th>
                {isSuperAdmin && (
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {m.first_name || ''} {m.last_name || ''}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.email}</td>
                  <td className="px-4 py-3 text-gray-600">{m.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleColors[m.role] || 'bg-gray-100 text-gray-600'}`}>
                      {m.role?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(m.created_at).toLocaleDateString('en-NG', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                  {isSuperAdmin && (
                    <td className="px-4 py-3">
                      {m.id === myUserId ? (
                        <span className="text-xs text-gray-300">You</span>
                      ) : (
                        <button
                          onClick={() => removeMember(m.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
