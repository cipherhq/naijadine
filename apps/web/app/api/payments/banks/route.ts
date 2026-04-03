import { NextResponse, type NextRequest } from 'next/server';

const MOCK_BANKS = [
  { name: 'Access Bank', code: '044' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'Guaranty Trust Bank', code: '058' },
  { name: 'United Bank for Africa', code: '033' },
  { name: 'Zenith Bank', code: '057' },
];

export async function GET(request: NextRequest) {
  try {
    const gateway = request.nextUrl.searchParams.get('gateway');

    if (!gateway || !['paystack', 'flutterwave'].includes(gateway)) {
      return NextResponse.json(
        { message: 'gateway must be paystack or flutterwave' },
        { status: 400 },
      );
    }

    // Mock mode — return common Nigerian banks
    if (gateway === 'paystack' && !process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ banks: MOCK_BANKS });
    }
    if (gateway === 'flutterwave' && !process.env.FLUTTERWAVE_SECRET_KEY) {
      return NextResponse.json({ banks: MOCK_BANKS });
    }

    if (gateway === 'paystack') {
      const res = await fetch('https://api.paystack.co/bank?country=nigeria', {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      });
      const data = await res.json();

      if (!data.status) {
        return NextResponse.json({ message: 'Failed to fetch banks' }, { status: 502 });
      }

      const banks = (data.data as { name: string; code: string }[]).map((b) => ({
        name: b.name,
        code: b.code,
      }));

      return NextResponse.json({ banks });
    }

    // Flutterwave
    const res = await fetch('https://api.flutterwave.com/v3/banks/NG', {
      headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
    });
    const data = await res.json();

    if (data.status !== 'success') {
      return NextResponse.json({ message: 'Failed to fetch banks' }, { status: 502 });
    }

    const banks = (data.data as { name: string; code: string }[]).map((b) => ({
      name: b.name,
      code: b.code,
    }));

    return NextResponse.json({ banks });
  } catch {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
