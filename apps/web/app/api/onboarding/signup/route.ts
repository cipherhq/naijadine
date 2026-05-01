import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, first_name, last_name, phone } = body;

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters' },
        { status: 400 },
      );
    }

    const service = createServiceClient();

    // Create user via admin API (auto-confirms email for onboarding flow)
    const { data: authData, error: authError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: first_name || '',
        last_name: last_name || '',
      },
    });

    if (authError) {
      // Handle duplicate email
      if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
        return NextResponse.json(
          { message: 'An account with this email already exists. Please sign in instead.' },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { message: authError.message || 'Failed to create account' },
        { status: 400 },
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { message: 'Failed to create account' },
        { status: 500 },
      );
    }

    // Upsert profile with name and phone
    await service.from('profiles').upsert({
      id: authData.user.id,
      email,
      first_name: first_name || null,
      last_name: last_name || null,
      phone: phone || null,
      role: 'diner',
    }, { onConflict: 'id' });

    return NextResponse.json({
      user_id: authData.user.id,
    });
  } catch (error) {
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
