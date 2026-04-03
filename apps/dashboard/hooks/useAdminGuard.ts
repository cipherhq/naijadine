'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const ADMIN_ROLES = ['admin', 'super_admin'] as const;
type AdminRole = (typeof ADMIN_ROLES)[number];

interface AdminGuardResult {
  /** True once auth + role check has passed */
  verified: boolean;
  /** The admin's role (only set after verification) */
  role: AdminRole | null;
}

/**
 * Re-verifies the user's auth session and admin role on mount.
 * Redirects to /login (expired session) or / (non-admin) if verification fails.
 */
export function useAdminGuard(): AdminGuardResult {
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [role, setRole] = useState<AdminRole | null>(null);

  useEffect(() => {
    async function verify() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || !ADMIN_ROLES.includes(profile.role as AdminRole)) {
        router.replace('/');
        return;
      }

      setRole(profile.role as AdminRole);
      setVerified(true);
    }

    verify();
  }, [router]);

  return { verified, role };
}
