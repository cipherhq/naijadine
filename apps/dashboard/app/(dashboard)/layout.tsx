import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardProvider, type Restaurant } from '@/components/DashboardProvider';
import { Sidebar } from '@/components/Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Fetch the user's restaurant (admins who own a restaurant can see the dashboard too)
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('owner_id', user.id)
    .in('status', ['active', 'approved', 'pending'])
    .single();

  if (!restaurant) {
    // Admins with no restaurant go to admin panel
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile && ['admin', 'super_admin'].includes(profile.role)) {
      redirect('/admin');
    }
    redirect('/onboarding');
  }

  // Redirect WhatsApp-only restaurants to standalone dashboard
  if (restaurant.product_type === 'whatsapp_standalone') {
    redirect('/standalone');
  }

  return (
    <DashboardProvider restaurant={restaurant as unknown as Restaurant} userId={user.id}>
      <Sidebar />
      <main className="min-h-screen bg-gray-50 lg:pl-64">
        <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </DashboardProvider>
  );
}
