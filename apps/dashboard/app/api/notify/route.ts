import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = 'NaijaDine <hello@naijadine.com>';

// ─── Email templates ────────────────────────────────────────────

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; }
    .container { max-width: 560px; margin: 0 auto; padding: 24px; }
    .card { background: #fff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb; }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { font-size: 24px; font-weight: 700; color: #1B4332; }
    .logo span { color: #E8A817; }
    .btn { display: inline-block; padding: 12px 32px; background: #1B4332; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">Naija<span>Dine</span></div>
      </div>
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} NaijaDine. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

function setupPendingEmail(businessName: string, ownerName: string) {
  return {
    subject: `We're setting up ${businessName} — hang tight!`,
    html: baseLayout(`
      <div style="text-align:center; margin-bottom:20px;">
        <div style="width:48px;height:48px;border-radius:50%;background:#dbeafe;display:inline-flex;align-items:center;justify-content:center;">
          <span style="font-size:24px;">⏳</span>
        </div>
      </div>
      <h2 style="text-align:center;color:#111827;margin:0 0 8px;">Application Received!</h2>
      <p style="text-align:center;color:#6b7280;margin:0 0 24px;">
        Hi ${ownerName}, thanks for signing up <strong>${businessName}</strong> on NaijaDine.
      </p>
      <div style="background:#f0f9ff;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="font-size:14px;color:#1e40af;margin:0 0 8px;font-weight:600;">What happens next?</p>
        <p style="font-size:13px;color:#374151;margin:4px 0;">1. Our team will review your application</p>
        <p style="font-size:13px;color:#374151;margin:4px 0;">2. We'll configure your WhatsApp bot</p>
        <p style="font-size:13px;color:#374151;margin:4px 0;">3. If you requested a dedicated number, setup may take 2-3 business days</p>
        <p style="font-size:13px;color:#374151;margin:4px 0;">4. You'll receive an email once everything is ready</p>
      </div>
      <p style="font-size:13px;color:#6b7280;text-align:center;">
        We'll keep you updated every step of the way. If you have questions, reply to this email.
      </p>
    `),
  };
}

function setupCompleteEmail(businessName: string, ownerName: string, phoneNumber?: string) {
  const phoneLine = phoneNumber
    ? `<p style="font-size:14px;color:#065f46;margin:8px 0 0;">Your WhatsApp bot number: <strong>${phoneNumber}</strong></p>`
    : '';

  return {
    subject: `${businessName} is live on NaijaDine!`,
    html: baseLayout(`
      <div style="text-align:center; margin-bottom:20px;">
        <div style="width:48px;height:48px;border-radius:50%;background:#d1fae5;display:inline-flex;align-items:center;justify-content:center;">
          <span style="font-size:24px;">🎉</span>
        </div>
      </div>
      <h2 style="text-align:center;color:#111827;margin:0 0 8px;">You're Live!</h2>
      <p style="text-align:center;color:#6b7280;margin:0 0 24px;">
        Hi ${ownerName}, great news — <strong>${businessName}</strong> is now set up and ready to go!
      </p>
      <div style="background:#ecfdf5;border-radius:8px;padding:16px;margin-bottom:20px;text-align:center;">
        <p style="font-size:14px;color:#065f46;margin:0;font-weight:600;">Your WhatsApp bot is active</p>
        ${phoneLine}
      </div>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="font-size:13px;color:#374151;margin:0 0 8px;font-weight:600;">Getting started:</p>
        <p style="font-size:13px;color:#374151;margin:4px 0;">1. Share your WhatsApp link with customers</p>
        <p style="font-size:13px;color:#374151;margin:4px 0;">2. Customers can book, order, or inquire via chat</p>
        <p style="font-size:13px;color:#374151;margin:4px 0;">3. Manage bookings from your dashboard</p>
      </div>
      <div style="text-align:center;margin:20px 0;">
        <a href="https://dashboard.naijadine.com" class="btn">Go to Dashboard</a>
      </div>
    `),
  };
}

// ─── API route ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { type, restaurantId } = body as { type: string; restaurantId: string };

  if (!type || !restaurantId) {
    return NextResponse.json({ error: 'Missing type or restaurantId' }, { status: 400 });
  }

  // Look up restaurant + owner
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name, owner_id, whatsapp_phone_number_id, profiles:owner_id (email, first_name)')
    .eq('id', restaurantId)
    .single();

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
  }

  const profileRaw = restaurant.profiles as unknown;
  const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as {
    email?: string;
    first_name?: string;
  } | null;

  const ownerEmail = profile?.email;
  if (!ownerEmail) {
    return NextResponse.json({ error: 'Owner email not found' }, { status: 404 });
  }

  const ownerName = profile?.first_name || 'there';

  let email: { subject: string; html: string };

  switch (type) {
    case 'whatsapp_setup_pending':
      email = setupPendingEmail(restaurant.name, ownerName);
      break;
    case 'whatsapp_setup_complete':
      email = setupCompleteEmail(
        restaurant.name,
        ownerName,
        restaurant.whatsapp_phone_number_id || undefined,
      );
      break;
    default:
      return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
  }

  // Send via Resend
  if (!RESEND_API_KEY) {
    console.log(`[DEV] Email to ${ownerEmail}: "${email.subject}"`);
    return NextResponse.json({ success: true, dev: true });
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ownerEmail],
        subject: email.subject,
        html: email.html,
      }),
    });

    const data = await res.json();

    if (data.id) {
      return NextResponse.json({ success: true, messageId: data.id });
    }

    return NextResponse.json({ success: false, error: data }, { status: 500 });
  } catch (err) {
    console.error('Email send error:', err);
    return NextResponse.json({ success: false, error: 'Failed to send email' }, { status: 500 });
  }
}
