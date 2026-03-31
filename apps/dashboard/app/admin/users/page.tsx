'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  loyalty_tier: string;
  created_at: string;
}

const roleOptions = ['all', 'diner', 'restaurant_owner', 'staff', 'admin', 'super_admin'];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const fetchUsers = useCallback(async () => {
    const supabase = createClient();
    let query = supabase
      .from('profiles')
      .select('id, email, first_name, last_name, phone, role, loyalty_tier, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (roleFilter !== 'all') {
      query = query.eq('role', roleFilter);
    }

    const { data } = await query;
    let results = (data || []) as User[];

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (u) =>
          u.email?.toLowerCase().includes(q) ||
          u.first_name?.toLowerCase().includes(q) ||
          u.last_name?.toLowerCase().includes(q) ||
          u.phone?.includes(q),
      );
    }

    setUsers(results);
    setLoading(false);
  }, [roleFilter, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function updateRole(id: string, role: string) {
    const supabase = createClient();
    await supabase.from('profiles').update({ role }).eq('id', id);

    await supabase.from('audit_logs').insert({
      action: 'user_role_changed',
      entity_type: 'profile',
      entity_id: id,
      details: { new_role: role },
    });

    fetchUsers();
  }

  const roleColors: Record<string, string> = {
    diner: 'bg-blue-100 text-blue-700',
    restaurant_owner: 'bg-brand-50 text-brand',
    staff: 'bg-purple-100 text-purple-700',
    admin: 'bg-red-100 text-red-700',
    super_admin: 'bg-red-200 text-red-800',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Users</h1>
      <p className="mt-1 text-sm text-gray-500">{users.length} users</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search name, email, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1">
          {roleOptions.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                roleFilter === r ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {r === 'all' ? 'All' : r.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

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
                <th className="px-4 py-3 text-left font-medium text-gray-500">Loyalty</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Joined</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {u.first_name || ''} {u.last_name || ''}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600">{u.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleColors[u.role] || 'bg-gray-100 text-gray-600'}`}>
                      {u.role?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs capitalize text-gray-500">{u.loyalty_tier || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(u.created_at).toLocaleDateString('en-NG', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => updateRole(u.id, e.target.value)}
                      className="rounded border border-gray-200 px-2 py-1 text-xs outline-none"
                    >
                      <option value="diner">Diner</option>
                      <option value="restaurant_owner">Owner</option>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
