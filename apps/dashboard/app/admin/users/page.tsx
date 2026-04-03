'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { CITIES } from '@naijadine/shared';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  loyalty_tier: string;
  created_at: string;
  business_name?: string;
  business_category?: string;
}

interface Business {
  id: string;
  name: string;
  business_category: string;
  city: string;
  neighborhood: string;
  status: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
}

const VALID_ROLES = ['diner', 'restaurant_owner', 'staff', 'admin', 'super_admin'] as const;
const roleOptions = ['all', ...VALID_ROLES];

const BUSINESS_CATEGORIES = [
  'restaurant', 'church', 'gym', 'cinema', 'spa', 'events', 'shop',
  'barber', 'salon', 'beauty', 'laundry', 'car_wash', 'mechanic',
  'hotel', 'clinic', 'tutor', 'photography', 'catering', 'cleaning',
  'tailor', 'printing', 'logistics', 'bakery', 'coworking', 'other',
] as const;

const cityKeys = Object.keys(CITIES);

type Tab = 'users' | 'businesses';

export default function AdminUsersPage() {
  const { verified } = useAdminGuard();
  const [tab, setTab] = useState<Tab>('users');

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [userLoading, setUserLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [bizCategoryFilter, setBizCategoryFilter] = useState('all');

  // Businesses state
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [bizLoading, setBizLoading] = useState(true);
  const [bizSearch, setBizSearch] = useState('');
  const [bizCategory, setBizCategory] = useState('all');
  const [bizCity, setBizCity] = useState('all');
  const [bizStatus, setBizStatus] = useState('all');

  const fetchUsers = useCallback(async () => {
    setUserLoading(true);
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

    // Fetch restaurants for owner mapping
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('owner_id, name, business_category');

    const ownerMap = new Map<string, { name: string; business_category: string }>();
    (restaurants || []).forEach((r) => {
      if (r.owner_id) {
        ownerMap.set(r.owner_id, { name: r.name, business_category: r.business_category || 'restaurant' });
      }
    });

    results = results.map((u) => {
      const biz = ownerMap.get(u.id);
      return {
        ...u,
        business_name: biz?.name,
        business_category: biz?.business_category,
      };
    });

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (u) =>
          u.email?.toLowerCase().includes(q) ||
          u.first_name?.toLowerCase().includes(q) ||
          u.last_name?.toLowerCase().includes(q) ||
          u.phone?.includes(q) ||
          u.business_name?.toLowerCase().includes(q),
      );
    }

    if (bizCategoryFilter !== 'all') {
      results = results.filter((u) => u.business_category === bizCategoryFilter);
    }

    setUsers(results);
    setUserLoading(false);
  }, [roleFilter, search, bizCategoryFilter]);

  const fetchBusinesses = useCallback(async () => {
    setBizLoading(true);
    const supabase = createClient();

    let query = supabase
      .from('restaurants')
      .select('id, name, business_category, city, neighborhood, status, profiles:owner_id (first_name, last_name, email, phone)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (bizCategory !== 'all') {
      query = query.eq('business_category', bizCategory);
    }
    if (bizCity !== 'all') {
      query = query.eq('city', bizCity);
    }
    if (bizStatus !== 'all') {
      query = query.eq('status', bizStatus);
    }

    const { data } = await query;

    let results = (data || []).map((r) => {
      const profileRaw = r.profiles as unknown;
      const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as {
        first_name?: string; last_name?: string; email?: string; phone?: string;
      } | null;
      return {
        id: r.id,
        name: r.name,
        business_category: r.business_category || 'restaurant',
        city: r.city,
        neighborhood: r.neighborhood,
        status: r.status,
        owner_name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || '—',
        owner_email: profile?.email || '—',
        owner_phone: profile?.phone || '—',
      };
    });

    if (bizSearch) {
      const q = bizSearch.toLowerCase();
      results = results.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.owner_email.toLowerCase().includes(q) ||
          b.owner_phone.includes(q) ||
          b.owner_name.toLowerCase().includes(q),
      );
    }

    setBusinesses(results);
    setBizLoading(false);
  }, [bizCategory, bizCity, bizStatus, bizSearch]);

  useEffect(() => {
    if (!verified) return;
    if (tab === 'users') fetchUsers();
    else fetchBusinesses();
  }, [tab, verified, fetchUsers, fetchBusinesses]);

  const roleColors: Record<string, string> = {
    diner: 'bg-blue-100 text-blue-700',
    restaurant_owner: 'bg-brand-50 text-brand',
    staff: 'bg-purple-100 text-purple-700',
    admin: 'bg-red-100 text-red-700',
    super_admin: 'bg-red-200 text-red-800',
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    approved: 'bg-green-100 text-green-800',
    pending_review: 'bg-yellow-100 text-yellow-800',
    suspended: 'bg-red-100 text-red-700',
    rejected: 'bg-red-100 text-red-700',
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
      <h1 className="text-2xl font-bold text-gray-900">Users &amp; Contacts</h1>
      <p className="mt-1 text-sm text-gray-500">
        {tab === 'users' ? `${users.length} users` : `${businesses.length} businesses`}
      </p>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit">
        {(['users', 'businesses'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize ${
              tab === t ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ─── Users Tab ─── */}
      {tab === 'users' && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search name, email, phone, business..."
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
            <select
              value={bizCategoryFilter}
              onChange={(e) => setBizCategoryFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none capitalize"
            >
              <option value="all">All categories</option>
              {BUSINESS_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {userLoading ? (
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
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Business</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Loyalty</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Joined</th>
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
                      <td className="px-4 py-3 text-xs text-gray-500">{u.business_name || '—'}</td>
                      <td className="px-4 py-3 text-xs capitalize text-gray-500">{u.loyalty_tier || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(u.created_at).toLocaleDateString('en-NG', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ─── Businesses Tab ─── */}
      {tab === 'businesses' && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search name, email, phone..."
              value={bizSearch}
              onChange={(e) => setBizSearch(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <select
              value={bizCategory}
              onChange={(e) => setBizCategory(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none capitalize"
            >
              <option value="all">All categories</option>
              {BUSINESS_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select
              value={bizCity}
              onChange={(e) => setBizCity(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none"
            >
              <option value="all">All cities</option>
              {cityKeys.map((c) => (
                <option key={c} value={c}>{CITIES[c as keyof typeof CITIES].name}</option>
              ))}
            </select>
            <select
              value={bizStatus}
              onChange={(e) => setBizStatus(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none capitalize"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="approved">Approved</option>
              <option value="pending_review">Pending Review</option>
              <option value="suspended">Suspended</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {bizLoading ? (
            <div className="mt-8 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Business Name</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Owner</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">City</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {businesses.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{b.name}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium capitalize text-brand">
                          {b.business_category.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{b.owner_name}</td>
                      <td className="px-4 py-3 text-gray-600">{b.owner_email}</td>
                      <td className="px-4 py-3 text-gray-600">{b.owner_phone}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 capitalize">{b.city.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[b.status] || 'bg-gray-100 text-gray-600'}`}>
                          {b.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {businesses.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                        No businesses found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
