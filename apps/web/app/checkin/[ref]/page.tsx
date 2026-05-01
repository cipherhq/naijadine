import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';

export default async function CheckInPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const supabase = await createClient();

  // Auth required — only the guest or restaurant staff can check in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=/checkin/${encodeURIComponent(ref)}`);
  }

  const { data: reservation } = await supabase
    .from('reservations')
    .select('id, reference_code, date, time, party_size, status, user_id, guest_name, restaurants(name, address, neighborhood, city)')
    .eq('reference_code', ref)
    .single();

  if (!reservation) notFound();

  // Verify the user is the reservation owner or restaurant staff
  const isOwner = reservation.user_id === user.id;
  const { data: staffCheck } = await supabase
    .from('restaurant_staff')
    .select('id')
    .eq('user_id', user.id)
    .limit(1);
  const isStaff = (staffCheck || []).length > 0;

  if (!isOwner && !isStaff) {
    // Check if user is admin
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      notFound(); // Don't reveal the reservation exists
    }
  }

  const restaurant = reservation.restaurants as unknown as { name: string; address: string; neighborhood: string; city: string } | null;
  const isToday = reservation.date === new Date().toISOString().split('T')[0];
  const canCheckIn = isToday && ['confirmed', 'pending'].includes(reservation.status);

  // Auto check-in: update status to seated
  if (canCheckIn) {
    await supabase
      .from('reservations')
      .update({ status: 'seated', seated_at: new Date().toISOString() })
      .eq('id', reservation.id)
      .in('status', ['confirmed', 'pending']);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center border border-gray-100 shadow-sm">
        {canCheckIn ? (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Checked In!</h1>
            <p className="mt-2 text-gray-500">Welcome, {reservation.guest_name || 'Guest'}!</p>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="mt-4 text-xl font-bold text-gray-900">
              {reservation.status === 'seated' ? 'Already Checked In' : 'Check-in Not Available'}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {!isToday ? 'Check-in is only available on the day of your reservation.' : `Status: ${reservation.status}`}
            </p>
          </>
        )}

        <div className="mt-6 space-y-2 text-left text-sm border-t border-gray-100 pt-4">
          <div className="flex justify-between"><span className="text-gray-500">Restaurant</span><span className="font-medium">{restaurant?.name}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Reference</span><span className="font-mono font-medium">{reservation.reference_code}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-medium">{reservation.date}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Time</span><span className="font-medium">{reservation.time}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Guests</span><span className="font-medium">{reservation.party_size}</span></div>
        </div>

        <p className="mt-6 text-[10px] text-gray-400">Powered by DineRoot</p>
      </div>
    </div>
  );
}
