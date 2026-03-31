import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardProvider, type Restaurant } from '@/components/DashboardProvider';
import { StandaloneSidebar } from '@/components/StandaloneSidebar';

export default async function StandaloneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Fetch the user's restaurant — must be whatsapp_standalone product type
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('owner_id', user.id)
    .in('status', ['active', 'approved', 'pending_review'])
    .single();

  if (!restaurant) redirect('/onboarding');

  // If restaurant is marketplace-only, redirect to full dashboard
  if (restaurant.product_type === 'marketplace') {
    redirect('/');
  }

  return (
    <DashboardProvider restaurant={restaurant as unknown as Restaurant} userId={user.id}>
      <StandaloneSidebar />
      <main className="min-h-screen bg-gray-50 lg:pl-64">
        <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </DashboardProvider>
  );
}
