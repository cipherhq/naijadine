const BRAND_COLOR = '#F04E37';
const ACCENT_COLOR = '#D93A24';
const GOLD_COLOR = '#E8A817';

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
    .logo { font-size: 24px; font-weight: 700; color: ${BRAND_COLOR}; }
    .logo span { color: ${GOLD_COLOR}; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .detail-label { color: #6b7280; }
    .detail-value { font-weight: 500; color: #111827; }
    .btn { display: inline-block; padding: 12px 32px; background: ${BRAND_COLOR}; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">Dine<span>Root</span></div>
      </div>
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} DineRoot. All rights reserved.</p>
      <p>Discover. Reserve. Dine.</p>
    </div>
  </div>
</body>
</html>`;
}

export interface BookingEmailData {
  guestName: string;
  restaurantName: string;
  date: string;
  time: string;
  partySize: number;
  referenceCode: string;
  depositAmount?: number;
  address?: string;
}

export function bookingConfirmationEmail(data: BookingEmailData): { subject: string; html: string } {
  return {
    subject: `Booking Confirmed — ${data.restaurantName}`,
    html: baseLayout(`
      <div style="text-align:center; margin-bottom:20px;">
        <div style="width:48px;height:48px;border-radius:50%;background:#d1fae5;display:inline-flex;align-items:center;justify-content:center;">
          <span style="font-size:24px;">✓</span>
        </div>
      </div>
      <h2 style="text-align:center;color:#111827;margin:0 0 8px;">Booking Confirmed!</h2>
      <p style="text-align:center;color:#6b7280;margin:0 0 24px;">Hi ${data.guestName}, your reservation is confirmed.</p>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;">
        <div class="detail-row"><span class="detail-label">Restaurant</span><span class="detail-value">${data.restaurantName}</span></div>
        <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${data.date}</span></div>
        <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${data.time}</span></div>
        <div class="detail-row"><span class="detail-label">Guests</span><span class="detail-value">${data.partySize}</span></div>
        <div style="text-align:center;padding:12px 0;border-top:1px solid #e5e7eb;margin-top:8px;">
          <span style="font-size:12px;color:#6b7280;">Reference Code</span><br>
          <span style="font-size:20px;font-weight:700;color:${BRAND_COLOR};letter-spacing:2px;">${data.referenceCode}</span>
        </div>
      </div>
      ${data.depositAmount ? `<p style="font-size:13px;color:${ACCENT_COLOR};text-align:center;">Deposit paid: ₦${data.depositAmount.toLocaleString()}</p>` : ''}
      <div style="text-align:center;margin-top:20px;">
        <a href="https://dineroot.com/account/bookings" class="btn">View My Bookings</a>
      </div>
    `),
  };
}

export function reminder24hEmail(data: BookingEmailData): { subject: string; html: string } {
  return {
    subject: `Tomorrow: ${data.restaurantName} at ${data.time}`,
    html: baseLayout(`
      <h2 style="text-align:center;color:#111827;margin:0 0 8px;">Reminder: Dining Tomorrow</h2>
      <p style="text-align:center;color:#6b7280;margin:0 0 24px;">Hi ${data.guestName}, your reservation is tomorrow!</p>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;">
        <div class="detail-row"><span class="detail-label">Restaurant</span><span class="detail-value">${data.restaurantName}</span></div>
        <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${data.date}</span></div>
        <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${data.time}</span></div>
        <div class="detail-row"><span class="detail-label">Guests</span><span class="detail-value">${data.partySize}</span></div>
        <div class="detail-row"><span class="detail-label">Ref</span><span class="detail-value">${data.referenceCode}</span></div>
      </div>
      ${data.address ? `<p style="font-size:13px;color:#6b7280;text-align:center;">📍 ${data.address}</p>` : ''}
      <p style="font-size:13px;color:#6b7280;text-align:center;">Need to cancel? Please do so at least 4 hours before your reservation time.</p>
    `),
  };
}

export function welcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: 'Welcome to DineRoot!',
    html: baseLayout(`
      <h2 style="text-align:center;color:#111827;margin:0 0 8px;">Welcome, ${name}!</h2>
      <p style="text-align:center;color:#6b7280;margin:0 0 24px;">We're thrilled to have you. Discover the best dining experiences across Lagos, Abuja, and Port Harcourt.</p>
      <div style="text-align:center;margin:20px 0;">
        <a href="https://dineroot.com/restaurants" class="btn">Browse Restaurants</a>
      </div>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-top:24px;">
        <p style="font-size:13px;color:#6b7280;margin:0 0 8px;font-weight:600;">What you can do:</p>
        <p style="font-size:13px;color:#6b7280;margin:4px 0;">→ Book tables at top restaurants</p>
        <p style="font-size:13px;color:#6b7280;margin:4px 0;">→ Get exclusive deals and discounts</p>
        <p style="font-size:13px;color:#6b7280;margin:4px 0;">→ Earn loyalty rewards with every booking</p>
        <p style="font-size:13px;color:#6b7280;margin:4px 0;">→ Book via WhatsApp for convenience</p>
      </div>
    `),
  };
}

export interface PaymentEmailData {
  guestName: string;
  restaurantName: string;
  amount: number;
  referenceCode: string;
  date: string;
}

export function paymentReceiptEmail(data: PaymentEmailData): { subject: string; html: string } {
  return {
    subject: `Payment Receipt — ₦${data.amount.toLocaleString()}`,
    html: baseLayout(`
      <h2 style="text-align:center;color:#111827;margin:0 0 8px;">Payment Received</h2>
      <p style="text-align:center;color:#6b7280;margin:0 0 24px;">Hi ${data.guestName}, your deposit has been confirmed.</p>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;">
        <div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value" style="color:${ACCENT_COLOR};font-weight:700;">₦${data.amount.toLocaleString()}</span></div>
        <div class="detail-row"><span class="detail-label">Restaurant</span><span class="detail-value">${data.restaurantName}</span></div>
        <div class="detail-row"><span class="detail-label">Booking Date</span><span class="detail-value">${data.date}</span></div>
        <div class="detail-row"><span class="detail-label">Reference</span><span class="detail-value">${data.referenceCode}</span></div>
      </div>
      <p style="font-size:12px;color:#9ca3af;text-align:center;">This deposit will be applied to your bill at the restaurant.</p>
    `),
  };
}

export function cancellationEmail(data: BookingEmailData & { cancelledBy: string }): { subject: string; html: string } {
  return {
    subject: `Booking Cancelled — ${data.restaurantName}`,
    html: baseLayout(`
      <div style="text-align:center; margin-bottom:20px;">
        <div style="width:48px;height:48px;border-radius:50%;background:#fee2e2;display:inline-flex;align-items:center;justify-content:center;">
          <span style="font-size:24px;">✕</span>
        </div>
      </div>
      <h2 style="text-align:center;color:#111827;margin:0 0 8px;">Booking Cancelled</h2>
      <p style="text-align:center;color:#6b7280;margin:0 0 24px;">Hi ${data.guestName}, your reservation has been cancelled${data.cancelledBy !== 'guest' ? ` by the ${data.cancelledBy}` : ''}.</p>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;">
        <div class="detail-row"><span class="detail-label">Restaurant</span><span class="detail-value">${data.restaurantName}</span></div>
        <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${data.date}</span></div>
        <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${data.time}</span></div>
        <div class="detail-row"><span class="detail-label">Ref</span><span class="detail-value">${data.referenceCode}</span></div>
      </div>
      ${data.depositAmount ? `<p style="font-size:13px;color:${ACCENT_COLOR};text-align:center;">Your deposit of ₦${data.depositAmount.toLocaleString()} will be refunded within 3-5 business days.</p>` : ''}
      <div style="text-align:center;margin-top:20px;">
        <a href="https://dineroot.com/restaurants" class="btn">Book Another Restaurant</a>
      </div>
    `),
  };
}

export function refundEmail(data: { guestName: string; amount: number; restaurantName: string; referenceCode: string }): { subject: string; html: string } {
  return {
    subject: `Refund Processed — ₦${data.amount.toLocaleString()}`,
    html: baseLayout(`
      <h2 style="text-align:center;color:#111827;margin:0 0 8px;">Refund Processed</h2>
      <p style="text-align:center;color:#6b7280;margin:0 0 24px;">Hi ${data.guestName}, your refund has been processed.</p>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;">
        <div class="detail-row"><span class="detail-label">Refund Amount</span><span class="detail-value" style="color:${ACCENT_COLOR};font-weight:700;">₦${data.amount.toLocaleString()}</span></div>
        <div class="detail-row"><span class="detail-label">Restaurant</span><span class="detail-value">${data.restaurantName}</span></div>
        <div class="detail-row"><span class="detail-label">Reference</span><span class="detail-value">${data.referenceCode}</span></div>
      </div>
      <p style="font-size:12px;color:#9ca3af;text-align:center;">Refunds typically take 3-5 business days to appear in your account.</p>
    `),
  };
}

export function noShowWarningEmail(data: { guestName: string; restaurantName: string; strikeCount: number; maxStrikes: number }): { subject: string; html: string } {
  return {
    subject: 'No-Show Warning — DineRoot',
    html: baseLayout(`
      <div style="text-align:center; margin-bottom:20px;">
        <div style="width:48px;height:48px;border-radius:50%;background:#fef3c7;display:inline-flex;align-items:center;justify-content:center;">
          <span style="font-size:24px;">⚠</span>
        </div>
      </div>
      <h2 style="text-align:center;color:#111827;margin:0 0 8px;">No-Show Recorded</h2>
      <p style="text-align:center;color:#6b7280;margin:0 0 24px;">Hi ${data.guestName}, you were marked as a no-show at ${data.restaurantName}.</p>
      <div style="background:#fef3c7;border-radius:8px;padding:16px;text-align:center;margin-bottom:20px;">
        <p style="font-size:14px;color:#92400e;margin:0;">Strike ${data.strikeCount} of ${data.maxStrikes}</p>
        <p style="font-size:12px;color:#92400e;margin:4px 0 0;">${data.strikeCount >= data.maxStrikes ? 'Your account has been temporarily suspended.' : `${data.maxStrikes - data.strikeCount} more no-shows will result in account suspension.`}</p>
      </div>
      <p style="font-size:13px;color:#6b7280;text-align:center;">If you believe this was an error, please contact our support team.</p>
    `),
  };
}

export function whatsappSetupPendingEmail(data: { ownerName: string; businessName: string }): { subject: string; html: string } {
  return {
    subject: `We're setting up ${data.businessName} — hang tight!`,
    html: baseLayout(`
      <div style="text-align:center; margin-bottom:20px;">
        <div style="width:48px;height:48px;border-radius:50%;background:#dbeafe;display:inline-flex;align-items:center;justify-content:center;">
          <span style="font-size:24px;">⏳</span>
        </div>
      </div>
      <h2 style="text-align:center;color:#111827;margin:0 0 8px;">Application Received!</h2>
      <p style="text-align:center;color:#6b7280;margin:0 0 24px;">
        Hi ${data.ownerName}, thanks for signing up <strong>${data.businessName}</strong> on DineRoot.
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

export function whatsappSetupCompleteEmail(data: { ownerName: string; businessName: string; phoneNumber?: string }): { subject: string; html: string } {
  const phoneLine = data.phoneNumber
    ? `<p style="font-size:14px;color:#065f46;margin:8px 0 0;">Your WhatsApp bot number: <strong>${data.phoneNumber}</strong></p>`
    : '';

  return {
    subject: `${data.businessName} is live on DineRoot!`,
    html: baseLayout(`
      <div style="text-align:center; margin-bottom:20px;">
        <div style="width:48px;height:48px;border-radius:50%;background:#d1fae5;display:inline-flex;align-items:center;justify-content:center;">
          <span style="font-size:24px;">🎉</span>
        </div>
      </div>
      <h2 style="text-align:center;color:#111827;margin:0 0 8px;">You're Live!</h2>
      <p style="text-align:center;color:#6b7280;margin:0 0 24px;">
        Hi ${data.ownerName}, great news — <strong>${data.businessName}</strong> is now set up and ready to go!
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
        <a href="https://dashboard.dineroot.com" class="btn">Go to Dashboard</a>
      </div>
    `),
  };
}

export function restaurantApprovedEmail(data: { ownerName: string; restaurantName: string }): { subject: string; html: string } {
  return {
    subject: `Congratulations! ${data.restaurantName} is live on DineRoot`,
    html: baseLayout(`
      <div style="text-align:center; margin-bottom:20px;">
        <div style="width:48px;height:48px;border-radius:50%;background:#d1fae5;display:inline-flex;align-items:center;justify-content:center;">
          <span style="font-size:24px;">🎉</span>
        </div>
      </div>
      <h2 style="text-align:center;color:#111827;margin:0 0 8px;">You're Live!</h2>
      <p style="text-align:center;color:#6b7280;margin:0 0 24px;">Hi ${data.ownerName}, ${data.restaurantName} is now live on DineRoot and ready to receive reservations.</p>
      <div style="text-align:center;margin:20px 0;">
        <a href="https://dashboard.dineroot.com" class="btn">Go to Dashboard</a>
      </div>
    `),
  };
}

export function payoutEmail(data: { ownerName: string; amount: number; restaurantName: string; period: string }): { subject: string; html: string } {
  return {
    subject: `Payout Processed — ₦${data.amount.toLocaleString()}`,
    html: baseLayout(`
      <h2 style="text-align:center;color:#111827;margin:0 0 8px;">Payout Sent</h2>
      <p style="text-align:center;color:#6b7280;margin:0 0 24px;">Hi ${data.ownerName}, your payout has been processed.</p>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;">
        <div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value" style="color:${ACCENT_COLOR};font-weight:700;">₦${data.amount.toLocaleString()}</span></div>
        <div class="detail-row"><span class="detail-label">Restaurant</span><span class="detail-value">${data.restaurantName}</span></div>
        <div class="detail-row"><span class="detail-label">Period</span><span class="detail-value">${data.period}</span></div>
      </div>
      <p style="font-size:12px;color:#9ca3af;text-align:center;">Funds will arrive in your bank account within 24 hours.</p>
    `),
  };
}
