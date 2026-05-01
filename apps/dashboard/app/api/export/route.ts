import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'reservations';
  const restaurantId = searchParams.get('restaurant_id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 });
  }

  const supabase = await createClient();

  // Verify auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let csv = '';

  if (type === 'reservations') {
    let query = supabase
      .from('reservations')
      .select('reference_code, date, time, party_size, status, guest_name, guest_phone, guest_email, deposit_amount, deposit_status, created_at')
      .eq('restaurant_id', restaurantId)
      .order('date', { ascending: false });

    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);

    const { data } = await query;

    csv = 'Reference,Date,Time,Guests,Status,Guest Name,Phone,Email,Deposit,Deposit Status,Created\n';
    for (const r of data || []) {
      csv += `${r.reference_code},${r.date},${r.time},${r.party_size},${r.status},"${r.guest_name || ''}","${r.guest_phone || ''}","${r.guest_email || ''}",${r.deposit_amount || 0},${r.deposit_status || 'none'},${r.created_at}\n`;
    }
  } else if (type === 'payments') {
    let query = supabase
      .from('payments')
      .select('gateway_reference, amount, currency, status, created_at')
      .eq('status', 'success')
      .order('created_at', { ascending: false });

    // Filter by reservation restaurant
    const { data: resIds } = await supabase
      .from('reservations')
      .select('id')
      .eq('restaurant_id', restaurantId);

    if (resIds) {
      query = query.in('reservation_id', resIds.map(r => r.id));
    }

    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data } = await query;

    csv = 'Reference,Amount,Currency,Status,Date\n';
    for (const p of data || []) {
      csv += `${p.gateway_reference},${p.amount},${p.currency},${p.status},${p.created_at}\n`;
    }
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=dineroot-${type}-${new Date().toISOString().split('T')[0]}.csv`,
    },
  });
}
