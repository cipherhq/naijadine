import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PHONE_REGEX = /^\+[0-9]{10,15}$/;

// Redis-backed rate limiter
async function checkRateLimit(phone: string): Promise<boolean> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    // Fallback: allow in dev but log warning
    console.warn('OTP rate limit: Redis not configured — no rate limiting active');
    return true;
  }

  const key = `otp_limit:${phone}`;

  try {
    // GET current count
    const getRes = await fetch(`${redisUrl}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['GET', key]),
    });
    const getResult = (await getRes.json()) as { result: string | null };
    const count = parseInt(getResult.result || '0', 10);

    if (count >= 3) {
      return false; // Rate limited
    }

    // INCR + set TTL of 10 minutes
    await fetch(`${redisUrl}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['INCR', key]),
    });

    if (count === 0) {
      // Set expiry on first request
      await fetch(`${redisUrl}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['EXPIRE', key, '600']),
      });
    }

    return true;
  } catch (err) {
    console.error('Redis rate limit error:', err);
    return true; // Fail open — don't block users if Redis is down
  }
}

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone || !PHONE_REGEX.test(phone)) {
      return NextResponse.json(
        { message: 'Invalid phone number format' },
        { status: 400 },
      );
    }

    // Rate limit: 3 per phone per 10 minutes (Redis-backed)
    const allowed = await checkRateLimit(phone);
    if (!allowed) {
      return NextResponse.json(
        { message: 'Too many OTP requests. Please wait 10 minutes.' },
        { status: 429 },
      );
    }

    // Use Supabase phone OTP
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithOtp({
      phone,
    });

    if (error) {
      // Don't reveal whether the phone exists
      console.error('OTP send error:', error.message);
      return NextResponse.json(
        { message: 'Failed to send OTP. Please try again.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: 'OTP sent',
      // Don't return any user-identifying info
    });
  } catch {
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
