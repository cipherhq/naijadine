import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { message: 'Not authenticated' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { first_name, last_name, email, city, dietary_preferences } = body;

    if (!first_name || !last_name) {
      return NextResponse.json(
        { message: 'First name and last name are required' },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name,
        last_name,
        email: email || null,
        city: city || null,
        dietary_preferences: dietary_preferences || [],
      })
      .eq('id', user.id);

    if (error) {
      return NextResponse.json(
        { message: 'Failed to update profile' },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: 'Profile updated successfully' });
  } catch {
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
